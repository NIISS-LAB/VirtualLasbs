/* ============================================================================
   VIRTUAL LAB CENTER — dic bilingüe (es / en)
   Uso:  VLC.t('clave')  ·  marca data-i18n en el HTML
   ========================================================================== */
window.VLC = window.VLC || {};

VLC.dict = {
  es: {
    'brand.sub': 'Laboratorios y proyectos de aula',
    'brand.by': 'Desarrollado por Dr.C. Arlys Michel Lastre Aleaga',
    'nav.back': 'Volver al índice',
    'nav.menu': 'Índice',
    'nav.open': 'Abrir en pestaña nueva',
    'nav.theme': 'Cambiar tema',
    'nav.lang': 'Idioma',

    'hero.lead': 'Centro de laboratorios virtuales',
    'cta.index': 'Abrir el índice',
    'cta.first': 'Abrir la primera práctica',
    'cta.external': 'Abrir en pestaña nueva',

    'stat.labs': 'prácticas',
    'stat.pages': 'pantallas',
    'stat.areas': 'áreas',
    'stat.last': 'índice leído',

    'index.title': 'Índice de prácticas',
    'index.hint': 'leyendo el root…',
    'index.rescan': 'Releer carpetas',
    'index.search': 'Buscar práctica, área o archivo',
    'index.allareas': 'Todas las áreas',
    'index.source': '{n} carpetas · {p} pantallas leídas del root',
    'index.source.api': '{n} carpetas · {p} pantallas leídas del root',
    'index.source.manifest': 'índice leído de manifest.json',
    'index.source.embedded': 'registro incrustado (assets/js/labs.js)',
    'index.source.cache': 'último escaneo guardado en este navegador',
    'index.source.scan': 'carpetas leídas en este navegador',
    'index.source.none': 'aún sin índice: escanea la carpeta',
    'index.sourceHelp': 'Origen del índice. Pulsa para elegir o volver a leer las carpetas.',
    'index.group': 'Laboratorios',
    'index.loose': 'Páginas del root',
    'index.emptyArea': 'Sin prácticas todavía: añade una carpeta dentro.',
    'index.folder': 'carpeta',
    'index.cover': 'Portada',
    'index.main': 'principal',
    'index.open': 'abrir',
    'index.collapse': 'Contraer todo',
    'index.expand': 'Desplegar todo',

    'empty.title': 'No hay prácticas todavía',
    'empty.body':
      'El índice se construye con lo que hay en el root. Crea una carpeta con un index.html y aparecerá aquí en el árbol, junto a las demás.',
    'empty.filter': 'Ninguna práctica coincide con la búsqueda.',
    'empty.filterBtn': 'Quitar filtros',
    'empty.note':
      'Todo esto funciona sin ejecutar nada: el navegador puede leer la carpeta del proyecto directamente. Si prefieres el modo automático, <b>INICIAR.cmd</b> arranca el servidor y abre el navegador.',

    'scan.eyebrow': 'Sin servidor',
    'scan.title': 'El índice se arma con tus carpetas',
    'scan.body': 'Elige la carpeta raíz del proyecto y el centro leerá dentro todas las prácticas y páginas. No hace falta ejecutar nada: todo ocurre en este navegador.',
    'scan.close': 'Cerrar',
    'scan.dropTitle': 'Suelta aquí la carpeta del proyecto',
    'scan.dropBody': 'o pulsa el botón de abajo para buscarla en el disco',
    'scan.pick': 'Buscar la carpeta del proyecto',
    'scan.rescan': 'Releer esa carpeta',
    'scan.forget': 'Olvidar carpeta',
    'scan.reading': 'Leyendo las carpetas…',
    'scan.done': 'Índice armado: {n} prácticas, {p} pantallas.',
    'scan.last': 'Última carpeta leída: {name}',
    'scan.noApi': 'Tu navegador no permite elegir carpetas. Arrastra la carpeta del proyecto sobre esta ventana.',
    'scan.noDrop': 'Suelta una carpeta, no un archivo suelto.',
    'scan.notDir': 'Eso no es una carpeta. Suelta la carpeta raíz del proyecto.',
    'scan.noPerm': 'El navegador necesita permiso de lectura para esa carpeta.',
    'scan.err': 'No se pudo leer la carpeta:',
    'scan.note':
      '¿Prefieres el modo automático? <b>INICIAR.cmd</b> arranca el servidor y abre el navegador; el índice se relee en cada visita sin tocar nada.',
    'scan.serverOpen': 'Abrir la versión con servidor',

    'stage.blocked': 'El navegador no permitió incrustar esta página.',
    'stage.copy': 'Copiar la ruta de esta página',
    'stage.loading': 'Cargando',

    'toast.rescan': 'Índice releído: {n} prácticas, {p} pantallas.',
    'toast.theme.dark': 'Tema oscuro',
    'toast.theme.light': 'Tema claro',
    'toast.lang': 'Idioma: English',
    'toast.copy': 'Ruta copiada al portapapeles',
    'toast.same': 'Ya estás en el índice',

    'a11y.tree': 'Índice de prácticas',
    'a11y.breadcrumb': 'Ruta de la práctica abierta',
  },

  en: {
    'brand.sub': 'Virtual labs and class projects',
    'brand.by': 'Developed by Dr.C. Arlys Michel Lastre Aleaga',
    'nav.back': 'Back to index',
    'nav.menu': 'Index',
    'nav.open': 'Open in new tab',
    'nav.theme': 'Switch theme',
    'nav.lang': 'Language',

    'hero.lead': 'Virtual lab center',
    'cta.index': 'Open the index',
    'cta.first': 'Open the first lab',
    'cta.external': 'Open in new tab',

    'stat.labs': 'labs',
    'stat.pages': 'screens',
    'stat.areas': 'areas',
    'stat.last': 'index read at',

    'index.title': 'Lab index',
    'index.hint': 'reading the root…',
    'index.rescan': 'Re-scan folders',
    'index.search': 'Search lab, area or file',
    'index.allareas': 'All areas',
    'index.source': '{n} folders · {p} screens read from the root',
    'index.source.api': '{n} folders · {p} screens read from the root',
    'index.source.manifest': 'index read from manifest.json',
    'index.source.embedded': 'embedded registry (assets/js/labs.js)',
    'index.source.cache': 'last scan saved in this browser',
    'index.source.scan': 'folders read in this browser',
    'index.source.none': 'no index yet: scan the folder',
    'index.sourceHelp': 'Index source. Click to choose or re-read the folders.',
    'index.group': 'Labs',
    'index.loose': 'Root pages',
    'index.emptyArea': 'No labs yet: add a folder inside.',
    'index.folder': 'folder',
    'index.cover': 'Overview',
    'index.main': 'main',
    'index.open': 'open',
    'index.collapse': 'Collapse all',
    'index.expand': 'Expand all',

    'empty.title': 'No labs yet',
    'empty.body':
      'The index is made of whatever sits in the root. Create a folder with an index.html and it will appear in the tree next to the others.',
    'empty.filter': 'No lab matches this search.',
    'empty.filterBtn': 'Clear filters',
    'empty.note':
      'All of this works without running anything: the browser can read the project folder directly. If you prefer the automatic mode, run <b>INICIAR.cmd</b> — it starts the server and opens the browser.',

    'scan.eyebrow': 'No server',
    'scan.title': 'The index is built from your folders',
    'scan.body': 'Choose the project root folder and the center will read every lab and page inside it. Nothing to run: it all happens in this browser.',
    'scan.close': 'Close',
    'scan.dropTitle': 'Drop the project folder here',
    'scan.dropBody': 'or use the button below to find it on disk',
    'scan.pick': 'Find the project folder',
    'scan.rescan': 'Re-read that folder',
    'scan.forget': 'Forget folder',
    'scan.reading': 'Reading the folders…',
    'scan.done': 'Index built: {n} labs, {p} screens.',
    'scan.last': 'Last folder read: {name}',
    'scan.noApi': 'Your browser cannot pick folders. Drag the project folder onto this window.',
    'scan.noDrop': 'Drop a folder, not a single file.',
    'scan.notDir': 'That is not a folder. Drop the project root folder.',
    'scan.noPerm': 'The browser needs read permission for that folder.',
    'scan.err': 'The folder could not be read:',
    'scan.note':
      'Prefer the automatic mode? <b>INICIAR.cmd</b> starts the server and opens the browser; the index is re-read on every visit.',
    'scan.serverOpen': 'Open the server version',

    'stage.blocked': 'The browser refused to embed this page.',
    'stage.copy': 'Copy the path of this page',
    'stage.loading': 'Loading',

    'toast.rescan': 'Index re-scanned: {n} labs, {p} screens.',
    'toast.theme.dark': 'Dark theme',
    'toast.theme.light': 'Light theme',
    'toast.lang': 'Language: Spanish',
    'toast.copy': 'Path copied to clipboard',
    'toast.same': 'Already at the index',

    'a11y.tree': 'Lab index',
    'a11y.breadcrumb': 'Path of the open lab',
  },
};

VLC.lang = (function () {
  const saved = localStorage.getItem('vlc-lang');
  if (saved === 'es' || saved === 'en') return saved;
  return (navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es';
})();

VLC.t = function (key, vars) {
  const table = VLC.dict[VLC.lang] || VLC.dict.es;
  let out = table[key];
  if (out === undefined) out = VLC.dict.es[key];
  if (out === undefined) return key;
  if (vars) {
    for (const k in vars) out = out.split('{' + k + '}').join(vars[k]);
  }
  return out;
};

/** Sustituye el texto de todo lo marcado dentro de root. */
VLC.applyI18n = function (root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    el.innerHTML = VLC.t(el.getAttribute('data-i18n'));
  });
  scope.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', VLC.t(el.getAttribute('data-i18n-ph')));
  });
  scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', VLC.t(el.getAttribute('data-i18n-aria')));
  });
};
