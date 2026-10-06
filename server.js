/**
 * VIRTUAL LAB CENTER — servidor sin dependencias (opcional).
 *
 * El sitio funciona sin este archivo: index.html lee las carpetas del proyecto
 * desde el propio navegador (botón "Buscar la carpeta" o arrastrándola encima)
 * y, si existe, el registro incrustado en assets/js/labs.js.
 *
 * Cuando sí se ejecuta, aporta:
 *   · servir por http://localhost:5173 con el índice vivo en /api/labs
 *   · regenerar manifest.json y assets/js/labs.js
 *
 * Uso:  node server.js  [--port 5173] [--no-write] [--no-open]
 *        INICIAR.cmd lo arranca y abre el navegador en un doble clic.
 */

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const ROOT = __dirname;
const MANIFEST = path.join(ROOT, 'manifest.json');
const EMBEDDED = path.join(ROOT, 'assets', 'js', 'labs.js');

const IGNORED_DIRS = new Set(['assets', 'node_modules', '.git', '.vscode', 'dist', 'build']);
const IGNORED_FILES = new Set(['manifest.json', 'package.json', 'package-lock.json', 'server.js']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

/* ------------------------------------------------------------------ utils */

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

/** "circuitos-ohm" -> "Circuitos Ohm" */
function prettify(slug) {
  if (!slug) return '';
  const cleaned = String(slug)
    .replace(/\.(html?|htm)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

const asPair = (es, en, fallbackEs, fallbackEn) => ({
  es: es || fallbackEs || '',
  en: en || fallbackEn || es || fallbackEs || '',
});

async function readJSON(file) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function listHTML(dir, depth = 0) {
  if (depth > 3) return [];
  let entries = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth === 0 && IGNORED_DIRS.has(e.name.toLowerCase())) continue;
      out.push(...(await listHTML(full, depth + 1)));
    } else if (/\.html?$/i.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

/** solo los .html que están justo en esa carpeta */
async function htmlFilesIn(dir) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && !e.name.startsWith('.') && !e.name.startsWith('_') && /\.html?$/i.test(e.name))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

async function subDirs(dir) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_') && !IGNORED_DIRS.has(e.name.toLowerCase()))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/** arma una práctica (grupo de páginas) con sus metadatos */
async function buildLab(folder, dir, files, areaId) {
  const meta = (await readJSON(path.join(dir, 'lab.json'))) || {};
  const pages = [];
  for (const f of files) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    const name = path.basename(f);
    const pageMeta = meta.pages && meta.pages[name] ? meta.pages[name] : null;
    const title = pageMeta && pageMeta.title ? pageMeta.title : prettify(name);
    pages.push({
      path: rel,
      file: name,
      title: asPair(title.es || title, title.en, prettify(name.replace(/\.html?$/i, '')), prettify(name.replace(/\.html?$/i, ''))),
      summary: asPair(
        pageMeta && pageMeta.summary ? pageMeta.summary.es || pageMeta.summary : '',
        pageMeta && pageMeta.summary ? pageMeta.summary.en || pageMeta.summary : '',
        '',
        ''
      ),
    });
  }
  if (!pages.length) return null;

  // index.html primero: es la portada de la carpeta.
  pages.sort((a, b) => {
    const ai = a.file.toLowerCase() === 'index.html' ? 0 : 1;
    const bi = b.file.toLowerCase() === 'index.html' ? 0 : 1;
    return ai - bi || a.path.localeCompare(b.path);
  });

  const area = asPair(
    meta.area && meta.area.es ? meta.area.es : areaId ? prettify(areaId) : prettify(folder),
    meta.area && meta.area.en ? meta.area.en : undefined,
    areaId ? prettify(areaId) : prettify(folder),
    areaId ? prettify(areaId) : prettify(folder)
  );
  const title = asPair(
    meta.title && meta.title.es ? meta.title.es : prettify(folder),
    meta.title && meta.title.en ? meta.title.en : undefined,
    prettify(folder),
    prettify(folder)
  );

  return {
    id: folder,
    folder,
    areaId: areaId || '',
    main: pages[0].path,
    order: typeof meta.order === 'number' ? meta.order : 999,
    icon: meta.icon || '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    title,
    area,
    summary: asPair(
      meta.summary && meta.summary.es ? meta.summary.es : '',
      meta.summary && meta.summary.en ? meta.summary.en : '',
      `${pages.length} página${pages.length === 1 ? '' : 's'} disponible${pages.length === 1 ? '' : 's'}`,
      `${pages.length} page${pages.length === 1 ? '' : 's'} available`
    ),
    pages,
  };
}

/* ------------------------------------------------------------- discovery  */

async function buildManifest() {
  let entries = [];
  try {
    entries = await fsp.readdir(ROOT, { withFileTypes: true });
  } catch (err) {
    console.error('No se pudo leer el root:', err.message);
  }

  const labs = [];
  const areas = [];

  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
    if (IGNORED_DIRS.has(e.name.toLowerCase())) continue;

    const dir = path.join(ROOT, e.name);

    // ¿la carpeta es una práctica (tiene HTML propios) o un área de prácticas?
    const direct = await htmlFilesIn(dir);
    if (direct.length) {
      const lab = await buildLab(e.name, dir, direct, '');
      if (lab) labs.push(lab);
      continue;
    }

    // sin HTML propio: es un área, y dentro viven las prácticas
    const children = await subDirs(dir);
    let inside = 0;
    for (const child of children) {
      const childDir = path.join(dir, child);
      const files = await listHTML(childDir);
      const lab = await buildLab(child, childDir, files, e.name);
      if (lab) {
        inside++;
        labs.push(lab);
      }
    }

    const meta = (await readJSON(path.join(dir, 'area.json'))) || {};
    areas.push({
      id: e.name,
      folder: e.name,
      order: typeof meta.order === 'number' ? meta.order : 999,
      title: asPair(
        meta.title && meta.title.es ? meta.title.es : prettify(e.name),
        meta.title && meta.title.en ? meta.title.en : undefined,
        prettify(e.name),
        prettify(e.name)
      ),
      labs: inside,
    });
  }

  // HTML sueltos en el root (excluyendo index.html de la landing).
  const loose = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
    if (!/\.html?$/i.test(e.name)) continue;
    if (e.name.toLowerCase() === 'index.html') continue;
    if (IGNORED_FILES.has(e.name.toLowerCase())) continue;
    const meta = await readJSON(path.join(ROOT, e.name.replace(/\.html?$/i, '.json')));
    const title = meta && meta.title ? meta.title : prettify(e.name);
    loose.push({
      path: e.name,
      file: e.name,
      title: asPair(title.es || title, title.en, title, title),
      summary: asPair('', '', '', ''),
    });
  }

  labs.sort((a, b) => a.order - b.order || a.folder.localeCompare(b.folder));
  areas.sort((a, b) => a.order - b.order || a.folder.localeCompare(b.folder));

  return {
    center: 'Virtual Lab Center',
    version: 2,
    generated: new Date().toISOString(),
    source: flag('--no-write') ? 'memory' : 'filesystem',
    counts: {
      labs: labs.length,
      pages: labs.reduce((n, l) => n + l.pages.length, 0) + loose.length,
      areas: areas.length,
    },
    areas,
    labs,
    pages: loose,
  };
}

