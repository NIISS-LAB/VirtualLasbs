/* ============================================================================
   VIRTUAL LAB CENTER — dic bilingüe (es / en)
   Uso:  VLC.t('clave')  ·  marca data-i18n en el HTML
   ========================================================================== */
window.VLC = window.VLC || {};

VLC.dict = {
  es: {
    'brand.sub': 'Laboratorios y proyectos de aula',
    'nav.back': 'Volver al índice',
    'nav.menu': 'Índice',
    'nav.open': 'Abrir en pestaña nueva',
    'nav.theme': 'Cambiar tema',
    'nav.lang': 'Idioma',

    'hero.lead': 'Centro de laboratorios virtuales',
    'hero.text':
      'Cada carpeta del root es una práctica y cada página HTML dentro de ella es una pantalla. El índice se arma solo: copia tu carpeta al root y aparece aquí con su título, su área y su ficha.',
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
    'index.source.manifest': 'índice leído de manifest.json',
    'index.source.none': 'root sin índice: ejecuta node server.js',
    'index.group': 'Laboratorios',
    'index.loose': 'Páginas del root',
    'index.folder': 'carpeta',
    'index.main': 'principal',
    'index.open': 'abrir',
    'index.collapse': 'Contraer todo',
    'index.expand': 'Desplegar todo',

    'empty.title': 'No hay prácticas todavía',
    'empty.body':
      'El índice se construye con lo que hay en el root. Crea una carpeta con un index.html y aparecerá aquí en el árbol, junto a las demás.',
    'empty.filter': 'Ninguna práctica coincide con la búsqueda.',
    'empty.filterBtn': 'Quitar filtros',
    'empty.server':
      'No se pudo leer el índice. Si abriste el sitio con doble clic, ejecuta <code>node server.js</code> para que lea las carpetas del root, o revisa el manifest.json.',

    'foot.note': 'Estructura esperada en el root',
    'foot.arrow': 'aparece en el árbol',
    'foot.lang': 'interfaz bilingüe',
    'foot.theme': 'tema claro y oscuro',

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
    'nav.back': 'Back to index',
    'nav.menu': 'Index',
    'nav.open': 'Open in new tab',
    'nav.theme': 'Switch theme',
    'nav.lang': 'Language',

    'hero.lead': 'Virtual lab center',
    'hero.text':
      'Every folder in the root is a lab, and every HTML page inside it is a screen. The index builds itself: drop your folder into the root and it shows up here with its title, its area and its card.',
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
    'index.source.manifest': 'index read from manifest.json',
    'index.source.none': 'no index in root: run node server.js',
    'index.group': 'Labs',
    'index.loose': 'Root pages',
    'index.folder': 'folder',
    'index.main': 'main',
    'index.open': 'open',
    'index.collapse': 'Collapse all',
    'index.expand': 'Expand all',

    'empty.title': 'No labs yet',
    'empty.body':
      'The index is made of whatever sits in the root. Create a folder with an index.html and it will appear in the tree next to the others.',
    'empty.filter': 'No lab matches this search.',
    'empty.filterBtn': 'Clear filters',
    'empty.server':
      'The index could not be read. If you opened the site with a double click, run <code>node server.js</code> so it can scan the root folders, or check manifest.json.',

    'foot.note': 'Expected structure in the root',
    'foot.arrow': 'shows up in the tree',
    'foot.lang': 'bilingual interface',
    'foot.theme': 'light and dark themes',

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
