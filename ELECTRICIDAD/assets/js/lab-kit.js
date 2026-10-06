/* ============================================================================
   VIRTUAL LAB CENTER — lab-kit.js
   Puente entre una práctica autonomous y el visor: hereda tema e idioma del
   centro y ofrece un diccionario bilingüe mínimo.
       const L = LabKit.mount({ es: {...}, en: {...} });
   El HTML se traduce con  data-t="clave"  ·  data-t-ph  ·  data-t-aria
   ========================================================================== */
window.LabKit = (function () {
  const LS_THEME = 'vlc-theme';
  const LS_LANG = 'vlc-lang';

  let dict = { es: {}, en: {} };
  let lang = 'es';
  let listeners = [];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* modo privado */ } },
  };

  function currentTheme() {
    // data-lab-force-theme fija el tema desde el propio HTML; data-lab-theme
    // es solo el valor aplicado, no debe encerrar al resto de fuentes.
    const force = document.documentElement.getAttribute('data-lab-force-theme');
    if (force === 'dark' || force === 'light') return force;
    const saved = store.get(LS_THEME);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function t(key) {
    const d = dict[lang] || {};
    return d[key] !== undefined ? d[key] : (dict.es[key] !== undefined ? dict.es[key] : key);
  }

  function paint() {
    document.documentElement.setAttribute('data-lab-theme', currentTheme());
    document.documentElement.setAttribute('lang', lang);
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-t-ph]').forEach((el) => { el.placeholder = t(el.dataset.tPh); });
    document.querySelectorAll('[data-t-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.tAria)); });
    document.querySelectorAll('[data-t-html]').forEach((el) => { el.innerHTML = t(el.dataset.tHtml); });
    const lbl = document.querySelector('[data-lang-label]');
    if (lbl) lbl.textContent = lang.toUpperCase();
    listeners.forEach((fn) => { try { fn(lang, currentTheme()); } catch (e) { /* noop */ } });
  }

  function setTheme(theme) {
    store.set(LS_THEME, theme);
    paint();
  }
  function setLang(next) {
    lang = next === 'en' ? 'en' : 'es';
    store.set(LS_LANG, lang);
    paint();
  }

  function mount(d) {
    dict = d || { es: {}, en: {} };
    const saved = store.get(LS_LANG);
    lang = saved === 'en' || saved === 'es' ? saved : (navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es';

    // tema e idioma heredados del visor
    window.addEventListener('message', (e) => {
      const d2 = e.data;
      if (!d2 || d2.source !== 'virtual-lab-center') return;
      if (d2.theme) store.set(LS_THEME, d2.theme);
      if (d2.lang) lang = d2.lang === 'en' ? 'en' : 'es';
      store.set(LS_LANG, lang);
      paint();
      try {
        const clean = document.title.replace(/\s*·\s*Virtual Lab Center\s*$/i, '');
        parent.postMessage({ source: 'virtual-lab-center-lab', title: clean }, '*');
      } catch (err) { /* noop */ }
    });

    // botones de la cabecera de la práctica
    document.addEventListener('click', (e) => {
      const th = e.target.closest('[data-lab-theme-toggle]');
      if (th) { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); return; }
      const lg = e.target.closest('[data-lab-lang-toggle]');
      if (lg) { setLang(lang === 'es' ? 'en' : 'es'); }
    });

    paint();
    return {
      t,
      get lang() { return lang; },
      get theme() { return currentTheme(); },
      setTheme,
      setLang,
      onChange(fn) { listeners.push(fn); return fn; },
      repaint: paint,
      reduced,
    };
  }

  return { mount, t, currentTheme };
})();