/** escribe manifest.json y el registro incrustado que carga index.html */
async function writeRegistry(manifest) {
  if (flag('--no-write')) return;
  const json = JSON.stringify(manifest, null, 2);
  await fsp.writeFile(MANIFEST, json, 'utf8');
  const slim = {
    areas: manifest.areas || [],
    labs: manifest.labs,
    loose: manifest.pages || manifest.loose || [],
    generated: manifest.generated,
  };
  const js =
    '/* Registro del centro Virtual Lab Center.\n' +
    '   Generado por server.js — no hace falta editarlo a mano.\n' +
    '   Se usa cuando index.html se abre directamente con doble clic (file://),\n' +
    '   donde el navegador no puede leer carpetas por sí solo. */\n' +
    'window.VLC_REGISTRY = ' +
    JSON.stringify(slim, null, 2) +
    ';\n';
  await fsp.mkdir(path.dirname(EMBEDDED), { recursive: true });
  await fsp.writeFile(EMBEDDED, js, 'utf8');
}

let cache = null;
async function getManifest() {
  if (!cache) cache = await buildManifest();
  return cache;
}

/* ------------------------------------------------------------ http server */

function sendJSON(res, code, body) {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

async function serveFile(req, res, pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  let target = path.resolve(ROOT, rel);

  // Nada fuera del root.
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 — fuera del root del sitio');
  }

  let stat = null;
  try {
    stat = await fsp.stat(target);
  } catch {
    /* handled below */
  }

  if (stat && stat.isDirectory()) {
    const index = path.join(target, 'index.html');
    try {
      stat = await fsp.stat(index);
      target = index;
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(
        `<!doctype html><meta charset="utf-8"><title>404</title>` +
          `<body style="font:16px/1.6 system-ui;padding:3rem;max-width:40rem;margin:auto">` +
          `<h1>404 — ${rel}</h1><p>La carpeta existe pero no tiene un <code>index.html</code>.</p>` +
          `<p><a href="/">Volver a Virtual Lab Center</a></p>`
      );
    }
  }

  if (!stat || !stat.isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(
      `<!doctype html><meta charset="utf-8"><title>404</title>` +
        `<body style="font:16px/1.6 system-ui;padding:3rem;max-width:40rem;margin:auto">` +
        `<h1>404 — ${rel}</h1><p>Ese archivo no está en el root.</p>` +
        `<p><a href="/">Volver a Virtual Lab Center</a></p>`
    );
  }

  const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(target).pipe(res);
}

