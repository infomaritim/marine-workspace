(function () {
  'use strict';

  var DASH = [
    { id: 'kapal', label: 'Kecelakaan Kapal', src: 'apps/kecelakaan-kapal.html' },
    { id: 'rob',   label: 'Banjir Rob',       src: 'apps/banjir-rob.html' },
    { id: 'ptsp',  label: 'PTSP',             src: 'apps/ptsp.html' },
    { id: 'skk',   label: 'SKK Migas',        src: 'apps/skk-migas-new.html' }
  ];
  var TOOLS = {
    'format-lama': { label: 'Format Lama PTSP', src: 'apps/format-baru-ptsp.html' },
    'convert-pdf': { label: 'Convert PDF Scan', src: 'apps/convert-pdf-scan.html' },
    'satelit-ptsp': { label: 'Satelit PTSP', src: 'apps/satelit-ptsp.html' }
  };
  var V = '11';
  function bust(u) { return u + (u.indexOf('?') < 0 ? '?' : '&') + 'v=' + V; }
  var ROUTINE = { task: { label: 'Task Management', src: 'apps/fod.html' } };

  /* Daftar nama file logo yang dicoba berurutan sampai ada yang ketemu. */
  var LOGO_CANDIDATES = [
    'assets/Logo%20BMKG.png', 'assets/Logo%20BMKG.svg', 'assets/Logo BMKG.jpg',
    'assets/logo-bmkg.png', 'assets/logo-bmkg.svg', 'assets/logo.png', 'assets/logo.svg',
    'assets/Logo-BMKG.png', 'assets/Logo-BMKG.svg', 'assets/logo_bmkg.png', 'assets/logo_bmkg.svg',
    'logo-bmkg.png', 'logo-bmkg.svg', 'logo.png', 'logo.svg',
    'assets/logo-bmkg-fallback.png', 'assets/logo-bmkg-placeholder.svg'
  ];

  var views = {
    home: document.getElementById('view-home'),
    routine: document.getElementById('view-routine'),
    dashboard: document.getElementById('view-dashboard'),
    layanan: document.getElementById('view-layanan')
  };
  var stages = {
    routine: document.getElementById('stage-routine'),
    dashboard: document.getElementById('stage-dashboard'),
    layanan: document.getElementById('stage-layanan')
  };

  /* ---------- logo ---------- */
  (function resolveLogo() {
    var i = 0;
    function next() {
      if (i >= LOGO_CANDIDATES.length) return;
      var url = LOGO_CANDIDATES[i++];
      var probe = new Image();
      probe.onload = function () {
        document.querySelectorAll('.bmkg-logo').forEach(function (el) { el.src = url; });
        var fav = document.getElementById('favicon');
        if (fav) fav.href = url;
      };
      probe.onerror = next;
      probe.src = url;
    }
    next();
  })();

  /* ---------- iframe per modul ---------- */
  function frameFor(stage, id, src, title) {
    var f = stage.querySelector('iframe[data-id="' + id + '"]');
    if (f) return f;
    var loader = document.createElement('div');
    loader.className = 'loader';
    loader.setAttribute('role', 'status');
    loader.innerHTML = '<div class="spin"></div><span>Memuat ' + title + '</span>';
    loader.dataset.for = id;
    f = document.createElement('iframe');
    f.dataset.id = id;
    f.title = title;
    f.setAttribute('allow', 'clipboard-write; fullscreen');
    f.addEventListener('load', function () {
      loader.remove();
      try { f.contentWindow.document.addEventListener('keydown', onKey); } catch (err) { /* lintas-origin: abaikan */ }
    });
    stage.appendChild(loader);
    stage.appendChild(f);
    f.src = bust(src);
    return f;
  }

  function showOnly(stage, id) {
    stage.querySelectorAll('iframe').forEach(function (f) { f.hidden = f.dataset.id !== id; });
    stage.querySelectorAll('.loader').forEach(function (l) { l.hidden = l.dataset.for !== id; });
  }

  function clearStage(stage) { stage.innerHTML = ''; }

  /* ---------- navigasi ---------- */
  /* Posisi disimpan di hash URL (#routine/task, #dashboard/rob, ...) agar refresh tetap di laman yang sama. */
  /* Setiap perpindahan laman menambah satu entri riwayat (pushState) sehingga tombol Back browser
     kembali ke laman sebelumnya, bukan keluar dari situs. Saat memulihkan dari hash/popstate tidak menambah entri. */
  var restoring = false;
  function setHash(h, replace) {
    if (restoring) return;
    if (location.hash.replace(/^#/, '') === (h || '')) return;
    var url = h ? '#' + h : location.pathname + location.search;
    try {
      if (replace) history.replaceState(history.state, '', url);
      else history.pushState({ miw: 1 }, '', url);
    } catch (err) { /* abaikan */ }
  }

  var current = 'home';
  var dashId = DASH[0].id;

  function titleOf(name) {
    return { routine: 'Operational Routine', dashboard: 'Dashboard', layanan: 'Layanan Khusus' }[name];
  }

  function show(name, skipHash) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    if (name === 'home' && current !== 'home') {
      ['routine', 'dashboard', 'layanan'].forEach(function (k) { clearStage(stages[k]); });
      resetRoutine();
      resetLayanan();
    }
    current = name;
    if (!skipHash) setHash(name === 'home' ? '' : name);
    document.body.classList.toggle('in-app', name !== 'home');
    window.scrollTo(0, 0);
    document.title = (name === 'home' ? '' : titleOf(name) + ' | ') + 'Maritime Information Workspace';
  }

  /* Operational Routine */
  var rMenu = document.getElementById('routine-menu');
  var rBack = document.getElementById('routine-back');
  var rTitle = document.getElementById('routine-title');

  function resetRoutine() {
    clearStage(stages.routine);
    rMenu.hidden = false;
    stages.routine.hidden = true;
    rBack.hidden = true;
    rTitle.textContent = 'Operational Routine';
  }
  function openRoutine() { show('routine'); resetRoutine(); colorRows(); }
  function openRoutineItem(key) {
    var t = ROUTINE[key];
    rMenu.hidden = true;
    stages.routine.hidden = false;
    rBack.hidden = false;
    rTitle.textContent = t.label;
    setHash('routine/' + key);
    frameFor(stages.routine, key, t.src, t.label);
    showOnly(stages.routine, key);
  }
  rBack.addEventListener('click', function () { resetRoutine(); setHash('routine'); colorRows(); });

  /* Dashboard */
  function openDashboard(id) {
    dashId = id || dashId;
    var already = current === 'dashboard';
    show('dashboard', true);
    setHash('dashboard/' + dashId, already);   /* ganti tab = replace, masuk dashboard = entri baru */
    var item = DASH.filter(function (d) { return d.id === dashId; })[0];
    frameFor(stages.dashboard, item.id, item.src, 'Dashboard ' + item.label);
    showOnly(stages.dashboard, item.id);
    document.querySelectorAll('#dash-tabs .tab').forEach(function (t) {
      t.setAttribute('aria-selected', String(t.dataset.id === item.id));
      t.tabIndex = t.dataset.id === item.id ? 0 : -1;
    });
  }

  var tabs = document.getElementById('dash-tabs');
  DASH.forEach(function (d) {
    var b = document.createElement('button');
    b.className = 'tab';
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.dataset.id = d.id;
    b.textContent = d.label;
    b.addEventListener('click', function () { openDashboard(d.id); });
    tabs.appendChild(b);
  });
  tabs.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var i = DASH.findIndex(function (d) { return d.id === dashId; });
    i = (i + (e.key === 'ArrowRight' ? 1 : DASH.length - 1)) % DASH.length;
    openDashboard(DASH[i].id);
    tabs.querySelector('[data-id="' + DASH[i].id + '"]').focus();
  });

  /* Layanan Khusus */
  var lMenu = document.getElementById('layanan-menu');
  var lBack = document.getElementById('layanan-back');
  var lTitle = document.getElementById('layanan-title');

  function resetLayanan() {
    clearStage(stages.layanan);
    lMenu.hidden = false;
    stages.layanan.hidden = true;
    lBack.hidden = true;
    lTitle.textContent = 'Layanan Khusus';
  }
  function openLayanan() { show('layanan'); resetLayanan(); }
  function openTool(key) {
    var t = TOOLS[key];
    lMenu.hidden = true;
    stages.layanan.hidden = false;
    lBack.hidden = false;
    lTitle.textContent = t.label;
    setHash('layanan/' + key);
    frameFor(stages.layanan, key, t.src, t.label);
    showOnly(stages.layanan, key);
  }
  lBack.addEventListener('click', function () { resetLayanan(); setHash('layanan'); });

  /* ---------- sembunyikan / tampilkan bilah atas ---------- */
  var BAR_KEY = 'miw-bar-hidden';
  function setBar(hidden) {
    document.body.classList.toggle('bar-hidden', hidden);
    try { localStorage.setItem(BAR_KEY, hidden ? '1' : '0'); } catch (err) { /* abaikan */ }
  }
  try { if (localStorage.getItem(BAR_KEY) === '1') setBar(true); } catch (err) { /* abaikan */ }

  /* ---------- pulihkan laman dari hash ---------- */
  function applyHash() {
    var parts = location.hash.replace(/^#/, '').split('/');
    var view = parts[0], key = parts[1];
    if (view === 'routine') { openRoutine(); if (ROUTINE[key]) openRoutineItem(key); }
    else if (view === 'layanan') { openLayanan(); if (TOOLS[key]) openTool(key); }
    else if (view === 'dashboard') {
      openDashboard(DASH.some(function (d) { return d.id === key; }) ? key : null);
    }
    else show('home');
  }
  function restoreFromHash() {
    restoring = true;
    try { applyHash(); } finally { restoring = false; }
  }
  if (location.hash) restoreFromHash();
  /* tombol Back / Forward browser */
  window.addEventListener('popstate', restoreFromHash);


  /* ---------- warna kotak Operational Routine per baris ---------- */
  /* Jumlah kolom bergantung pada lebar layar, jadi baris dihitung ulang setiap ukuran berubah. */
  function colorRows() {
    if (rMenu.hidden || !rMenu.children.length) return;
    var cols = getComputedStyle(rMenu).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    Array.prototype.forEach.call(rMenu.children, function (el, i) {
      el.dataset.row = String(Math.floor(i / cols) % 4);
    });
  }
  window.addEventListener('resize', colorRows);
  if (window.ResizeObserver) new ResizeObserver(colorRows).observe(rMenu);

  /* ---------- tema terang / gelap ---------- */
  var THEME_KEY = 'miw-theme';
  function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function syncThemeButtons() {
    document.querySelectorAll('[data-theme-set]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.themeSet === currentTheme()));
    });
  }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (err) { /* abaikan */ }
    syncThemeButtons();
  }
  syncThemeButtons();

  /* ---------- tombol Backspace = kembali ke laman sebelumnya ---------- */
  function isEditable(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return true;
    if (tag === 'INPUT') {
      var type = (el.type || 'text').toLowerCase();
      return ['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'image', 'range', 'color'].indexOf(type) < 0;
    }
    return false;
  }
  /* Dipakai bila riwayat browser tidak punya laman sebelumnya di situs ini (mis. dibuka langsung lewat link #routine/task). */
  function goUp() {
    if (current === 'routine' && !stages.routine.hidden) { resetRoutine(); setHash('routine', true); colorRows(); return; }
    if (current === 'layanan' && !stages.layanan.hidden) { resetLayanan(); setHash('layanan', true); return; }
    show('home', true);
    try { history.replaceState({ miw: 1 }, '', location.pathname + location.search); } catch (err) { /* abaikan */ }
  }
  function goBack() {
    if (current === 'home') return;
    if (history.state && history.state.miw) history.back(); else goUp();
  }
  function onKey(e) {
    if (e.key !== 'Backspace' || e.defaultPrevented) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (isEditable(e.target)) return;      /* sedang mengetik: Backspace tetap menghapus huruf */
    e.preventDefault();
    goBack();
  }
  document.addEventListener('keydown', onKey);

  /* ---------- event ---------- */
  document.addEventListener('click', function (e) {
    var th = e.target.closest('[data-theme-set]');
    if (th) { setTheme(th.dataset.themeSet); return; }
    var bar = e.target.closest('[data-bar]');
    if (bar) { setBar(bar.dataset.bar === 'hide'); return; }
    var go = e.target.closest('[data-go]');
    if (go) {
      var to = go.dataset.go;
      if (to === 'home') show('home');
      else if (to === 'routine') openRoutine();
      else if (to === 'dashboard') openDashboard();
      else if (to === 'layanan') openLayanan();
      return;
    }
    var r = e.target.closest('[data-routine]');
    if (r) { openRoutineItem(r.dataset.routine); return; }
    var tool = e.target.closest('[data-tool]');
    if (tool) openTool(tool.dataset.tool);
  });
})();
