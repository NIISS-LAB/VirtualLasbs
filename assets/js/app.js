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
    scanPanel: $('#scanPanel'),
    scanClose: $('#scanClose'),
    scanPick: $('#scanPick'),
    scanAgain: $('#scanAgain'),
    scanForget: $('#scanForget'),
    scanDrop: $('#scanDrop'),
    scanStatus: $('#scanStatus'),
    scanServer: $('#scanServer'),
  };

  const CHANNELS = ['--ch-1', '--ch-2', '--ch-3', '--ch-4', '--ch-5'];
  const STORE_OPEN = 'vlc-open-folders';
  const STORE_QUERY = 'vlc-query';

  const state = {
    lang: VLC.lang,
    manifest: { areas: [], labs: [], loose: [], generated: '', counts: { labs: 0, pages: 0, areas: 0 } },
    source: 'none',
    manual: null,
    dirHandle: null,
    dirName: '',
    folders: new Set(),
    area: '',
    query: '',
    current: '',
    labs: [],
    loose: [],
    areas: [],
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
  const isFileProtocol = () => location.protocol === 'file:';

  async function getJSON(url, timeout) {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout || 6000) : 0;
    try {
      const res = await fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
      if (!res.ok) throw new Error(res.status + ' ' + url);
      return await res.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Orden de búsqueda del índice, de más vivo a más último:
   *   1. api/labs        servidor node (re-escanea en cada visita)
   *   2. manifest.json   alojamiento estático
   *   3. labs.js         registro incrustado en un <script>, funciona en file://
   *   4. localStorage    escaneo hecho antes en este navegador
   * Nunca hay que ejecutar nada para ver el sitio: el punto 3 siempre está.
   */
  async function loadRegistry() {
    if (state.manual) return { data: state.manual, source: 'scan' };

    // ?source=api|manifest|embedded|none  fija de dónde se lee el índice
    let forced = null;
    try {
      forced = new URLSearchParams(location.search).get('source');
    } catch (e) { /* ignorar */ }
    const allow = (name) => !forced || forced === name;

    if (!isFileProtocol() && allow('api')) {
      try {
        return { data: await getJSON('api/labs', 4000), source: 'api' };
      } catch (e) { /* sin servidor */ }
    }
    if (!isFileProtocol() && allow('manifest')) {
      try {
        return { data: await getJSON('manifest.json', 4000), source: 'manifest' };
      } catch (e) { /* sin archivo */ }
    }
    if (allow('embedded') && window.VLC_REGISTRY) return { data: window.VLC_REGISTRY, source: 'embedded' };
    if (allow('cache')) {
      const cached = VLC.registry.load();
      if (cached) return { data: cached, source: 'cache' };
    }
    return { data: null, source: 'none' };
  }

  function findLab(path) {
    for (const lab of state.labs) {
      for (const p of lab.pages || []) if (p.path === path) return { lab, page: p };
    }
    for (const p of state.loose) if (p.path === path) return { lab: null, page: p };
    return null;
  }

  /* ------------------------------------------------------------- lectura - */
  const SOURCE_KEY = {
    api: 'index.source.api',
    manifest: 'index.source.manifest',
    embedded: 'index.source.embedded',
    cache: 'index.source.cache',
    scan: 'index.source.scan',
    none: 'index.source.none',
  };

  function paintCounts() {
    const c = state.counts;
    els.statLabs.textContent = c.labs;
    els.statPages.textContent = c.pages;
    els.statAreas.textContent = c.areas;

    const vars = { n: c.labs, p: c.pages };
    els.indexSource.textContent = t(SOURCE_KEY[state.source] || 'index.source.none', vars);
    els.indexSource.dataset.source = state.source;
    els.indexSource.title = t('index.sourceHelp');

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
    li.style.setProperty('--ch', labChannel(lab, state.areas.length ? areaList() : []));
    const a = document.createElement('a');
    a.className = 'node node--page';
    a.setAttribute('role', 'treeitem');
    a.href = '#/p/' + encodeURI(page.path);
    a.dataset.path = page.path;
    if (page.path === state.current) a.setAttribute('aria-current', 'page');

    const base = page.file ? page.file.replace(/\.html?$/i, '') : '';
    const isMain = isMainPage(page, lab);
    // dentro de una práctica ya se lee su nombre: la portada se rotula, no se repite
    const label = lab && isMain ? t('index.cover') : pick(page.title) || base || page.path;
    const meta = base ? base + '.html' : page.path;

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
        '<pre><span class="c">root/</span>\n  <span class="c">mi-practica/</span>\n    index.html\n    guia.html\n  <span class="c">lab.json</span> ← opcional (título, área, textos)</pre>';
      const actions = document.createElement('div');
      actions.className = 'empty__actions';
      const b1 = document.createElement('button');
      b1.className = 'btn btn--primary';
      b1.type = 'button';
      b1.textContent = t('scan.pick');
      b1.addEventListener('click', () => {
        if (VLC.registry.canPick) pickFolder();
        else openScanPanel();
      });
      const b2 = document.createElement('button');
      b2.className = 'btn';
      b2.type = 'button';
      b2.textContent = t('scan.dropTitle');
      b2.addEventListener('click', openScanPanel);
      actions.appendChild(b1);
      actions.appendChild(b2);
      div.appendChild(actions);
      const p = document.createElement('p');
      p.className = 'empty__note';
      p.innerHTML = t('empty.note');
      div.appendChild(p);
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
    return div;
  }

  function visibleLabs() {
    return state.labs.filter((lab) => {
      if (state.area) {
        if (lab.areaId) {
          if (lab.areaId !== state.area) return false;
        } else if (pick(lab.area) !== state.area) return false;
      }
      if (!state.query) return true;
      const hay = [lab.id, pick(lab.title), pick(lab.area), pick(lab.summary)]
        .concat((lab.pages || []).map((p) => p.path + ' ' + pick(p.title)))
        .join(' ')
        .toLowerCase();
      return matches(hay);
    });
  }

  /** áreas declaradas + las que se deducen del nombre de la carpeta */
  function areaList() {
    const list = state.areas.slice();
    state.labs.forEach((lab) => {
      if (!lab.areaId) return;
      if (list.some((a) => a.id === lab.areaId)) return;
      list.push({ id: lab.areaId, title: pick(lab.area) || VLC.registry.prettify(lab.areaId), labs: 0 });
    });
    return list;
  }

  /** color de canal: el del área, o el índice de la práctica */
  function labChannel(lab, areas) {
    if (lab.areaId) {
      const i = areas.findIndex((a) => a.id === lab.areaId);
      if (i >= 0) return channelFor(i);
    }
    return channelFor(state.labs.indexOf(lab));
  }

  function paintTree() {
    if (!panel) return;

    const areas = areaList();

    // chips de área (o, si no hay áreas, una por práctica)
    const chipNames = areas.length
      ? areas.slice()
      : state.labs
          .map((lab) => ({ id: pick(lab.area) || lab.id, title: pick(lab.area) || lab.id }))
          .filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i);

    const chipHTML = [
      '<button class="chip" type="button" data-area="" aria-pressed="' + (state.area === '') + '">' +
        t('index.allareas') + '</button>',
    ];
    chipNames.forEach((a, i) => {
      chipHTML.push(
        '<button class="chip" type="button" data-area="' + String(a.id).replace(/"/g, '&quot;') + '" aria-pressed="' +
          (state.area === a.id) + '" style="--ch:' + channelFor(i) + '">' + (pick(a.title) || a.id) + '</button>'
      );
    });
    panel._chips.innerHTML = chipHTML.join('');

    const wrap = panel._wrap;
    wrap.innerHTML = '';

    const labs = visibleLabs();
    const hasFilter = Boolean(state.query || state.area);

    if (!state.labs.length && !state.loose.length) {
      wrap.appendChild(emptyBlock('none'));
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

    /** carpeta genérica: sirve para un área, una práctica y las páginas del root */
    const branch = (opts) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'none');
      // el color de canal vive en el <li> para que lo hereden el nodo y su guía vertical
      li.style.setProperty('--ch', opts.channel);
      const open = opts.open !== undefined ? opts.open : state.folders.has(opts.id) || (opts.forceOpen && hasFilter);
      if (open) state.folders.add(opts.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'node node--folder' + (opts.kind ? ' node--' + opts.kind : '');
      btn.setAttribute('role', 'treeitem');
      btn.setAttribute('aria-expanded', String(open));
      btn.dataset.id = opts.id;
      btn.innerHTML =
        '<svg class="ic node__chev" aria-hidden="true"><use href="#i-chevron"/></svg>' +
        '<span class="node__dot"></span><span class="node__label"></span>' +
        (opts.meta ? '<span class="node__meta"></span>' : '');
      $('.node__label', btn).textContent = opts.label;
      if (opts.meta) $('.node__meta', btn).textContent = opts.meta;
      if (opts.hint) btn.title = opts.hint;
      li.appendChild(btn);
      if (open && opts.children && opts.children.length) {
        const ul = document.createElement('ul');
        ul.setAttribute('role', 'group');
        // el nivel lo usa el CSS para sangrar, reducir cuerpo y atenuar color
        ul.style.setProperty('--lvl', String((opts.level || 0) + 1));
        opts.children.forEach((c) => ul.appendChild(c));
        li.appendChild(ul);
      }
      return li;
    };

    const labNode = (lab, level) => {
      let pages = lab.pages || [];
      if (state.query) {
        pages = pages.filter((p) => matches((p.path + ' ' + pick(p.title)).toLowerCase()));
        if (!pages.length) return null;
      }
      return branch({
        id: lab.id,
        kind: 'lab',
        level: level,
        label: pick(lab.title) || lab.id,
        meta: state.areas.length ? String((lab.pages || []).length) : (lab.pages || []).length + ' · ' + lab.folder,
        channel: labChannel(lab, areas),
        hint: pick(lab.summary),
        open: state.folders.has(lab.id) || Boolean(state.query),
        children: pages.map((p) => pageNode(p, lab)),
      });
    };

    // 1) prácticas agrupadas por área
    const byArea = new Map();
    labs.forEach((lab) => {
      const key = lab.areaId || '';
      if (!byArea.has(key)) byArea.set(key, []);
      byArea.get(key).push(lab);
    });

    if (state.areas.length) {
      state.areas.forEach((area, i) => {
        if (state.area && state.area !== area.id) return;
        const mine = byArea.get(area.id) || [];
        const children = mine.map((lab) => labNode(lab, 1)).filter(Boolean);
        if (!children.length) {
          const hint = document.createElement('li');
          hint.setAttribute('role', 'none');
          const span = document.createElement('span');
          span.className = 'node node--empty';
          span.textContent = t('index.emptyArea');
          hint.appendChild(span);
          children.push(hint);
        }
        const open = state.folders.has('area:' + area.id) || !hasFilter || Boolean(state.query);
        root.appendChild(
          branch({
            id: 'area:' + area.id,
            kind: 'area',
            level: 0,
            label: pick(area.title) || area.id,
            meta: String(mine.length || area.labs || 0),
            channel: channelFor(i),
            open: open,
            children,
          })
        );
      });

      // prácticas sueltas: carpeta en la raíz, sin área
      (byArea.get('') || []).forEach((lab) => {
        const node = labNode(lab, 0);
        if (node) root.appendChild(node);
      });
    } else {
      labs.forEach((lab) => {
        const node = labNode(lab, 0);
        if (node) root.appendChild(node);
      });
    }

    // 2) páginas sueltas del root
    const loose = state.loose.filter((p) => matches((p.path + ' ' + pick(p.title)).toLowerCase()));
    if (loose.length) {
      root.appendChild(
        branch({
          id: '_root',
          level: 0,
          label: t('index.loose'),
          meta: String(loose.length),
          channel: channelFor(state.labs.length + state.areas.length),
          forceOpen: true,
          children: loose.map((p) => pageNode(p)),
        })
      );
    }

    wrap.appendChild(root);
  }
  /* =================================================== índice en el navegador */
  /** deja el escaneo manual por encima de las demás fuentes */
  function applyScan(data) {
    state.manual = data;
    VLC.registry.save(data);
    if (data && data.dirName) state.dirName = data.dirName;
  }

  function scanStatus(msg, kind) {
    els.scanStatus.textContent = msg || '';
    els.scanStatus.dataset.kind = kind || '';
  }

  function paintScanPanel() {
    const hasDir = Boolean(state.dirHandle || state.dirName);
    els.scanAgain.hidden = !hasDir;
    els.scanForget.hidden = !(state.source === 'scan' || state.source === 'cache');
    els.scanPick.hidden = !VLC.registry.canPick;
    els.scanServer.hidden = !isFileProtocol();
    if (state.dirName) scanStatus(t('scan.last', { name: state.dirName }), 'ok');
  }

  function openScanPanel() {
    els.scanPanel.hidden = false;
    document.body.classList.add('is-locked');
    paintScanPanel();
    (VLC.registry.canPick ? els.scanPick : els.scanDrop).focus();
  }
  function closeScanPanel() {
    els.scanPanel.hidden = true;
    document.body.classList.remove('is-locked');
  }

  async function scanWith(dir) {
    state.dirHandle = dir;
    scanStatus(t('scan.reading'), 'busy');
    const data = await VLC.registry.scanHandle(dir);
    data.dirName = dir.name || '';
    applyScan(data);
    await refresh();
    closeScanPanel();
    toast(t('scan.done', { n: state.counts.labs, p: state.counts.pages }));
  }

  async function pickFolder() {
    if (!VLC.registry.canPick) {
      scanStatus(t('scan.noApi'), 'warn');
      return;
    }
    try {
      const dir = await window.showDirectoryPicker({ mode: 'read', id: 'virtual-lab-center-root' });
      await scanWith(dir);
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      scanStatus(t('scan.err') + ' ' + (e && e.message ? e.message : ''), 'warn');
    }
  }

  async function rescanSameDir() {
    const dir = state.dirHandle;
    if (!dir) {
      openScanPanel();
      return;
    }
    try {
      if (typeof dir.queryPermission === 'function') {
        let perm = await dir.queryPermission({ mode: 'read' });
        if (perm !== 'granted') perm = await dir.requestPermission({ mode: 'read' });
        if (perm !== 'granted') {
          scanStatus(t('scan.noPerm'), 'warn');
          return;
        }
      }
      await scanWith(dir);
    } catch (e) {
      scanStatus(t('scan.err') + ' ' + (e && e.message ? e.message : ''), 'warn');
    }
  }

  function forgetDir() {
    state.manual = null;
    state.dirHandle = null;
    state.dirName = '';
    VLC.registry.clear();
    closeScanPanel();
    refresh();
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

    const crumbs = [];
    const sep = () => {
      const i = document.createElement('i');
      i.textContent = '/';
      return i;
    };

    if (found && found.lab && found.lab.areaId) {
      const area = state.areas.find((a) => a.id === found.lab.areaId);
      const el = document.createElement('span');
      el.className = 'crumbs__area';
      el.textContent = pick(area ? area.title : found.lab.area) || found.lab.areaId;
      crumbs.push(el);
    }
    // la portada de una carpeta ya lleva el nombre de la práctica: no se repite
    if (found && found.lab && !isMainPage(found.page, found.lab)) {
      const el = document.createElement('span');
      el.textContent = pick(found.lab.title) || found.lab.id;
      crumbs.push(el);
    }

    const cur = document.createElement('b');
    cur.className = 'crumbs__ch';
    cur.textContent = title;

    els.crumbs.appendChild(home);
    crumbs.forEach((el) => {
      els.crumbs.appendChild(sep());
      els.crumbs.appendChild(el);
    });
    els.crumbs.appendChild(sep());
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

    if (found && found.lab) {
      state.folders.add(found.lab.id);
      if (found.lab.areaId) state.folders.add('area:' + found.lab.areaId);
    }
  }

  function openLab(path) {
    state.current = path;
    els.stageFallback.hidden = true;
    const url = path + '?__vlc=' + Date.now();
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
      if (state.source === 'api' || state.source === 'manifest') {
        await refresh();
        toast(t('toast.rescan', { n: state.counts.labs, p: state.counts.pages }));
        return;
      }
      if (state.dirHandle) {
        await rescanSameDir();
        return;
      }
      openScanPanel();
    });

    els.indexSource.addEventListener('click', openScanPanel);
    els.scanClose.addEventListener('click', closeScanPanel);
    els.scanPanel.addEventListener('click', (e) => {
      if (e.target === els.scanPanel) closeScanPanel();
    });
    els.scanPick.addEventListener('click', pickFolder);
    els.scanAgain.addEventListener('click', rescanSameDir);
    els.scanForget.addEventListener('click', forgetDir);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.scanPanel.hidden) closeScanPanel();
    });

    /* soltar la carpeta del proyecto en cualquier parte de la página */
    let dragDepth = 0;
    window.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') === -1) return;
      dragDepth++;
      document.body.classList.add('is-dropping');
    });
    window.addEventListener('dragover', (e) => {
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) document.body.classList.remove('is-dropping');
    });
    window.addEventListener('drop', async (e) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      dragDepth = 0;
      document.body.classList.remove('is-dropping');

      const items = Array.prototype.slice.call(e.dataTransfer.items || []);
      let entry = null;
      for (const it of items) {
        if (it.kind !== 'file') continue;
        if (typeof it.webkitGetAsEntry === 'function') {
          entry = it.webkitGetAsEntry();
          if (entry) break;
        }
      }
      if (!entry) {
        openScanPanel();
        scanStatus(t('scan.noDrop'), 'warn');
        return;
      }
      if (!entry.isDirectory) {
        openScanPanel();
        scanStatus(t('scan.notDir'), 'warn');
        return;
      }
      if (!els.scanPanel.hidden) scanStatus(t('scan.reading'), 'busy');
      else openScanPanel();
      try {
        const data = await VLC.registry.scanEntry(entry);
        data.dirName = entry.name || '';
        applyScan(data);
        await refresh();
        closeScanPanel();
        toast(t('scan.done', { n: state.counts.labs, p: state.counts.pages }));
      } catch (err) {
        scanStatus(t('scan.err') + ' ' + (err && err.message ? err.message : ''), 'warn');
      }
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
    const { data, source } = await loadRegistry();
    const manifest = VLC.registry.normalise(data);
    state.manifest = manifest;
    state.source = data ? source : 'none';
    state.labs = manifest.labs;
    state.loose = manifest.loose;
    state.areas = manifest.areas;
    state.counts = manifest.counts;
    paintCounts();
    paintTree();
    if (els.scanPanel && !els.scanPanel.hidden) paintScanPanel();
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