const server = http.createServer(async (req, res) => {
  let pathname = '/';
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch (e) {
    pathname = '/';
  }

  try {
    if (pathname === '/api/labs' || pathname === '/api/manifest.json') {
      cache = null; // re-escanea en cada consulta: añadir una carpeta se ve al instante
      const manifest = await getManifest();
      return sendJSON(res, 200, manifest);
    }
    if (pathname === '/api/refresh') {
      cache = await buildManifest();
      await writeRegistry(cache);
      return sendJSON(res, 200, { ok: true, counts: cache.counts });
    }
    if (pathname === '/manifest.json') {
      cache = cache || (await buildManifest());
      await writeRegistry(cache);
      return sendJSON(res, 200, cache);
    }
    return await serveFile(req, res, pathname);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('500 — ' + err.message);
  }
});

let port = Number(opt('--port', process.env.PORT || 5173));

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    port += 1;
    if (port > 5183) {
      console.error('No hay puertos libres entre 5173 y 5183.');
      process.exit(1);
    }
    console.log(`Puerto ocupado, usando ${port}…`);
    server.listen(port);
    return;
  }
  throw err;
});

server.listen(port, async () => {
  const manifest = await getManifest();
  await writeRegistry(manifest);
  const c = manifest.counts;
  console.log('');
  console.log('  VIRTUAL LAB CENTER');
  console.log(`  http://localhost:${port}`);
  console.log(`  ${c.labs} carpeta(s) · ${c.pages} página(s) · ${c.areas} área(s) detectadas`);
  if (!flag('--no-write')) console.log('  manifest.json y assets/js/labs.js actualizados');
  console.log('  Ctrl+C para detener.');
  console.log('');
  if (!flag('--no-open')) {
    const opener =
      process.platform === 'win32' ? `start "" "http://localhost:${port}"`
        : process.platform === 'darwin' ? `open "http://localhost:${port}"`
        : `xdg-open "http://localhost:${port}"`;
    require('child_process').exec(opener, () => {});
  }
});
