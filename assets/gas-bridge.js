/**
 * Pengganti google.script.run untuk halaman yang di-host di GitHub Pages.
 * Panggilan seperti  google.script.run.withSuccessHandler(fn).getData(a, b)
 * diteruskan ke web app Apps Script lewat HTTP POST (lihat apps-script/Bridge.gs).
 */
(function () {
  var tag = document.currentScript;
  var appKey = tag && tag.getAttribute('data-app');
  var cfg = window.MIW_CONFIG || {};
  var MAX_PARALLEL = 4;          // batasi permintaan bersamaan agar Apps Script tidak menolak
  var active = 0, queue = [];

  function endpoint() {
    var url = cfg[appKey];
    if (!url || /^ISI_URL/.test(url)) {
      throw new Error('URL Apps Script untuk "' + appKey + '" belum diisi di assets/config.js');
    }
    return url;
  }

  function rawPost(fn, args) {
    var url = endpoint();
    return fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args })
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data;
        try { data = JSON.parse(txt); }
        catch (e) {
          throw new Error('Respons Apps Script bukan JSON (HTTP ' + res.status + '). Pastikan deployment "Anyone" dan URL berakhiran /exec.');
        }
        if (!data.ok) throw new Error(data.error || 'Apps Script mengembalikan galat.');
        return data.result;
      });
    });
  }

  /* Setelah gagal total, cek apakah Apps Script bisa dijangkau sama sekali. */
  function explain(fn, err) {
    return rawPost('bridgePing', []).then(function () { return true; }, function (e) {
      return !(e instanceof TypeError);       // galat berupa JSON = server terjangkau
    }).then(function (reachable) {
      if (!reachable) {
        return new Error('Tidak bisa terhubung ke Apps Script "' + appKey + '". Periksa URL di config.js dan pastikan deployment memakai akses "Anyone".');
      }
      return new Error('Apps Script terjangkau, tetapi fungsi "' + fn + '" tidak mengembalikan hasil. ' +
        'Buka Apps Script > Executions, cari eksekusi doPost yang gagal atau berlangsung lama, lalu baca galatnya.');
    });
  }

  function post(fn, args, attempt) {
    attempt = attempt || 0;
    return rawPost(fn, args).catch(function (err) {
      if (!(err instanceof TypeError)) throw err;           // galat dari server: teruskan apa adanya
      // Hanya fungsi baca yang boleh diulang otomatis, agar data tidak tertulis ganda.
      if (/^(get|read|list|find)/.test(fn) && attempt < 2) {
        return new Promise(function (r) { setTimeout(r, 1500 * (attempt + 1)); })
          .then(function () { return post(fn, args, attempt + 1); });
      }
      return explain(fn, err).then(function (e) { throw e; });
    });
  }

  function enqueue(fn, args) {
    return new Promise(function (resolve, reject) {
      queue.push({ fn: fn, args: args, resolve: resolve, reject: reject });
      pump();
    });
  }
  function pump() {
    while (active < MAX_PARALLEL && queue.length) {
      (function (job) {
        active++;
        post(job.fn, job.args).then(job.resolve, job.reject).then(function () { active--; pump(); });
      })(queue.shift());
    }
  }

  function runner(onOk, onFail, userObj) {
    var base = {
      withSuccessHandler: function (f) { return runner(f, onFail, userObj); },
      withFailureHandler: function (f) { return runner(onOk, f, userObj); },
      withUserObject: function (o) { return runner(onOk, onFail, o); }
    };
    return new Proxy(base, {
      get: function (t, name) {
        if (name in t) return t[name];
        if (typeof name !== 'string') return undefined;
        return function () {
          var args = Array.prototype.slice.call(arguments);
          var p;
          try { endpoint(); p = enqueue(name, args); } catch (e) { p = Promise.reject(e); }
          p.then(function (result) {
            if (onOk) onOk(result, userObj);
          }, function (err) {
            if (onFail) onFail(err, userObj);
            else console.error('[' + name + ']', err);
          });
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = {
    run: runner(null, null, undefined),
    host: { close: function () {}, setHeight: function () {}, setWidth: function () {} }
  };
})();
