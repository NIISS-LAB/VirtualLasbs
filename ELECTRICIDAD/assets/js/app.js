/* ============================================================================
   VIRTUAL LAB CENTER — lógica de la aplicación
   · Descubre las carpetas y páginas HTML del root (API o manifest.json)
   · Arma el árbol, filtra, y abre cada página dentro del visor
   · Tema claro/oscuro, idioma es/en, navegación por hash
   ========================================================================== */
(function () {
  'use strict';

  const t = VLC.t;
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.prototype.slice.call((ctx || document).querySelectorAll(sel));

  const els = {
    html: document.documentElement,
    viewHome: $('#viewHome'),
    viewLab: $('#viewLab'),
    backBtn: $('#backBtn'),
    openBtn: $('#openBtn'),
    crumbs: $('#crumbs'),
    menuBtn: $('#menuBtn'),
    themeBtn: $('#themeBtn'),
    langSeg: $('#langSeg'),
    rescanBtn: $('#rescanBtn'),
    heroIndex: $('#heroIndex'),
    heroFirst: $('#heroFirst'),
    indexPanel: $('#indexPanel'),
    indexSource: $('#indexSource'),
    mountHome: $('#treeMountHome'),
    mountLab: $('#treeMountLab'),
    side: $('#side'),
    sideClose: $('#sideClose'),
    sideScrim: $('#sideScrim'),
    frame: $('#frame'),
    stageName: $('#stageName'),
    stagePath: $('#stagePath'),
    stageFallback: $('#stageFallback'),
    stageOpen: $('#stageOpen'),
    copyBtn: $('#copyBtn'),
    statLabs: $('#statLabs'),
    statPages: $('#statPages'),
    statAreas: $('#statAreas'),
    statStamp: $('#statStamp'),
    toast: $('#toast'),
    indexTitle: $('#indexTitle'),
  };

  const CHANNELS = ['--ch-1', '--ch-2', '--ch-3', '--ch-4', '--ch-5'];
  const STORE_OPEN = 'vlc-open-folders';
  const STORE_QUERY = 'vlc-query';

  const state = {
    lang: VLC.lang,
    manifest: { labs: [], loose: [], generated: '', counts: { labs: 0, pages: 0, areas: 0 } },
    source: 'none',
    folders: new Set(),
    area: '',
    query: '',
    current: '',
    labs: [],
    loose: [],
    counts: { labs: 0, pages: 0, areas: 0 },
  };

  /* --------------------------------------------------------------- utils - */
  const pick = (obj) => {
    if (obj && typeof obj === 'object') return obj[state.lang] || obj.es || obj.en || '';
    return obj || '';
  };

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.remove('is-on'), 2600);
  }

  function saveFolders() {
    try {
      localStorage.setItem(STORE_OPEN, JSON.stringify([...state.folders]));
    } catch (e) { /* modo privado */ }
  }

  function loadFolders() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_OPEN) || '[]');
      if (Array.isArray(raw)) state.folders = new Set(raw);
    } catch (e) { /* ignorar */ }
  }

  /* ------------------------------------------------------------- idioma -- */
  function applyLang() {
    els.html.setAttribute('lang', state.lang);
    VLC.lang = state.lang;
    VLC.applyI18n(document);
    paintTree();
    paintCounts();
    if (state.current) paintCrumb();
  }
  function setLang(lang) {
    if (lang === state.lang) return;
    state.lang = lang;
    try { localStorage.setItem('vlc-lang', lang); } catch (e) { /* ignorar */ }
    $$('.seg__btn', els.langSeg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    applyLang();
    pushToFrame();
    toast(t('toast.lang'));
  }

  /* --------------------------------------------------------------- tema -- */
  function applyTheme(theme, announce) {
    els.html.setAttribute('data-theme', theme);
    els.themeBtn.setAttribute('aria-pressed', String(theme === 'dark'));
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#070d13' : '#e9eef3');
    try { localStorage.setItem('vlc-theme', theme); } catch (e) { /* ignorar */ }
    pushToFrame();
    if (announce) toast(t(theme === 'dark' ? 'toast.theme.dark' : 'toast.theme.light'));
  }
  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem('vlc-theme'); } catch (e) { /* ignorar */ }
    if (saved !== 'dark' && saved !== 'light') {
      saved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    applyTheme(saved, false);
  }

  function pushToFrame() {
    try {
      if (els.frame.contentWindow) {
        els.frame.contentWindow.postMessage(
          { source: 'virtual-lab-center', theme: els.html.getAttribute('data-theme'), lang: state.lang },
          '*'
        );
      }
    } catch (e) { /* origen distinto: esa página no recibe el cambio */ }
  }

  /* --------------------------------------------------------- manifiesto -- */
  async function getJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status + ' ' + url);
    return res.json();
  }

  async function loadManifest() {
    try {
      const m = await getJSON('api/labs');
      return { manifest: normalise(m), source: 'api' };
    } catch (e) { /* servidor no disponible: probamos el archivo */ }
    try {
      const m = await getJSON('manifest.json');
      return { manifest: normalise(m), source: 'manifest' };
    } catch (e) { /* nada legible */ }
    return { manifest: normalise(null), source: 'none' };
  }

  function normalise(m) {
    const labs = Array.isArray(m && m.labs) ? m.labs : [];
    const loose = Array.isArray(m && m.pages) ? m.pages : [];
    const pages = labs.reduce((n, l) => n + (l.pages ? l.pages.length : 0), 0) + loose.length;
    const areas = new Set(labs.map((l) => pick(l.area) || l.id)).size;
    return {
      labs,
      loose,
      generated: (m && m.generated) || '',
      counts: (m && m.counts) || { labs: labs.length, pages, areas },
    };
  }

  function findLab(path) {
    for (const lab of state.labs) {
      for (const p of lab.pages || []) if (p.path === path) return { lab, page: p };
    }
    for (const p of state.loose) if (p.path === path) return { lab: null, page: p };
    return null;
  }

  /* ------------------------------------------------------------- lectura - */
  function paintCounts() {
    const c = state.counts;
    els.statLabs.textContent = c.labs;
    els.statPages.textContent = c.pages;
    els.statAreas.textContent = c.areas;
    if (state.source === 'none') {
      els.indexSource.textContent = t('index.source.none');
    } else if (state.source === 'manifest') {
      els.indexSource.textContent = t('index.source.manifest');
    } else {
      els.indexSource.textContent = t('index.source', {
        n: state.counts.labs,
        p: state.counts.pages,
      });
    }
    els.statStamp.textContent = (state.manifest.generated || '')
      ? new Date(state.manifest.generated).toLocaleString(state.lang === 'en' ? 'en-GB' : 'es-ES', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        })
      : '—';
  }

  /* -------------------------------------------------------------- árbol -- */
  let panel = null;

  function channelFor(index) {
    return `var(${CHANNELS[index % CHANNELS.length]})`;
  }

  function matches(haystack) {
    if (!state.query) return true;
    return (haystack || '').toLowerCase().indexOf(state.query) !== -1;
  }

  function buildPanel() {
    panel = document.createElement('section');
    panel.className = 'treepanel';

    const bar = document.createElement('div');
    bar.className = 'treebar';

    const field = document.createElement('label');
    field.className = 'field';
    field.innerHTML =
      '<svg class="ic" aria-hidden="true"><use href="#i-search"/></svg>' +
      '<input type="search" data-i18n-ph="index.search" aria-label="' + t('index.search') + '" autocomplete="off" spellcheck="false">';
    const input = $('input', field);
    input.value = state.query;
    input.addEventListener('input', () => {
      state.query = input.value.trim().toLowerCase();
      try { localStorage.setItem(STORE_QUERY, state.query); } catch (e) { /* ignorar */ }
      paintTree();
    });

    const chips = document.createElement('div');
    chips.className = 'chips';

    bar.appendChild(field);
    bar.appendChild(chips);
    panel.appendChild(bar);

    const wrap = document.createElement('div');
    wrap.className = 'treewrap';
    panel.appendChild(wrap);

    panel._chips = chips;
    panel._wrap = wrap;
    panel._input = input;

    chips.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      state.area = b.dataset.area === state.area ? '' : b.dataset.area;
      paintTree();
    });

    wrap.addEventListener('click', onTreeClick);
    wrap.addEventListener('keydown', onTreeKey);

    return panel;
  }

  function onTreeClick(e) {
    const node = e.target.closest('.node');
    if (!node) return;
    if (node.classList.contains('node--folder')) {
      const id = node.dataset.id;
      if (state.folders.has(id)) state.folders.delete(id);
      else state.folders.add(id);
      saveFolders();
      paintTree();
      const again = $(`.node--folder[data-id="${cssEsc(id)}"]`, panel._wrap);
      if (again) again.focus();
      return;
    }
    e.preventDefault();
    if (node.dataset.path) go('#/p/' + encodeURI(node.dataset.path));
  }

  function onTreeKey(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const nodes = $$('.node', panel._wrap).filter((n) => n.offsetParent !== null);
    if (!nodes.length) return;
    const i = nodes.indexOf(document.activeElement);
    e.preventDefault();
    let next = i;
    if (e.key === 'ArrowDown') next = Math.min(nodes.length - 1, i + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else next = nodes.length - 1;
    nodes[next].focus();
  }

  const cssEsc = (s) => String(s).replace(/["\\]/g, '\\$&');

  function folderNode(lab, index, pages) {
    const li = document.createElement('li');
    li.setAttribute('role', 'none');

    const open = state.folders.has(lab.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'node node--folder';
    btn.setAttribute('role', 'treeitem');
    btn.setAttribute('aria-expanded', String(open));
    btn.dataset.id = lab.id;
    btn.style.setProperty('--ch', channelFor(index));
    btn.innerHTML =
      '<svg class="ic node__chev" aria-hidden="true"><use href="#i-chevron"/></svg>' +
      '<span class="node__dot"></span>' +
      '<span class="node__label"></span>' +
      '<span class="node__area"></span>' +
      '<span class="node__meta"></span>';

    $('.node__label', btn).textContent = pick(lab.title) || lab.id;
    $('.node__area', btn).textContent = pick(lab.area) || '';
    $('.node__meta', btn).textContent = pages.length + ' · ' + lab.id;

    li.appendChild(btn);

    if (open) {
      const ul = document.createElement('ul');
      ul.setAttribute('role', 'group');
      pages.forEach((p) => ul.appendChild(pageNode(p, lab)));
      li.appendChild(ul);
    }
    return li;
  }

  function isMainPage(page, lab) {
    if (!lab) return false;
    const base = page.file ? page.file.replace(/\.html?$/i, '') : '';
    return page.path === lab.main || base.toLowerCase() === 'index';
  }

  /** la portada de una carpeta se muestra con el nombre de la práctica, no con el del archivo */
  function pageLabel(page, lab) {
    if (!lab) return pick(page.title) || page.path;
    const base = page.file ? page.file.replace(/\.html?$/i, '') : '';
    return isMainPage(page, lab) ? pick(lab.title) || lab.id : pick(page.title) || base || page.path;
  }

  function pageNode(page, lab) {
    const li = document.createElement('li');
    li.setAttribute('role', 'none');
    const a = document.createElement('a');
    a.className = 'node node--page';
    a.setAttribute('role', 'treeitem');
    a.href = '#/p/' + encodeURI(page.path);
    a.dataset.path = page.path;
    if (page.path === state.current) a.setAttribute('aria-current', 'page');

    const base = page.file ? page.file.replace(/\.html?$/i, '') : '';
    const isMain = isMainPage(page, lab);
    const label = pageLabel(page, lab);
    const meta = isMain ? t('index.main') : base && !/^index$/i.test(base) ? base + '.html' : '';

    a.innerHTML = '<span class="node__dot"></span><span class="node__label"></span>' +
      (meta ? '<span class="node__meta"></span>' : '');
    $('.node__label', a).textContent = label;
    if (meta) $('.node__meta', a).textContent = meta;
    if (page.summary) a.title = pick(page.summary);
    li.appendChild(a);
    return li;
  }

  function emptyBlock(kind) {
    const div = document.createElement('div');
    div.className = 'empty';

    if (kind === 'none') {
      div.innerHTML =
        '<h3>' + t('empty.title') + '</h3><p>' + t('empty.body') + '</p>' +
        '<pre><span class="c">root/</span>\n  <span class="c">mi-practica/</span>\n    index.html\n    guia.html\n  <span class="c">README</span> ← opcional (lab.json)</pre>';
      return div;
    }
    if (kind === 'filter') {
      div.innerHTML = '<h3>' + t('empty.filter') + '</h3>';
      const b = document.createElement('button');
      b.className = 'btn btn--primary';
      b.type = 'button';
      b.textContent = t('empty.filterBtn');
      b.addEventListener('click', () => {
        state.query = '';
        state.area = '';
        panel._input.value = '';
        paintTree();
      });
      div.appendChild(b);
      return div;
    }
    div.innerHTML = '<h3>' + t('empty.title') + '</h3><p>' + t('empty.server') + '</p>';
    return div;
  }

  function visibleLabs() {
    return state.labs.filter((lab) => {
      if (state.area && pick(lab.area) !== state.area) return false;
      if (!state.query) return true;
      const hay = [lab.id, pick(lab.title), pick(lab.area), pick(lab.summary)]
        .concat((lab.pages || []).map((p) => p.path + ' ' + pick(p.title)))
        .join(' ')
        .toLowerCase();
      return matches(hay);
    });
  }

  function paintTree() {
    if (!panel) return;

    // chips de área
    const areas = [];
    state.labs.forEach((lab) => {
      const name = pick(lab.area) || lab.id;
      if (areas.indexOf(name) === -1) areas.push(name);
    });
    const chipHTML = ['<button class="chip" type="button" data-area="" aria-pressed="' + (state.area === '') + '">' + t('index.allareas') + '</button>'];
    areas.forEach((a, i) => {
      chipHTML.push(
        '<button class="chip" type="button" data-area="' + a.replace(/"/g, '&quot;') + '" aria-pressed="' +
        (state.area === a) + '" style="--ch:' + channelFor(i) + '">' + a + '</button>'
      );
    });
    panel._chips.innerHTML = chipHTML.join('');

    // páginas que sobreviven al filtro
    const wrap = panel._wrap;
    wrap.innerHTML = '';

    const labs = visibleLabs();
    const hasFilter = Boolean(state.query || state.area);

    if (!state.labs.length && !state.loose.length) {
      wrap.appendChild(emptyBlock(state.source === 'none' ? 'server' : 'none'));
      return;
    }

    if (!labs.length && !state.loose.length) {
      wrap.appendChild(emptyBlock('filter'));
      return;
    }

    const root = document.createElement('ul');
    root.className = 'tree__group';
    root.setAttribute('role', 'tree');
    root.setAttribute('aria-label', t('a11y.tree'));

    labs.forEach((lab) => {
      let pages = lab.pages || [];
      if (state.query) {
        const filtered = pages.filter((p) => matches((p.path + ' ' + pick(p.title)).toLowerCase()));
        if (!filtered.length) return;
        pages = filtered;
        state.folders.add(lab.id); // al buscar, el grupo se abre
      }
      const index = state.labs.indexOf(lab);
      root.appendChild(folderNode(lab, index, pages));
    });

    const loose = state.loose.filter((p) => matches((p.path + ' ' + pick(p.title)).toLowerCase()));
    if (loose.length) {
      const li = document.createElement('li');
      li.setAttribute('role', 'none');
      const open = state.folders.has('_root') || hasFilter;
      if (open) state.folders.add('_root');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'node node--folder';
      btn.setAttribute('role', 'treeitem');
      btn.setAttribute('aria-expanded', String(open));
      btn.dataset.id = '_root';
      btn.style.setProperty('--ch', channelFor(state.labs.length));
      btn.innerHTML =
        '<svg class="ic node__chev" aria-hidden="true"><use href="#i-chevron"/></svg>' +
        '<span class="node__dot"></span><span class="node__label"></span><span class="node__meta">' + loose.length + '</span>';
      $('.node__label', btn).textContent = t('index.loose');
      li.appendChild(btn);
      if (open) {
        const ul = document.createElement('ul');
        ul.setAttribute('role', 'group');
        loose.forEach((p) => ul.appendChild(pageNode(p)));
        li.appendChild(ul);
      }
      root.appendChild(li);
    }

    wrap.appendChild(root);
  }

  /* -------------------------------------------------------------- visor -- */
  let loadTimer = 0;
  let currentView = null;

  function paintCrumb() {
    const found = findLab(state.current);
    const title = found ? pageLabel(found.page, found.lab) : state.current;
    els.crumbs.innerHTML = '';

    const home = document.createElement('a');
    home.href = '#/';
    home.className = 'crumbs__home';
    home.textContent = t('index.title');
    home.style.color = 'inherit';

    const sep = document.createElement('i');
    sep.textContent = '/';

    const cur = document.createElement('b');
    cur.className = 'crumbs__ch';
    cur.textContent = title;

    els.crumbs.appendChild(home);
    els.crumbs.appendChild(sep);
    // en la portada de la carpeta el nombre de la práctica ya está en la miga final
    if (found && found.lab && !isMainPage(found.page, found.lab)) {
      const mid = document.createElement('span');
      mid.textContent = pick(found.lab.title) || found.lab.id;
      els.crumbs.appendChild(mid);
      const sep2 = document.createElement('i');
      sep2.textContent = '/';
      els.crumbs.appendChild(sep2);
    }
    els.crumbs.appendChild(cur);
    els.crumbs.setAttribute('aria-label', t('a11y.breadcrumb'));

    els.stageName.textContent = title;
    els.stagePath.textContent = state.current;
    els.stagePath.title = state.current + ' — ' + t('toast.copy');
    els.copyBtn.title = t('stage.copy');
    els.copyBtn.setAttribute('aria-label', t('stage.copy'));
    els.openBtn.title = t('nav.open');
    els.openBtn.setAttribute('aria-label', t('nav.open'));
    els.stageOpen.href = state.current;
    document.title = title + ' · Virtual Lab Center';

    if (found && found.lab) state.folders.add(found.lab.id);
  }

  function openLab(path) {
    state.current = path;
    els.stageFallback.hidden = true;    const url = path + '?__vlc=' + Date.now();
    if (els.frame.getAttribute('src') !== url) {
      els.frame.setAttribute('src', url);
    }
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => {
      // si el iframe no terminó de cargar, ofrecemos abrirla aparte
      if (els.frame.getAttribute('src') !== url) return;
      try {
        const doc = els.frame.contentDocument;
        if (!doc || doc.location.href === 'about:blank') els.stageFallback.hidden = false;
      } catch (e) {
        els.stageFallback.hidden = false;
      }
    }, 7000);
  }

  function render() {
    const hash = location.hash || '#/';
    const isLab = hash.indexOf('#/p/') === 0;
    const isJump = hash === '#index';
    const view = isLab ? 'lab' : 'home';

    if (currentView !== view) {
      currentView = view;
      window.scrollTo(0, 0);
    }

    if (!isLab) {
      state.current = '';
      els.viewLab.hidden = true;
      els.viewHome.hidden = false;
      els.backBtn.hidden = true;
      els.openBtn.hidden = true;
      els.crumbs.innerHTML = '';
      els.html.classList.remove('is-in-lab');
      els.mountHome.appendChild(panel);
      paintTree();
      if (isJump) {
        els.indexPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#/');
      }
      document.title = 'Virtual Lab Center';
      return;
    }

    const path = decodeURI(hash.slice(4));
    const found = findLab(path);
    if (!found) {
      toast(t('toast.same'));
      location.replace('#/');
      return;
    }

    els.viewHome.hidden = true;
    els.viewLab.hidden = false;
    els.backBtn.hidden = false;
    els.openBtn.hidden = false;
    els.html.classList.add('is-in-lab');
    els.mountLab.appendChild(panel);
    state.current = path;
    paintCrumb();
    paintTree();
    openLab(path);
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  /* ------------------------------------------------------------- eventos - */
  /** el índice solo es un cajón deslizante en pantallas estrechas */
  const isDrawer = () => window.matchMedia('(max-width: 900px)').matches;

  function wire() {
    window.addEventListener('hashchange', render);

    els.backBtn.addEventListener('click', () => go('#/'));
    els.menuBtn.addEventListener('click', () => {
      els.side.classList.add('is-open');
      if (isDrawer()) els.sideScrim.hidden = false;
    });
    const closeSide = () => {
      els.side.classList.remove('is-open');
      els.sideScrim.hidden = true;
    };
    els.sideClose.addEventListener('click', closeSide);
    els.sideScrim.addEventListener('click', closeSide);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.sideScrim.hidden) closeSide();
    });

    els.themeBtn.addEventListener('click', () => {
      const next = els.html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    });

    els.langSeg.addEventListener('click', (e) => {
      const b = e.target.closest('.seg__btn');
      if (b) setLang(b.dataset.lang);
    });

    els.openBtn.addEventListener('click', () => {
      if (state.current) window.open(state.current, '_blank', 'noopener');
    });
    const copyPath = async () => {
      if (!state.current) return;
      const url = location.origin + '/' + state.current;
      try {
        await navigator.clipboard.writeText(url);
        toast(t('toast.copy'));
      } catch (err) {
        toast(state.current);
      }
    };
    els.copyBtn.addEventListener('click', copyPath);
    els.stagePath.addEventListener('click', copyPath);
    els.stagePath.style.cursor = 'pointer';

    els.rescanBtn.addEventListener('click', async () => {
      els.indexSource.textContent = t('index.hint');
      await refresh();
      toast(t('toast.rescan', { n: state.counts.labs, p: state.counts.pages }));
    });

    els.frame.addEventListener('load', () => {
      clearTimeout(loadTimer);
      els.stageFallback.hidden = true;
      pushToFrame();
    });
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.source === 'virtual-lab-center-lab' && d.title) {
        const base = String(d.title).replace(/\s*·\s*Virtual Lab Center\s*$/i, '');
        document.title = base + ' · Virtual Lab Center';
      }
    });

    // teclas globales
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;
      if (e.key === '[' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        go('#/');
      }
    });
  }

  async function refresh() {
    const { manifest, source } = await loadManifest();
    state.manifest = manifest;
    state.source = source;
    state.labs = manifest.labs;
    state.loose = manifest.loose;
    state.counts = manifest.counts;
    paintCounts();
    paintTree();
  }

  /* --------------------------------------------------------------- boot -- */
  async function boot() {
    loadFolders();
    try { state.query = (localStorage.getItem(STORE_QUERY) || '').toLowerCase(); } catch (e) { /* ignorar */ }
    initTheme();
    $$('.seg__btn', els.langSeg).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
    applyLang();

    panel = buildPanel();
    els.mountHome.appendChild(panel);
    const heroTitle = document.querySelector('.hero__title');
    if (heroTitle) heroTitle.classList.add('is-set');

    wire();
    await refresh();
    render();

    // primera práctica sugerida
    if (state.labs.length && state.labs[0].pages && state.labs[0].pages.length) {
      els.heroFirst.hidden = false;
      els.heroFirst.href = '#/p/' + encodeURI(state.labs[0].pages[0].path);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
