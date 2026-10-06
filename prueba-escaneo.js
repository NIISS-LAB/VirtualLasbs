/* Prueba del escaneo en el navegador (sin servidor) contra un árbol simulado
   que refleja la estructura real del root. Ejecutar:  node prueba-escaneo.js */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

/* --- simular el sistema de archivos que devuelve el navegador ------------ */
const real = new Map();

function readTree(dirAbs, node) {
  const key = dirAbs.replace(/\\/g, '/');
  const dirs = {};
  const files = [];
  Object.keys(node).forEach((k) => {
    if (node[k] && typeof node[k] === 'object') dirs[k] = node[k];
    else files.push(k);
  });
  real.set(key, { files, dirs });
  for (const d of Object.keys(dirs)) readTree(path.join(dirAbs, d), dirs[d]);
}

// el nodo 'assets' se ignora, y también las carpetas que empiezan por '_'
readTree(ROOT, {
  'index.html': 'landing',
  'manifest.json': '{}',
  'assets': { 'js': { 'app.js': 'x' } },
  'ELECTRICIDAD': {
    'area.json': fs.readFileSync(path.join(ROOT, 'ELECTRICIDAD', 'area.json'), 'utf8'),
    'assets': { 'css': { 'app.css': 'copia' } },
    'circuitos-ohm': {
      'index.html': 'x',
      'fundamentos.html': 'x',
      'lab.json': fs.readFileSync(path.join(ROOT, 'ELECTRICIDAD', 'circuitos-ohm', 'lab.json'), 'utf8'),
    },
    'osciloscopio-rc': {
      'index.html': 'x',
      'lab.json': fs.readFileSync(path.join(ROOT, 'ELECTRICIDAD', 'osciloscopio-rc', 'lab.json'), 'utf8'),
    },
    'guia-taller': {
      'index.html': 'x',
      'protocolo.html': 'x',
      'materiales.html': 'x',
      'lab.json': fs.readFileSync(path.join(ROOT, 'ELECTRICIDAD', 'guia-taller', 'lab.json'), 'utf8'),
    },
    'LV-TRNASFORMADOR': {
      'LV-transformadores.html': 'x',
      'lab.json': fs.readFileSync(path.join(ROOT, 'ELECTRICIDAD', 'LV-TRNASFORMADOR', 'lab.json'), 'utf8'),
    },
  },
  'MECANICA': { 'area.json': fs.readFileSync(path.join(ROOT, 'MECANICA', 'area.json'), 'utf8') },
  '_oculto': { 'index.html': 'x' },
});

function handleFor(absDir) {
  const key = absDir.replace(/\\/g, '/');
  const node = real.get(key);
  if (!node) throw new Error('sin nodo para ' + key);
  return {
    kind: 'directory',
    name: path.basename(key),
    async *values() {
      // el navegador entrega manejadores, no pares [nombre, manejador]
      for (const d of Object.keys(node.dirs).sort()) {
        yield handleFor(path.join(key, d));
      }
      for (const f of node.files.slice().sort()) {
        yield {
          kind: 'file',
          name: f,
          async getFile() {
            return { async text() { return fs.readFileSync(path.join(key, f), 'utf8'); } };
          },
        };
      }
    },
    async getFileHandle(name) {
      if (node.files.indexOf(name) === -1) throw new Error('no existe');
      return {
        kind: 'file',
        name,
        async getFile() {
          return { async text() { return fs.readFileSync(path.join(key, name), 'utf8'); } };
        },
      };
    },
  };
}

/* --- cargar registry.js en un entorno falso ------------------------------- */
global.window = global; // window === global, para que VLC quede en el ámbito correcto
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const code = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'registry.js'), 'utf8');
// eslint-disable-next-line no-eval
(0, eval)(code);
const R = global.window.VLC.registry;

(async () => {
  const scanned = await R.scanHandle(handleFor(ROOT));
  const n = R.normalise(scanned);

  const server = R.normalise(JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')));

  console.log('--- escaneo del navegador ---');
  console.log('conteos :', JSON.stringify(n.counts));
  console.log('áreas   :', n.areas.map((a) => `${a.id} (${a.title.es}) → ${a.labs} prácticas`).join(' | '));
  n.labs.forEach((l) => {
    console.log(`  ${l.areaId || '(raíz)'} / ${l.folder}  ·  ${l.title.es}  ·  ${l.pages.length} pág  ·  main=${l.main}`);
    l.pages.forEach((p) => console.log(`      - ${p.path}  «${p.title.es}»`));
  });

  console.log('\n--- comparación con manifest.json (server.js) ---');
  const sameAreas = JSON.stringify(n.areas.map((a) => a.id)) === JSON.stringify(server.areas.map((a) => a.id));
  const samePaths = JSON.stringify(n.labs.map((l) => l.pages.map((p) => p.path))) ===
    JSON.stringify(server.labs.map((l) => l.pages.map((p) => p.path)));
  const sameTitles = JSON.stringify(n.labs.map((l) => [l.title.es, l.title.en])) ===
    JSON.stringify(server.labs.map((l) => [l.title.es, l.title.en]));
  console.log('áreas iguales  :', sameAreas);
  console.log('rutas iguales  :', samePaths);
  console.log('títulos iguales:', sameTitles);
  console.log('conteos iguales:', JSON.stringify(n.counts) === JSON.stringify(server.counts));
  process.exit(sameAreas && samePaths && sameTitles ? 0 : 1);
})().catch((e) => {
  console.error('FALLO:', e);
  process.exit(1);
});
