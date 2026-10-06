/* ============================================================================
   VIRTUAL LAB CENTER — registro y escaneo de carpetas
   ---------------------------------------------------------------------------
   Permite construir el índice SIN servidor: el navegador recorre la carpeta
   del proyecto y devuelve exactamente la misma estructura que produce
   server.js. Dos vías disponibles, ambas en el navegador:

     1. showDirectoryPicker()  — botón "Buscar la carpeta del proyecto"
     2. arrastrar y soltar     — webkitGetAsEntry(), funciona en todos

   Estructura canónica (idéntica a manifest.json):
     { labs: [{ id, folder, main, order, tags, title:{es,en}, area:{es,en},
               summary:{es,en}, pages:[{ path, file, title:{es,en}, summary:{es,en} }] }],
       loose: [{ path, file, title:{es,en} }], generated }
   ========================================================================== */
window.VLC = window.VLC || {};

VLC.registry = (function () {
  const SKIP_DIRS = new Set(['assets', 'node_modules', '.git', '.vscode', '.idea', 'dist', 'build']);
  const SKIP_PREFIX = ['.', '_'];
  const MAX_DEPTH = 3;
  const STORE = 'vlc-registry';

  /* ------------------------------------------------------------ helpers -- */
  const prettify = (slug) => {
    if (!slug) return '';
    const clean = String(slug)
      .replace(/\.(html?|htm)$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : '';
  };

  const pair = (es, en, fallbackEs, fallbackEn) => ({
    es: es || fallbackEs || '',
    en: en || fallbackEn || es || fallbackEs || '',
  });

  const asObject = (v) => {
    if (v && typeof v === 'object') return { es: v.es || v[''] || '', en: v.en || v[''] || '' };
    return { es: v || '', en: v || '' };
  };

  const isHtml = (name) => /\.html?$/i.test(name);
  const skipped = (name) => SKIP_PREFIX.some((p) => name.startsWith(p));

  function sortPages(pages) {
    return pages.sort((a, b) => {
      const ai = /^index\.html?$/i.test(a.file) ? 0 : 1;
      const bi = /^index\.html?$/i.test(b.file) ? 0 : 1;
      return ai - bi || a.path.localeCompare(b.path);
    });
  }

  /** arma el grupo de una práctica a partir de sus páginas ya nombradas */
  function buildGroup(folder, meta, pages, areaId) {
    meta = meta && typeof meta === 'object' ? meta : {};
    if (!pages.length) return null;
    sortPages(pages);

    const pageMeta = meta.pages && typeof meta.pages === 'object' ? meta.pages : {};
    const list = pages.map((p) => {
      const pm = pageMeta[p.file] || pageMeta[p.path] || null;
      const tm = pm && pm.title ? asObject(pm.title) : null;
      const sm = pm && pm.summary ? asObject(pm.summary) : null;
      return {
        path: p.path,
        file: p.file,
        title: tm || pair(null, null, prettify(p.file.replace(/\.html?$/i, '')), prettify(p.file.replace(/\.html?$/i, ''))),
        summary: sm || { es: '', en: '' },
      };
    });

    const name = prettify(folder);
    const areaName = meta.area ? asObject(meta.area) : null;
    const title = meta.title ? asObject(meta.title) : null;
    const summary = meta.summary ? asObject(meta.summary) : null;

    return {
      id: folder,
      folder: folder,
      areaId: areaId || '',
      main: list[0].path,
      order: typeof meta.order === 'number' ? meta.order : 999,
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      title: title || pair(null, null, name, name),
      area: areaName || pair(null, null, areaId ? prettify(areaId) : name, areaId ? prettify(areaId) : name),
      summary:
        summary ||
        pair(
          null,
          null,
          list.length + (list.length === 1 ? ' página disponible' : ' páginas disponibles'),
          list.length + (list.length === 1 ? ' page available' : ' pages available')
        ),
      pages: list,
    };
  }

  function assemble(areas, groups, loose) {
    groups.sort((a, b) => a.order - b.order || a.folder.localeCompare(b.folder));
    areas.sort((a, b) => a.order - b.order || a.folder.localeCompare(b.folder));
    loose.sort((a, b) => a.path.localeCompare(b.path));
    return {
      areas,
      labs: groups,
      loose,
      generated: new Date().toISOString(),
      source: 'browser',
    };
  }

  /** ¿esta carpeta tiene HTML propios? si no, es un área */
  function areaFromMeta(meta, folder, labs) {
    const m = meta && typeof meta === 'object' ? meta : {};
    return {
      id: folder,
      folder: folder,
      order: typeof m.order === 'number' ? m.order : 999,
      title: m.title ? asObject(m.title) : pair(null, null, prettify(folder), prettify(folder)),
      labs,
    };
  }

  /* ------------------------------------------- 1) FileSystemDirectoryHandle */
  async function listHandle(handle) {
    const out = [];
    if (handle.values) {
      for await (const entry of handle.values()) out.push([entry.name, entry]);
    } else if (handle.entries) {
      for await (const entry of handle.entries()) out.push([entry[0], entry[1]]);
    }
    return out;
  }

  async function jsonFromHandle(dir, name) {
    try {
      const fh = await dir.getFileHandle(name);
      const file = await fh.getFile();
      return JSON.parse(await file.text());
    } catch (e) {
      return null;
    }
  }

  /**
   * HTML justo en la carpeta; si no hay, se considera un área.
   * prefix mantiene la ruta completa desde la raíz del sitio:
   * una práctica suelta da "mi-lab/index.html" y dentro de un área
   * "ELECTRICIDAD/mi-lab/index.html".
   */
  async function labFromHandle(folder, handle, areaId, prefix) {
    const dir = (prefix || '') + folder + '/';
    const direct = [];
    for (const [name, h] of await listHandle(handle)) {
      if (h.kind === 'file' && isHtml(name) && !skipped(name)) direct.push({ path: dir + name, file: name });
    }
    if (direct.length) return buildGroup(folder, await jsonFromHandle(handle, 'lab.json'), direct, areaId);
    return null;
  }

  async function scanHandle(root) {
    const areas = [];
    const groups = [];
    const loose = [];
    const items = await listHandle(root);

    for (const [name, h] of items) {
      if (skipped(name)) continue;

      if (h.kind === 'file') {
        if (!isHtml(name) || /^index\.html?$/i.test(name)) continue;
        loose.push({ path: name, file: name, title: pair(null, null, prettify(name), prettify(name)) });
        continue;
      }
      if (SKIP_DIRS.has(name.toLowerCase())) continue;

      // la carpeta es una práctica si tiene HTML propios
      const asLab = await labFromHandle(name, h, '', '');
      if (asLab) {
        groups.push(asLab);
        continue;
      }

      // si no, es un área: dentro hay prácticas
      let inside = 0;
      const children = (await listHandle(h)).filter(
        ([cn, ch]) => ch.kind === 'directory' && !skipped(cn) && !SKIP_DIRS.has(cn.toLowerCase())
      );
      for (const [cn, ch] of children) {
        const lab = await labFromHandle(cn, ch, name, name + '/');
        if (lab) {
          inside++;
          groups.push(lab);
        }
      }
      areas.push(areaFromMeta(await jsonFromHandle(h, 'area.json'), name, inside));
    }
    return assemble(areas, groups, loose);
  }

  /* --------------------------------------- 2) arrastrar y soltar (entries) */
  function readEntries(reader) {
    return new Promise((resolve) => {
      const all = [];
      const step = () =>
        reader.readEntries((batch) => {
          if (!batch.length) return resolve(all);
          all.push(...batch);
          step();
        }, () => resolve(all));
      step();
    });
  }

  function fileText(entry) {
    return new Promise((resolve) => {
      if (!entry || typeof entry.file !== 'function') return resolve('');
      entry.file((f) => {
        f.text().then(resolve, () => resolve(''));
      }, () => resolve(''));
    });
  }

  async function jsonFromEntry(fileEntry) {
    const text = await fileText(fileEntry);
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  /** busca area.json / lab.json entre los hijos directos de una carpeta */
  async function metaInEntry(dirEntry, fileName) {
    try {
      const kids = await readEntries(dirEntry.createReader());
      const found = kids.find((k) => fileName && k.isFile && new RegExp('^' + fileName + '$', 'i').test(k.name));
      return found ? jsonFromEntry(found) : null;
    } catch (e) {
      return null;
    }
  }

  async function pagesInEntry(dir, prefix, depth, acc) {
    const reader = dir.createReader();
    const entries = await readEntries(reader);
    for (const entry of entries) {
      const name = entry.name;
      if (skipped(name)) continue;
      if (entry.isDirectory) {
        if (depth === 0 && SKIP_DIRS.has(name.toLowerCase())) continue;
        if (depth < MAX_DEPTH) await pagesInEntry(entry, prefix + name + '/', depth + 1, acc);
      } else if (isHtml(name)) {
        acc.push({ path: prefix + name, file: name });
      }
    }
  }

  /** HTML justo en la carpeta; si no hay, se considera un área */
  async function labFromEntry(folder, dirEntry, areaId, prefix) {
    const dir = (prefix || '') + folder + '/';
    const kids = await readEntries(dirEntry.createReader());
    const direct = kids
      .filter((k) => k.isFile && isHtml(k.name) && !skipped(k.name))
      .map((k) => ({ path: dir + k.name, file: k.name }));
    if (!direct.length) return null;
    const lj = kids.find((k) => /^lab\.json$/i.test(k.name));
    return buildGroup(folder, lj ? await jsonFromEntry(lj) : null, direct, areaId);
  }

  async function scanEntry(rootEntry) {
    const areas = [];
    const groups = [];
    const loose = [];
    const entries = await readEntries(rootEntry.createReader());

    for (const entry of entries) {
      const name = entry.name;
      if (skipped(name)) continue;

      if (entry.isFile) {
        if (!isHtml(name) || /^index\.html?$/i.test(name)) continue;
        loose.push({ path: name, file: name, title: pair(null, null, prettify(name), prettify(name)) });
        continue;
      }
      if (!entry.isDirectory) continue;
      if (SKIP_DIRS.has(name.toLowerCase())) continue;

      const asLab = await labFromEntry(name, entry, '', '');
      if (asLab) {
        groups.push(asLab);
        continue;
      }

      // área: dentro hay prácticas
      let inside = 0;
      const kids = await readEntries(entry.createReader());
      const children = kids.filter(
        (k) => k.isDirectory && !skipped(k.name) && !SKIP_DIRS.has(k.name.toLowerCase())
      );
      for (const child of children) {
        const lab = await labFromEntry(child.name, child, name, name + '/');
        if (lab) {
          inside++;
          groups.push(lab);
        }
      }
      areas.push(areaFromMeta(await metaInEntry(entry, 'area.json'), name, inside));
    }
    return assemble(areas, groups, loose);
  }

  /* -------------------------------------------------------------- cache -- */
  function save(data) {
    try {
      localStorage.setItem(STORE, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && data.labs ? data : null;
    } catch (e) {
      return null;
    }
  }
  function clear() {
    try { localStorage.removeItem(STORE); } catch (e) { /* ignorar */ }
  }

  /* ---------------------------------------------------------- normalizar - */
  /** completa lo que falte y calcula los contadores */
  function normalise(raw) {
    const areas = [];
    const labs = [];

    if (raw && Array.isArray(raw.areas)) {
      raw.areas.forEach((a) => {
        if (!a || !a.id) return;
        areas.push({
          id: a.id,
          folder: a.folder || a.id,
          order: typeof a.order === 'number' ? a.order : 999,
          title: a.title && typeof a.title === 'object' ? a.title : pair(a.title, a.title, prettify(a.id), prettify(a.id)),
          labs: typeof a.labs === 'number' ? a.labs : 0,
        });
      });
    }

    if (raw && Array.isArray(raw.labs)) {
      raw.labs.forEach((lab) => {
        const pages = (lab.pages || [])
          .filter((p) => p && p.path)
          .map((p) => ({
            path: p.path,
            file: p.file || String(p.path).split('/').pop(),
            title: p.title && typeof p.title === 'object' ? p.title : pair(p.title, p.title),
            summary: p.summary && typeof p.summary === 'object' ? p.summary : { es: p.summary || '', en: p.summary || '' },
          }));
        if (!pages.length) return;
        const folder = lab.folder || lab.id || '';
        const group = buildGroup(folder, lab, pages, lab.areaId || '');
        group.main = lab.main && pages.some((p) => p.path === lab.main) ? lab.main : group.main;
        if (typeof lab.order === 'number') group.order = lab.order;
        labs.push(group);
      });
    }

    // un área que no vino declarada pero tiene prácticas: se crea sola
    labs.forEach((lab) => {
      if (!lab.areaId) return;
      if (areas.some((a) => a.id === lab.areaId)) return;
      areas.push({
        id: lab.areaId,
        folder: lab.areaId,
        order: 999,
        title: pickAreaTitle(areas, labs, lab.areaId),
        labs: 0,
      });
    });

    const loose = [];
    if (raw && Array.isArray(raw.pages)) {
      raw.pages.forEach((p) => {
        if (!p || !p.path) return;
        loose.push({
          path: p.path,
          file: p.file || String(p.path).split('/').pop(),
          title: p.title && typeof p.title === 'object' ? p.title : pair(p.title, p.title),
          summary: { es: '', en: '' },
        });
      });
    } else if (raw && Array.isArray(raw.loose)) {
      raw.loose.forEach((p) => {
        if (!p || !p.path) return;
        loose.push({
          path: p.path,
          file: p.file || String(p.path).split('/').pop(),
          title: p.title && typeof p.title === 'object' ? p.title : pair(p.title, p.title),
          summary: { es: '', en: '' },
        });
      });
    }

    labs.sort((a, b) => a.order - b.order || a.folder.localeCompare(b.folder));
    areas.sort((a, b) => a.order - b.order || a.folder.localeCompare(b.folder));

    const pages = labs.reduce((n, l) => n + l.pages.length, 0) + loose.length;
    return {
      areas,
      labs,
      loose,
      generated: (raw && raw.generated) || '',
      counts: { labs: labs.length, pages, areas: areas.length },
    };
  }

  function pickAreaTitle(areas, labs, id) {
    const known = areas.find((a) => a.id === id);
    if (known) return known.title;
    const lab = labs.find((l) => l.areaId === id);
    if (lab && lab.area) return lab.area;
    return pair(null, null, prettify(id), prettify(id));
  }

  return {
    prettify,
    normalise,
    scanHandle,
    scanEntry,
    save,
    load,
    clear,
    get canPick() {
      return typeof window.showDirectoryPicker === 'function';
    },
    get canDrop() {
      return typeof DataTransferItem !== 'undefined' && 'webkitGetAsEntry' in DataTransferItem.prototype;
    },
  };
})();
