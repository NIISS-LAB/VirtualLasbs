/* =============================================================================
 * MOHR LAB — app.js
 * ESTADO DE LA APLICACIÓN, INTERFAZ Y ORQUESTACIÓN.
 *
 * Flujo de una sola fuente de verdad (§29):
 *     ENTRADAS → derive() → MODELO → VISUALIZACIÓN
 * derive() es el ÚNICO punto donde se calcula el modelo; todas las vistas,
 * tarjetas, ecuaciones e informes leen ese mismo objeto.
 *
 * REGLA DE INTERFAZ: los paneles que contienen campos de entrada construyen su
 * esqueleto UNA sola vez y después sólo refrescan el contenido. Así el foco y
 * la posición del cursor nunca se pierden al recalcular el modelo.
 * ========================================================================== */
(function (ML) {
  'use strict';

  var S = ML.stress, M = ML.mohr, T = ML.tf, F = ML.format, V = ML.viz,
      EQ = ML.equations, VAL = ML.validation, INF = ML.influence,
      EX = ML.exercises, CHT = ML.charts, RPT = ML.export;
  var DEG = 180 / Math.PI;

  // ---------------------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------------------
  var BUILD_STEPS = 8;                 // pasos de la construcción del círculo
  var BUILD_STEP_SECONDS = 2.4;        // duración de cada paso en reproducción

  var state = {
    st: S.plane(80, -30, 40),        // MPa — unidad canónica
    thetaDeg: 0,
    unit: 'MPa',
    decimals: 3,
    sz: 0,                            // σz del módulo 3D (extensión)
    mode: 'docente',
    teacher: {
      equations: true, definitions: true, units: true,
      conventions: true, steps: true, results: true
    },
    teacherProc: false,
    chart: { sigma: true, tau: true },
    inf: { variable: 'sx', delta: 20 },
    exercise: null, answers: {}, result: null, level: 'intermedio',
    exToken: 0, builtExToken: -1,
    // Construcción paso a paso del círculo: -1 = vista interactiva normal
    build: -1, buildPlaying: false, buildLast: 0, buildShown: -1
  };

  var dom = {};
  var views = {};
  var miniViews = [];
  var pending = false;
  var fallback = null;
  var RENDER_FALLBACK_MS = 130;
  var lastModel = null;
  var miniSig = '';

  // ---------------------------------------------------------------------------
  // Modelo
  // ---------------------------------------------------------------------------
  function derive() {
    var thetaRad = state.thetaDeg / DEG;
    var c = M.circle(state.st);
    var tr = T.transform(state.st, thetaRad);
    var pa = T.principalAngle(state.st);
    var m = {
      st: state.st,
      theta: thetaRad,
      thetaDeg: state.thetaDeg,
      c: c, tr: tr, pa: pa,
      pts: M.featurePoints(c, thetaRad),
      cls: S.classify(state.st),
      arrows: T.arrowSet(state.st, thetaRad),
      checks: VAL.checks(state.st, thetaRad),
      sz: state.sz,
      t3: S.principal3D(S.full3D(state.st, state.sz))
    };
    m.arrowScale = Math.max(Math.abs(c.s1), Math.abs(c.s2), Math.abs(state.st.xx),
                           Math.abs(state.st.yy), Math.abs(state.st.xy), 1e-9);
    return m;
  }

  function schedule() {
    if (pending) return;
    pending = true;
    // Vía normal: se agrupan las_updates de un arrastre en un solo fotograma.
    requestAnimationFrame(function () {
      if (fallback) { clearTimeout(fallback); fallback = null; }
      if (!pending) return;              // el temporizador ya renderizó
      pending = false;
      render();
    });
    /* RED DE SEGURIDAD.
       requestAnimationFrame depende de que el navegador componga la página.  Si la
       pestaña está oculta, la ventana ocluida o el entorno no concede fotogramas,
       el fotograma no llega nunca y la interfaz se queda congelada con el estado
       ya calculado: el usuario mueve un deslizador y no ocurre nada visible.
       El temporizador garantiza que el render se ejecute igualmente.  rAF sigue
       mandando mientras hay fotogramas, de modo que el comportamiento durante un
       arrastre no cambia. */
    fallback = setTimeout(function () {
      fallback = null;
      if (!pending) return;
      pending = false;
      render();
    }, RENDER_FALLBACK_MS);
  }

  /** Vuelca de inmediato cualquier render pendiente (pestaña que vuelve a verse). */
  function flush() {
    if (fallback) { clearTimeout(fallback); fallback = null; }
    if (!pending) return;
    pending = false;
    render();
  }

  // ---------------------------------------------------------------------------
  // Utilidades DOM
  // ---------------------------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function ce(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function setText(node, s) { if (node && node.textContent !== s) node.textContent = s; }
  /** Convierte una cadena de marcado en un fragmento de un solo nodo. */
  function html(s) { var d = ce('div', 'frag'); d.innerHTML = s; return d; }
  /** Inserta marcado directamente en un contenedor, sin nodo envolvente. */
  function addHtml(parent, s) {
    var tpl = document.createElement('template');
    tpl.innerHTML = s;
    parent.appendChild(tpl.content);
    return parent;
  }
  function labeled(text, node) {
    var w = ce('label', 'field');
    w.appendChild(ce('span', 'field-label', text));
    w.appendChild(node);
    return w;
  }
  function warnBox(text) { var d = ce('div', 'warn'); d.textContent = text; return d; }
  function flash(panel, msg) {
    if (!panel) return;
    var old = panel.querySelector('.flash');
    if (old) old.remove();
    var d = ce('div', 'flash', msg);
    panel.insertBefore(d, panel.firstChild);
    setTimeout(function () { if (d.parentNode) d.remove(); }, 3200);
  }
  function texify(t) {
    return String(t)
      .replace(/σavg/g, 'σ<sub>avg</sub>').replace(/σx/g, 'σ<sub>x</sub>')
      .replace(/σy/g, 'σ<sub>y</sub>').replace(/τxy/g, 'τ<sub>xy</sub>')
      .replace(/θp/g, 'θ<sub>p</sub>').replace(/θs/g, 'θ<sub>s</sub>')
      .replace(/σ1/g, 'σ<sub>1</sub>').replace(/σ2/g, 'σ<sub>2</sub>')
      .replace(/σθ/g, 'σ<sub>θ</sub>').replace(/τθ/g, 'τ<sub>θ</sub>');
  }

  // ---------------------------------------------------------------------------
  // Definición de las variables de entrada
  // ---------------------------------------------------------------------------
  var VARS = [
    { id: 'sx',   sym: 'σx',  key: 'xx', kind: 'sigma' },
    { id: 'sy',   sym: 'σy',  key: 'yy', kind: 'sigma' },
    { id: 'txy',  sym: 'τxy', key: 'xy', kind: 'tau' },
    { id: 'theta', sym: 'θ',   key: null, kind: 'angle' }
  ];
  function varDef(id) { for (var i = 0; i < VARS.length; i++) if (VARS[i].id === id) return VARS[i]; return null; }

  // ---------------------------------------------------------------------------
  // Construcción (una sola vez)
  // ---------------------------------------------------------------------------
  function buildVars() {
    var host = $('vars');
    VARS.forEach(function (v) {
      var wrap = ce('div', 'var');
      wrap.setAttribute('data-var', v.id);

      var head = ce('div', 'var-head');
      var lab = ce('label', 'var-sym', v.sym);
      lab.setAttribute('for', 'in-' + v.id);
      head.appendChild(lab);
      head.appendChild(ce('span', 'var-sign', '+'));
      head.appendChild(ce('span', 'var-desc', ''));
      wrap.appendChild(head);

      var field = ce('div', 'var-field');
      var minus = ce('button', 'btn-step', '−');
      minus.type = 'button';
      minus.setAttribute('data-var', v.id);
      minus.setAttribute('data-dir', '-1');
      minus.setAttribute('aria-label', 'Reducir ' + v.sym + ' un paso');
      var num = document.createElement('input');
      num.type = 'number'; num.step = 'any'; num.inputMode = 'decimal';
      num.id = 'in-' + v.id;
      num.setAttribute('data-var', v.id);
      num.setAttribute('aria-label', v.sym);
      var plus = ce('button', 'btn-step', '+');
      plus.type = 'button';
      plus.setAttribute('data-var', v.id);
      plus.setAttribute('data-dir', '1');
      plus.setAttribute('aria-label', 'Aumentar ' + v.sym + ' un paso');
      field.appendChild(minus); field.appendChild(num); field.appendChild(plus);
      wrap.appendChild(field);

      var range = document.createElement('input');
      range.type = 'range';
      range.className = 'var-range';
      range.id = 'rg-' + v.id;
      range.setAttribute('data-var', v.id);
      range.setAttribute('aria-label', v.sym + ', control deslizante');
      wrap.appendChild(range);

      host.appendChild(wrap);
    });
  }

  var READOUT = [
    { id: 'sx', sym: 'σx', kind: 'sigma', src: 'in' },
    { id: 'sy', sym: 'σy', kind: 'sigma', src: 'in' },
    { id: 'txy', sym: 'τxy', kind: 'tau', src: 'in' },
    { id: 'theta', sym: 'θ', kind: 'angle', src: 'in' },
    { id: 'avg', sym: 'σavg', kind: 'sigma', src: 'calc' },
    { id: 'R', sym: 'R', kind: 'shear', src: 'calc' },
    { id: 's1', sym: 'σ1', kind: 'sigma', src: 'calc' },
    { id: 's2', sym: 'σ2', kind: 'sigma', src: 'calc' },
    { id: 'taumax', sym: 'τmax', kind: 'shear', src: 'calc' },
    { id: 'thp', sym: 'θp', kind: 'angle', src: 'calc' },
    { id: 'ths', sym: 'θs', kind: 'angle', src: 'calc' },
    { id: 'sigma', sym: 'σθ', kind: 'sigma', src: 'calc' },
    { id: 'tau', sym: 'τθ', kind: 'tau', src: 'calc' }
  ];

  function buildReadout() {
    var host = $('readout');
    READOUT.forEach(function (r) {
      var cell = ce('div', 'ro');
      cell.id = 'ro-' + r.id;
      cell.setAttribute('data-src', r.src);
      cell.appendChild(ce('span', 'ro-sym', r.sym));
      cell.appendChild(ce('span', 'ro-val', '—'));
      cell.appendChild(ce('span', 'ro-unit', ''));
      host.appendChild(cell);
    });
  }

  function buildCases() {
    var host = $('cases');
    S.CASES.forEach(function (c) {
      var b = ce('button', 'case');
      b.type = 'button';
      b.innerHTML = '<span class="case-n">' + c.n + '</span>'
        + '<span class="case-t">' + c.title + '</span>'
        + '<span class="case-tag">' + c.tag + '</span>';
      b.title = c.note;
      b.addEventListener('click', function () {
        state.st = S.plane(c.s.xx, c.s.yy, c.s.xy);
        state.thetaDeg = c.theta;
        schedule();
        flash($('panel-inputs'), 'Caso ' + c.n + ' cargado — ' + c.title);
      });
      host.appendChild(b);
    });
  }

  var TABS = [
    { id: 'principales',    label: 'Esfuerzos principales' },
    { id: 'transformacion', label: 'Transformación' },
    { id: 'matriz',         label: 'Matriz' },
    { id: 'influencia',     label: 'Influencia' },
    { id: 'tresD',          label: 'Estado 3D' },
    { id: 'procedimiento',  label: 'Procedimiento', teacherOnly: true },
    { id: 'ejercicios',     label: 'Ejercicios' }
  ];
  var activeTab = 'principales';

  function buildTabs() {
    var tabs = $('tabs'), panels = $('tabpanels');
    TABS.forEach(function (t, i) {
      var b = ce('button', 'tab', t.label);
      b.type = 'button';
      b.id = 'tabbtn-' + t.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'tabpanel-' + t.id);
      b.setAttribute('data-tab', t.id);
      b.tabIndex = i === 0 ? 0 : -1;
      b.addEventListener('click', function () { selectTab(t.id); });
      b.addEventListener('keydown', function (e) { tabKeys(e, i); });
      tabs.appendChild(b);

      var sec = ce('section', 'tabpanel');
      sec.id = 'tabpanel-' + t.id;
      sec.setAttribute('role', 'tabpanel');
      sec.setAttribute('aria-labelledby', 'tabbtn-' + t.id);
      panels.appendChild(sec);
    });
  }

  function selectTab(id) {
    if (id === 'procedimiento' && !state.teacher.steps) id = 'principales';
    activeTab = id;
    TABS.forEach(function (t) {
      var btn = $('tabbtn-' + t.id), pan = $('tabpanel-' + t.id);
      if (!btn || !pan) return;
      var on = t.id === id;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.classList.toggle('is-active', on);
      btn.tabIndex = on ? 0 : -1;
      pan.hidden = !on;
    });
    if (id === 'ejercicios' && !state.exercise) newExercise();
    // La navegación es una acción del usuario: el panel se pinta de inmediato
    // para no mostrar un hueco vacío mientras llega el siguiente fotograma.
    if (lastModel) renderPanel(id);
    schedule();
  }

  function tabKeys(e, i) {
    var d = 0;
    if (e.key === 'ArrowRight') d = 1;
    else if (e.key === 'ArrowLeft') d = -1;
    else if (e.key === 'Home') d = -TABS.length;
    else if (e.key === 'End') d = TABS.length - 1;
    else return;
    e.preventDefault();
    var n = (i + d + TABS.length) % TABS.length;
    var btn = $('tabbtn-' + TABS[n].id);
    selectTab(TABS[n].id);
    if (btn) btn.focus();
  }

  // --- panel de convención de signos (§12) -----------------------------------
  function buildConvention() {
    var host = $('convention');
    var items = [
      { st: S.plane(70, 0, 0), th: 0, arc: false, cap: 'σ &gt; 0 · tracción',
        txt: 'Las flechas normales se alejan del centro: la cara se abre.' },
      { st: S.plane(-70, 0, 0), th: 0, arc: false, cap: 'σ &lt; 0 · compresión',
        txt: 'Las flechas normales apuntan al centro: la cara se cierra.' },
      { st: S.plane(0, 0, 55), th: 0, arc: false, cap: 'τxy &gt; 0 · cortante',
        txt: 'En la cara +x el cortante va hacia +y y en la +y hacia +x: ambas se acercan al vértice común.' },
      { st: S.plane(0, 0, 0), th: 34, arc: true, cap: 'θ &gt; 0 · antihorario',
        txt: 'θ se mide en sentido antihorario desde +x hasta la normal exterior de la cara θ.' }
    ];
    var grid = ce('div', 'conv-grid');
    items.forEach(function (it) {
      var cell = ce('div', 'conv-cell');
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      cell.appendChild(svg);
      cell.appendChild(html('<div class="conv-cap">' + it.cap + '</div>'));
      cell.appendChild(html('<div class="conv-txt">' + it.txt + '</div>'));
      grid.appendChild(cell);
      var vw = new V.ElementView(svg, {
        mini: true, w: 132, h: 116, cx: 66, cy: 56, half: 24, arrowMax: 20, planeExt: 1.4
      });
      miniViews.push({ view: vw, item: it });
    });
    host.appendChild(grid);
    host.appendChild(html('<div class="conv-note"><b>En el círculo de Mohr</b> el eje τ se representa hacia '
      + '<b>arriba</b> y el punto P avanza un ángulo <b>2θ en sentido horario</b> al aumentar θ. Ése es el motivo de '
      + 'que el ángulo en el círculo sea el doble del ángulo físico y de sentido opuesto.</div>'));
  }

  function buildTeacherToggles() {
    var host = $('teacher-layers');
    [['equations', 'Ecuaciones'], ['definitions', 'Definiciones'],
     ['units', 'Unidades'], ['conventions', 'Convenciones'],
     ['steps', 'Pasos de cálculo'], ['results', 'Resultados']].forEach(function (p) {
      var lab = ce('label', 'chk');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'tg-' + p[0];
      cb.checked = state.teacher[p[0]];
      cb.addEventListener('change', function () {
        state.teacher[p[0]] = cb.checked;
        applyTeacherClasses();
        schedule();
      });
      lab.appendChild(cb);
      lab.appendChild(ce('span', null, p[1]));
      host.appendChild(lab);
    });
  }

  function applyTeacherClasses() {
    var b = document.body;
    b.classList.toggle('no-eq', !state.teacher.equations);
    b.classList.toggle('no-def', !state.teacher.definitions);
    b.classList.toggle('no-units', !state.teacher.units);
    b.classList.toggle('no-conv', !state.teacher.conventions);
    b.classList.toggle('no-steps', !state.teacher.steps);
    b.classList.toggle('no-res', !state.teacher.results || state.mode === 'estudiante');
    $('panel-convention').hidden = !state.teacher.conventions;
    $('tabbtn-procedimiento').hidden = !state.teacher.steps;
    if (!state.teacher.steps && activeTab === 'procedimiento') selectTab('principales');
  }

  // ─────────────────────────────────────────── 5.5 Papel de cada parámetro ───
  var ROLES = [
    { id: 'sx', sym: 'σx', key: 'xx', kind: 'sigma' },
    { id: 'sy', sym: 'σy', key: 'yy', kind: 'sigma' },
    { id: 'txy', sym: 'τxy', key: 'xy', kind: 'tau' },
    { id: 'theta', sym: 'θ', key: null, kind: 'angle' }
  ];

  function roleText(id, m) {
    var c = m.c, f = F;
    switch (id) {
      case 'sx': return 'Marca D = (σx, 0) en el eje σ. Entra en el centro con peso ½ y, junto con σy, '
        + 'fija la longitud del cateto horizontal del Triedro, con el que se abre o se cierra el círculo. '
        + 'Cambiarla desplaza C y mueve A sobre la circunferencia.';
      case 'sy': return 'Marca E = (σy, 0). Entra en el centro con el mismo peso ½ que σx, pero su signo '
        + 'relativo respecto de σx es lo que decide si el radio crece o se reduce. Define también el extremo σ2.';
      case 'txy': return 'Es el cateto vertical del Triedro de Gauss: 2τxy es la longitud del diámetro AB, '
        + 'así que su módulo fija R = |AB|/2 = τmax cuando σx = σy. No desplaza el centro, pero sí separa '
        + 'σ1 de σ2 y gira las direcciones principales.';
      case 'theta': return 'No aparece en σavg, R, σ1, σ2 ni τmax: el círculo es inmutable. θ sólo lleva P '
        + 'de A a su posición, un recorrido de 2θ en sentido horario sobre la circunferencia. '
        + 'Es la demostración de que θ_Mohr = 2·θ_físico.';
      default: return '';
    }
  }

  function buildRoles() {
    var host = $('roles');
    host.innerHTML = '';
    ROLES.forEach(function (r) {
      var row = ce('div', 'role');
      row.id = 'role-' + r.id;
      var top = ce('div', 'role-top');
      top.appendChild(ce('span', 'role-sym', r.sym));
      var v = ce('span', 'role-val');
      v.className = 'role-val role-' + r.kind;
      top.appendChild(v);
      top.appendChild(ce('span', 'role-nat'));
      row.appendChild(top);
      var dia = ce('div', 'role-dia');
      row.appendChild(dia);
      row.appendChild(ce('p', 'role-txt', roleText(r.id, { c: { avg: 0 } })));
      host.appendChild(row);
    });
  }

  function renderRoles(m) {
    if (!$('role-sx')) buildRoles();
    ROLES.forEach(function (r) {
      var row = $('role-' + r.id);
      var isA = r.kind === 'angle';
      var shown = isA ? m.thetaDeg : m.st[r.key];
      var v = row.querySelector('.role-val');
      v.textContent = isA ? F.angle(shown) : F.stressDisplay(shown);
      v.className = 'role-val role-' + r.kind + (Math.abs(shown) < 1e-9 ? ' is-zero' : (shown > 0 ? ' is-pos' : ' is-neg'));
      var nat = row.querySelector('.role-nat');
      nat.textContent = isA ? 'ángulo' : (r.kind === 'tau'
        ? (Math.abs(shown) < 1e-9 ? 'nulo' : (shown > 0 ? 'positivo' : 'negativo'))
        : (Math.abs(shown) < 1e-9 ? 'nulo' : (shown > 0 ? 'tracción' : 'compresión')));
      var dia = row.querySelector('.role-dia');
      while (dia.firstChild) dia.removeChild(dia.firstChild);
      dia.appendChild(V.paramRole(m, r.id));
    });
  }

  // ─────────────────────────────────── 5.6 Construcción paso a paso del círculo ───
  function buildConstructionUI() {
    var segs = $('build-segs');
    for (var i = 0; i < BUILD_STEPS; i++) {
      var li = ce('li', 'build-seg');
      li.setAttribute('data-i', String(i));
      segs.appendChild(li);
    }
    $('btn-build').addEventListener('click', function () {
      if (state.build < 0) openBuild(0); else closeBuild();
    });
    $('build-prev').addEventListener('click', function () {
      stopBuild();
      state.build = Math.max(0, Math.floor(state.build) - 1);
      state.buildShown = -1;
      render();
    });
    $('build-next').addEventListener('click', function () {
      stopBuild();
      state.build = Math.min(BUILD_STEPS - 1, Math.floor(state.build) + 1);
      state.buildShown = -1;
      render();
    });
    $('build-play').addEventListener('click', function () {
      if (state.buildPlaying) { stopBuild(); render(); return; }
      if (state.build < 0 || state.build >= BUILD_STEPS - 1) state.build = 0;
      playBuild();
    });
    $('build-close').addEventListener('click', closeBuild);
  }

  function openBuild(t) {
    state.build = t;
    state.buildShown = -1;
    $('build').hidden = false;
    $('btn-build').setAttribute('aria-expanded', 'true');
    render();
  }
  function closeBuild() {
    stopBuild();
    state.build = -1;
    state.buildShown = -1;
    $('build').hidden = true;
    $('btn-build').setAttribute('aria-expanded', 'false');
    render();
  }
  function playBuild() {
    state.buildPlaying = true;
    state.buildLast = 0;
    setText($('build-play'), 'Pausa');
    requestAnimationFrame(buildTick);
    render();
  }
  function stopBuild() {
    state.buildPlaying = false;
    setText($('build-play'), 'Reproducir');
  }
  /** Reloj de la construcción: avanza smoothly y se detiene al cerrarse. */
  function buildTick(ts) {
    if (!state.buildPlaying) return;
    var dt = state.buildLast ? Math.min(0.1, (ts - state.buildLast) / 1000) : 0;
    state.buildLast = ts;
    state.build += dt / BUILD_STEP_SECONDS;
    if (state.build >= BUILD_STEPS) {
      state.build = BUILD_STEPS;      // construcción completa
      stopBuild();
      render();
      return;
    }
    render();
    requestAnimationFrame(buildTick);
  }

  function renderBuildCaption(m) {
    if (state.build < 0) return;
    var steps = V.buildSteps(m);
    var idx = Math.min(steps.length - 1, Math.max(0, Math.floor(state.build)));
    if (idx === state.buildShown) return;          // no tocar el DOM en cada fotograma
    state.buildShown = idx;
    var s = steps[idx];
    setText($('build-title'), s.t);
    setText($('build-desc'), s.d);
    setText($('build-formula'), s.f);
    setText($('build-count'), 'Paso ' + s.n + ' de ' + steps.length);
    // Si el origen quedó fuera de la ventana, se explica por qué no se ven D y E.
    var off = views.circle && views.circle.originOffScale;
    $('build').classList.toggle('is-offscale', !!off);
    var note = $('build-offscale');
    if (note) {
      note.hidden = !off;
      if (off) {
        note.textContent = 'El origen (σ = 0) queda fuera de la escala: se ha priorizado la lectura de la '
          + 'circunferencia, de modo que D y E, que están sobre el eje σ, no son visibles en esta ventana. '
          + 'Reduzca σx y σy, o reduzca la unidad, para ver la construcción completa.';
      }
    }
    $('build-prev').disabled = idx === 0;
    $('build-next').disabled = idx >= steps.length - 1;
    setText($('build-play'), state.buildPlaying ? 'Pausa' : 'Reproducir');
    [].forEach.call($('build-segs').children, function (li, i) {
      li.className = 'build-seg' + (i < idx ? ' is-done' : (i === idx ? ' is-now' : ''));
    });
  }

  // ---------------------------------------------------------------------------
  // Enlaces
  // ---------------------------------------------------------------------------
  function bindVars() {
    var host = $('vars');
    host.addEventListener('input', function (e) {
      var t = e.target, id = t.getAttribute('data-var');
      if (!id) return;
      if (t.value === '') return;
      var val = Number(t.value);
      if (!isFinite(val)) return;
      setVar(id, val);
    });
    host.addEventListener('change', function (e) {
      if (e.target.type === 'number') syncInputs();
    });
    host.addEventListener('click', function (e) {
      var b = e.target.closest('.btn-step');
      if (!b) return;
      var id = b.getAttribute('data-var');
      var dir = Number(b.getAttribute('data-dir'));
      var cur = currentDisplay(id);
      var step = id === 'theta' ? 1 : F.get(state.unit).step;
      setVar(id, cur + dir * step);
    });
  }

  function currentDisplay(id) {
    if (id === 'theta') return state.thetaDeg;
    return F.fromBase(state.st[varDef(id).key], state.unit);
  }

  /** Único punto de escritura del estado para las variables de entrada. */
  function setVar(id, value) {
    if (id === 'theta') state.thetaDeg = S.normalizeTheta180(value);
    else state.st[varDef(id).key] = F.toBase(value, state.unit);
    syncInputs();
    schedule();
  }
  function setTheta(deg) {
    state.thetaDeg = S.normalizeTheta180(deg);
    syncInputs();
    schedule();
  }

  function syncInputs() {
    VARS.forEach(function (v) {
      var num = $('in-' + v.id), range = $('rg-' + v.id);
      if (!num || !range) return;
      var isAngle = v.id === 'theta';
      var shown = currentDisplay(v.id);
      if (document.activeElement !== num) {
        num.value = F.trim(shown, isAngle ? 3 : Math.min(8, state.decimals + 2));
      }
      if (isAngle) { range.min = 0; range.max = 180; range.step = 0.1; }
      else {
        var sp = F.span(state.unit);
        range.min = -sp; range.max = sp; range.step = F.get(state.unit).step;
      }
      if (document.activeElement !== range) range.value = String(shown);

      var wrap = num.closest('.var');
      var sign = wrap.querySelector('.var-sign');
      var desc = wrap.querySelector('.var-desc');
      var zero = Math.abs(shown) < 1e-9;
      setText(sign, zero ? '0' : (shown > 0 ? '+' : '−'));
      sign.className = 'var-sign ' + (zero ? 'is-zero' : (shown > 0 ? 'is-pos' : 'is-neg'));
      if (isAngle) desc.textContent = 'antihorario desde +x';
      else if (v.kind === 'tau') desc.textContent = zero ? 'sin cortante' : (shown > 0 ? 'cortante positivo' : 'cortante negativo');
      else desc.textContent = zero ? 'sin esfuerzo normal' : (shown > 0 ? 'tracción' : 'compresión');
      wrap.setAttribute('data-state', zero ? 'zero' : (shown > 0 ? 'pos' : 'neg'));
    });
  }

  function bindChartToggles() {
    var host = $('chart-legend');
    [['sigma', 'σθ = f(θ)', 'sigma'], ['tau', 'τθ = f(θ)', 'tau']].forEach(function (p) {
      var lab = ce('label', 'lg');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = state.chart[p[0]];
      cb.addEventListener('change', function () { state.chart[p[0]] = cb.checked; schedule(); });
      lab.appendChild(cb);
      lab.appendChild(ce('span', 'lg-swatch lg-' + p[2]));
      lab.appendChild(ce('span', 'lg-txt', p[1]));
      host.appendChild(lab);
    });
  }

  function bindExport() {
    $('btn-report').addEventListener('click', function () {
      RPT.download('mohr-lab-informe.txt', RPT.report(derive()), 'text/plain');
    });
    $('btn-image').addEventListener('click', function () {
      var m = derive();
      var svg = RPT.snapshot(['v-element', 'v-circle', 'v-chart'],
        [{ label: 'Elemento diferencial · θ = ' + F.angle(m.thetaDeg, 2) },
         { label: 'Círculo de Mohr · σavg = ' + F.stress(m.c.avg) + ' · R = ' + F.stress(m.c.R) },
         { label: 'Esfuerzo vs. ángulo · 0° ≤ θ ≤ 180°' }], RPT.stamp(m));
      RPT.download('mohr-lab-figura.svg', svg, 'image/svg+xml');
    });
    $('btn-png').addEventListener('click', function () {
      var m = derive();
      var svg = RPT.snapshot(['v-element', 'v-circle', 'v-chart'],
        [{ label: 'Elemento diferencial' }, { label: 'Círculo de Mohr' }, { label: 'Esfuerzo vs. ángulo' }],
        RPT.stamp(m));
      RPT.svgToPng(svg, 'mohr-lab-figura.png', 2)
        .catch(function (err) { flash($('panel-export'), 'No se pudo generar el PNG: ' + err.message); });
    });
    $('btn-print').addEventListener('click', function () { RPT.print(derive()); });
  }

  function setMode(mode) {
    state.mode = mode;
    document.body.setAttribute('data-mode', mode);
    document.querySelectorAll('.mode-switch button').forEach(function (b) {
      var on = b.getAttribute('data-mode') === mode;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.classList.toggle('is-active', on);
    });
    $('teacher-panel').hidden = mode !== 'docente';
    var en = $('ex-note');
    if (en) en.textContent = mode === 'estudiante'
      ? 'Los resultados calculados se ocultan hasta que se comprueben las respuestas.'
      : '';
    applyTeacherClasses();
    if (mode === 'estudiante') selectTab('ejercicios');
    schedule();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  /* Paneles de análisis.  Sólo se materializa el que está visible: los siete
     paneles.sumaban más de 800 nodos y se reconstruían en cada fotograma, con
     lo que casi la mitad del trabajo se dedicaba a contenido oculto.  Al cambiar
     de pestaña se vuelve a materializar el nuevo panel con el estado actual. */
  var PANELS = {};
  function renderPanel(id) {
    if (!lastModel) return;
    var fn = PANELS[id];
    if (fn) fn(lastModel);
  }

  function render() {
    var m = derive();
    lastModel = m;

    views.element.update(m);
    views.circle.update(m, state.build);
    views.chart.update(m, state.chart);
    renderBuildCaption(m);

    // Los mini-diagramas de la convención dependen sólo de σx, σy y τxy: si lo
    // único que ha cambiado es θ, no se reconstruyen.
    var sig = m.st.xx + '|' + m.st.yy + '|' + m.st.xy;
    if (sig !== miniSig) {
      miniSig = sig;
      for (var i = 0; i < miniViews.length; i++) {
        var mv = miniViews[i], st = mv.item.st, th = mv.item.th / DEG;
        mv.view.update({
          st: st, theta: th, thetaDeg: mv.item.th,
          pa: T.principalAngle(st),
          arrows: T.arrowSet(st, th),
          arrowScale: Math.max(Math.abs(st.xx), Math.abs(st.yy), Math.abs(st.xy), 1e-9)
        });
        mv.view.gAngle.style.display = mv.item.arc ? '' : 'none';
      }
    }

    renderTitleBlock(m);
    renderReadout(m);
    renderState(m);
    renderRoles(m);
    renderValidation(m);
    renderPanel(activeTab);
  }

  function renderTitleBlock(m) {
    setText($('tb-sx'), F.stressDisplay(m.st.xx));
    setText($('tb-sy'), F.stressDisplay(m.st.yy));
    setText($('tb-txy'), F.stressDisplay(m.st.xy));
    setText($('tb-theta'), F.angle(m.thetaDeg, 2));
    setText($('tb-unit'), F.unit);
  }

  function readoutValues(m) {
    return {
      sx: m.st.xx, sy: m.st.yy, txy: m.st.xy, theta: m.thetaDeg,
      avg: m.c.avg, R: m.c.R, s1: m.c.s1, s2: m.c.s2, taumax: m.c.tauMax,
      thp: m.pa.hydro ? null : m.pa.thetaPdeg,
      ths: m.pa.hydro ? null : m.pa.thetaSdeg,
      sigma: m.tr.sigma, tau: m.tr.tau
    };
  }

  function renderReadout(m) {
    var vals = readoutValues(m);
    READOUT.forEach(function (r) {
      var cell = $('ro-' + r.id);
      if (!cell) return;
      var v = vals[r.id];
      var isA = r.kind === 'angle';
      setText(cell.querySelector('.ro-val'), v === null ? '—' : (isA ? F.angle(v) : F.stressDisplay(v)));
      setText(cell.querySelector('.ro-unit'), (v === null || isA) ? '' : F.unit);
      var cls = 'ro ro-' + r.kind;
      if (v === null) cls += ' is-undef';
      else if (isA) cls += ' is-angle';
      else cls += (v > 1e-9 ? ' is-pos' : (v < -1e-9 ? ' is-neg' : ' is-zero'));
      if (cell.className !== cls) cell.className = cls;
      cell.title = r.sym + (v === null ? ' : no definido en estado hidrostático'
        : ' = ' + (isA ? F.angle(v) : F.stress(v)));
    });
  }

  function renderState(m) {
    var host = $('state-desc');
    host.innerHTML = '';
    host.appendChild(html('<div class="state-class">' + m.cls.label + '</div>'));
    host.appendChild(html('<p class="state-note">' + m.cls.note + '</p>'));
    host.appendChild(html('<p class="state-note">Naturaleza del estado tensional: <b>'
      + RPT.principalNature(m.c) + '</b>.</p>'));
    if (m.pa.hydro) {
      host.appendChild(html('<div class="warn"><b>R = 0.</b> Estado hidrostático: el círculo se reduce a un punto '
        + 'y no hay direcciones principales ni de máximo cortante distinguibles. Girar el elemento no modifica nada.</div>'));
    }
  }

  function renderValidation(m) {
    var host = $('validation');
    host.innerHTML = '';
    var all = m.checks.every(function (k) { return k.ok; });
    var head = ce('div', 'val-head ' + (all ? 'is-ok' : 'is-bad'));
    head.appendChild(ce('span', 'val-mark', all ? '✓' : '!'));
    head.appendChild(ce('span', 'val-text', all
      ? 'Estado tensional consistente: las cuatro comprobaciones se cumplen.'
      : 'Se ha detectado una discrepancia: consulte el detalle.'));
    host.appendChild(head);
    m.checks.forEach(function (k) {
      var det = ce('details', 'val-item' + (k.ok ? ' is-ok' : ' is-bad'));
      det.open = !k.ok;
      var sm = ce('summary');
      sm.appendChild(ce('span', 'val-mark', k.ok ? '✓' : '!'));
      sm.appendChild(ce('span', 'val-label', k.label));
      det.appendChild(sm);
      det.appendChild(html('<p class="val-note">' + k.note + '</p>'));
      var tbl = ce('table', 'val-table');
      var tb = ce('tbody');
      k.rows.forEach(function (r) {
        var tr = ce('tr', r.ok ? '' : 'is-bad');
        tr.appendChild(ce('th', null, r.label));
        tr.appendChild(ce('td', 'num', F.stress(r.got, 6)));
        tr.appendChild(ce('td', 'num', F.stress(r.expected, 6)));
        tr.appendChild(ce('td', 'val-eq', r.ok ? '=' : '≠'));
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      det.appendChild(tbl);
      host.appendChild(det);
    });
  }

  // --- tabla auxiliar ---------------------------------------------------------
  function kvTable(rows) {
    var t = ce('table', 'tbl tbl-kv');
    var tb = ce('tbody');
    rows.forEach(function (r) {
      var tr = ce('tr');
      tr.appendChild(ce('th', null, r[0]));
      tr.appendChild(ce('td', 'num v-' + r[2], r[1]));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    return t;
  }

  // --- pestañas ----------------------------------------------------------------
  PANELS.principales = renderPrincipals;
  PANELS.transformacion = renderTransform;
  PANELS.matriz = renderMatrix;
  PANELS.influencia = renderInfluence;
  PANELS.tresD = render3D;
  PANELS.procedimiento = renderProcedure;
  PANELS.ejercicios = function () { renderExercises(); };

  function renderPrincipals(m) {
    var host = $('tabpanel-principales');
    host.innerHTML = '';
    if (m.pa.hydro) {
      host.appendChild(warnBox('Estado hidrostático plano: R = 0. Los dos esfuerzos principales coinciden ('
        + F.stress(m.c.s1) + ') y todas las direcciones son equivalentes, de modo que no existe un par de planos '
        + 'principales definido.'));
    }
    host.appendChild(html('<h4>Valores</h4>'));
    host.appendChild(kvTable([
      ['σ1', F.stress(m.c.s1), signClass(m.c.s1)],
      ['σ2', F.stress(m.c.s2), signClass(m.c.s2)],
      ['τmax', F.stress(m.c.tauMax), 'shear'],
      ['σavg = (σ1+σ2)/2', F.stress(m.c.avg), 'avg'],
      ['Naturaleza', RPT.principalNature(m.c), 'text']
    ]));
    host.appendChild(html('<h4>Orientaciones</h4>'));
    if (m.pa.hydro) {
      host.appendChild(kvTable([
        ['θp', 'no definido (R = 0)', 'text'],
        ['θs', 'no definido (R = 0)', 'text']
      ]));
      host.appendChild(html('<p class="note">Al ser R = 0, la expresión tan 2θp = 2τxy/(σx−σy) se convierte en 0/0 '
        + 'y no determina orientación alguna.</p>'));
    } else {
      host.appendChild(kvTable([
        ['θp · normal del plano de σ1', F.angle(m.pa.thetaPdeg), 'angle'],
        ['2θp · ángulo correspondiente en el círculo', F.angle(m.pa.twoPdeg), 'angle'],
        ['Cuadrante de atan2', m.pa.quadrant, 'text'],
        ['tan 2θp = 2τxy/(σx−σy)', tri(m.pa.tan2), 'text'],
        ['θs · plano de máximo cortante', F.angle(m.pa.thetaSdeg), 'angle'],
        ['Separación θs − θp', F.angle(45, 2), 'angle']
      ]));
      host.appendChild(html('<p class="note">El plano de máximo cortante está exactamente a 45° del plano principal. '
        + 'En θs el cortante vale ±τmax = ' + F.stress(m.c.tauMax) + ' y el esfuerzo normal vale σavg = '
        + F.stress(m.c.avg) + ': el punto correspondiente cae en el centro del círculo, sobre el eje τ.</p>'));
    }
    if (state.teacher.equations) {
      host.appendChild(html('<h4>Con sustitución numérica</h4>'));
      host.appendChild(html(EQ.principalBlock(m.st)));
    }
  }

  function signClass(v) { return v > 1e-9 ? 'pos' : (v < -1e-9 ? 'neg' : 'zero'); }
  function tri(x) {
    if (x === Infinity) return '+∞';
    if (x === -Infinity) return '−∞';
    return F.decimal(x, 4);
  }

  function renderTransform(m) {
    var host = $('tabpanel-transformacion');
    host.innerHTML = '';
    host.appendChild(html('<h4>En el plano orientado θ = ' + F.angle(m.thetaDeg) + '</h4>'));
    host.appendChild(kvTable([
      ['σθ', F.stress(m.tr.sigma), signClass(m.tr.sigma)],
      ['τθ', F.stress(m.tr.tau), 'shear'],
      ['σ(θ+90°)', F.stress(m.tr.sigmaM), signClass(m.tr.sigmaM)],
      ['τ(θ+90°)', F.stress(m.tr.tauM), 'shear'],
      ['θ · ángulo físico', F.angle(m.thetaDeg), 'angle'],
      ['2θ · ángulo en el círculo', F.angle(2 * m.thetaDeg), 'angle']
    ]));
    host.appendChild(html('<h4>Correspondencia con el círculo de Mohr</h4>'));
    var dist = Math.hypot(m.tr.sigma - m.c.avg, m.tr.tau);
    host.appendChild(kvTable([
      ['A = (σx, τxy)', '(' + F.stressDisplay(m.st.xx) + ', ' + F.stressDisplay(m.st.xy) + ')', 'text'],
      ['B = (σy, −τxy)', '(' + F.stressDisplay(m.st.yy) + ', ' + F.signed(-m.st.xy) + ')', 'text'],
      ['P = (σθ, τθ)', '(' + F.stressDisplay(m.tr.sigma) + ', ' + F.stressDisplay(m.tr.tau) + ')', 'text'],
      ['|P − C|', F.stress(dist, 8), 'text'],
      ['R', F.stress(m.c.R, 8), 'text'],
      ['Error | |P−C| − R |', F.stress(Math.abs(dist - m.c.R), 10), 'text']
    ]));
    if (state.teacher.equations) {
      host.appendChild(html('<h4>El círculo: centro, radio e invariantes</h4>'));
      host.appendChild(html(EQ.circleBlock(m.st)));
      host.appendChild(html('<h4>Transformación con sustitución numérica</h4>'));
      host.appendChild(html(EQ.transformBlock(m.st, m.thetaDeg)));
      host.appendChild(html('<p class="note">cos y sen se evalúan en <b>grados</b>: el argumento es 2θ = '
        + F.angle(2 * m.thetaDeg) + '.</p>'));
    }
    if (state.teacher.definitions) {
      host.appendChild(html('<h4>Definiciones</h4>'));
      host.appendChild(html('<ul class="defs">'
        + '<li><b>σθ</b> es el esfuerzo normal sobre el plano cuya normal exterior está orientada a θ desde +x.</li>'
        + '<li><b>τθ</b> es el cortante en ese mismo plano, positivo en la dirección e2 = (−senθ, cosθ).</li>'
        + '<li>Las caras ortogonales valen σ(θ+90°) = σx + σy − σθ y τ(θ+90°) = −τθ.</li>'
        + '<li>El estado se repite cada 180°: elementos y puntos P son indistinguibles a los 180°.</li>'
        + '</ul>'));
    }
  }

  function renderMatrix(m) {
    var host = $('tabpanel-matriz');
    host.innerHTML = '';
    host.appendChild(html('<h4>Tensor de esfuerzos en la base original</h4>'));
    host.appendChild(html(EQ.tensorBlock(m.st)));
    host.appendChild(html('<h4>Matriz de rotación</h4>'));
    host.appendChild(html(EQ.rotationBlock(m.thetaDeg)));
    host.appendChild(html('<h4>Tensor en la base girada θ = ' + F.angle(m.thetaDeg) + '</h4>'));
    host.appendChild(html(EQ.sigmaPrimeBlock(m.st, m.thetaDeg)));
    host.appendChild(html('<p class="note">Q(θ) = [[cosθ, senθ], [−senθ, cosθ]] cumple Q·Qᵀ = I, de modo que '
      + 'σ′ = Q·σ·Qᵀ es una rotación rígida y conserva los autovalores: <b>los esfuerzos principales no dependen '
      + 'de θ</b>. Los componentes de σ′ son σ′₁₁ = σθ, σ′₁₂ = τθ y σ′₂₂ = σ(θ+90°).</p>'));
  }

  // --- módulo 3D ---------------------------------------------------------------
  function build3D() {
    var host = $('tabpanel-tresD');
    host.innerHTML = '';
    host.appendChild(html('<div class="note note-3d"><b>Extensión preparada.</b> El núcleo interactivo de la '
      + 'aplicación es el estado plano. Para comprobar la arquitectura hacia el estado tridimensional se añade σz '
      + '(con τyz = τxz = 0), lo que reduce el problema a tres círculos de Mohr y a los criterios de fallo '
      + 'habituales. Las fórmulas son exactas: los esfuerzos principales tridimensionales se obtienen de la '
      + 'ecuación característica del polinomio cúbico.</div>'));

    var ctl = ce('div', 'sz-ctl');
    var lab = ce('label', 'field');
    lab.appendChild(ce('span', 'field-label', 'σz'));
    var num = document.createElement('input');
    num.type = 'number'; num.step = 'any'; num.inputMode = 'decimal';
    num.id = 'in-sz';
    num.setAttribute('aria-label', 'Esfuerzo normal σz');
    num.addEventListener('input', function () {
      var v = Number(num.value);
      if (isFinite(v)) { state.sz = F.toBase(v, state.unit); schedule(); }
    });
    lab.appendChild(num);
    lab.appendChild(ce('span', 'field-unit', F.unit));
    ctl.appendChild(lab);
    host.appendChild(ctl);

    var d3 = ce('div'); d3.id = 'res-3d'; host.appendChild(d3);
    var fig = ce('figure', 'viewport viewport-3d');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'v-circle3d';
    fig.appendChild(svg);
    host.appendChild(fig);
    host.appendChild(html('<p class="note">En tensión tridimensional los tres círculos de Mohr son coaxiales: '
      + 'comparten el mismo eje σ y tienen centros en (σ1+σ2)/2, (σ2+σ3)/2 y (σ1+σ3)/2. El de radio mayor es el que '
      + 'gobierna los criterios de fallo. Con σz = 0, los dos esfuerzos del plano reaparecen entre σ1, σ2 y σ3 junto '
      + 'con el cero.</p>'));
    views.circle3d = new V.Mohr3DView(svg);
  }

  function render3D(m) {
    var box = $('res-3d');
    if (!box) return;
    var num = $('in-sz');
    if (num && document.activeElement !== num) num.value = F.trim(F.fromBase(state.sz, state.unit), 5);
    var su = document.querySelector('#tabpanel-tresD .field-unit');
    if (su) su.textContent = F.unit;
    box.innerHTML = '';
    box.appendChild(kvTable([
      ['σ1', F.stress(m.t3.s1), signClass(m.t3.s1)],
      ['σ2', F.stress(m.t3.s2), signClass(m.t3.s2)],
      ['σ3', F.stress(m.t3.s3), signClass(m.t3.s3)],
      ['I1 = σ1+σ2+σ3', F.stress(m.t3.I1), 'text'],
      ['I2 = σ1σ2+σ2σ3+σ3σ1', F.stress(m.t3.I2), 'text'],
      ['I3 = σ1σ2σ3', F.stress(m.t3.I3), 'text'],
      ['J2 = ((σ1−σ2)²+(σ2−σ3)²+(σ3−σ1)²)/6', F.stress(m.t3.J2), 'text'],
      ['τ octaédrico', F.stress(m.t3.octaShear), 'shear'],
      ['Criterio de Tresca · σ1 − σ3', F.stress(m.t3.tresca), 'text'],
      ['Criterio de von Mises', F.stress(m.t3.vonMises), 'text']
    ]));
    if (views.circle3d) views.circle3d.update(m.t3, state.unit);
  }

  // --- procedimiento -----------------------------------------------------------
  function renderProcedure(m) {
    var host = $('tabpanel-procedimiento');
    if (!host) return;
    host.innerHTML = '';
    if (state.mode === 'estudiante') {
      host.appendChild(warnBox('El procedimiento de cálculo está disponible en el modo docente.'));
      return;
    }
    var bar = ce('div', 'proc-bar');
    var btn = ce('button', 'btn btn-primary', state.teacherProc ? 'Ocultar procedimiento' : 'Mostrar procedimiento');
    btn.type = 'button';
    btn.addEventListener('click', function () { state.teacherProc = !state.teacherProc; render(); });
    bar.appendChild(btn);
    bar.appendChild(html('<span class="note">Ocho pasos con sustitución numérica, calculados con el mismo modelo '
      + 'que alimenta la pantalla. No hay resultados recalculados por otra vía.</span>'));
    host.appendChild(bar);

    if (!state.teacherProc) {
      host.appendChild(html('<p class="note">Active el botón para desplegar el cálculo paso a paso: estado inicial, '
        + 'centro, radio, circunferencia, esfuerzos principales, cortante máximo, orientación y transformación.</p>'));
      return;
    }
    var ol = ce('ol', 'proc');
    RPT.procedure(m).forEach(function (s) {
      var li = ce('li');
      li.appendChild(ce('h4', null, s.t));
      li.appendChild(ce('p', 'proc-body', s.body));
      if (s.note) li.appendChild(ce('p', 'proc-note', s.note));
      ol.appendChild(li);
    });
    host.appendChild(ol);
    host.appendChild(html('<h4>Formulario de referencia</h4>'));
    host.appendChild(html(EQ.symbolicBlock()));
  }

  // --- influencia --------------------------------------------------------------
  function buildInfluence() {
    var host = $('tabpanel-influencia');
    host.innerHTML = '';
    var ctl = ce('div', 'inf-ctl');
    var sel = document.createElement('select');
    sel.id = 'inf-var';
    sel.setAttribute('aria-label', 'Variable a analizar');
    INF.VARIABLES.forEach(function (v) {
      var op = ce('option', null, v.full);
      op.value = v.id;
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () { state.inf.variable = sel.value; schedule(); });
    ctl.appendChild(labeled('Variable', sel));

    var step = document.createElement('input');
    step.type = 'number'; step.step = 'any'; step.className = 'num-sm';
    step.id = 'inf-delta';
    step.setAttribute('aria-label', 'Tamaño del incremento Δ');
    step.addEventListener('input', function () {
      var v = Number(step.value);
      if (isFinite(v) && v !== 0) { state.inf.delta = Math.abs(v); schedule(); }
    });
    ctl.appendChild(labeled('Δ', step));

    var btns = ce('div', 'btn-row');
    var minus = ce('button', 'btn', '− Δ');
    minus.type = 'button';
    minus.addEventListener('click', function () { applyProbe(-1); });
    var plus = ce('button', 'btn', '+ Δ');
    plus.type = 'button';
    plus.addEventListener('click', function () { applyProbe(1); });
    var res = ce('button', 'btn', 'Restablecer estado');
    res.type = 'button';
    res.addEventListener('click', function () {
      state.st = S.plane(80, -30, 40);
      state.thetaDeg = 0;
      state.sz = 0;
      syncInputs();
      schedule();
    });
    btns.appendChild(minus); btns.appendChild(plus); btns.appendChild(res);
    ctl.appendChild(btns);
    host.appendChild(ctl);

    ['inf-deriv', 'inf-phys', 'inf-probe', 'inf-targets'].forEach(function (id) {
      var d = ce('div'); d.id = id; host.appendChild(d);
    });
  }

  function applyProbe(dir) {
    var base = lastModel || derive();
    var pr = INF.probe(state.st, base.theta, state.inf.variable, state.inf.delta * dir);
    state.st = S.clone(pr.st2);
    if (state.inf.variable === 'theta') state.thetaDeg = S.normalizeTheta180(pr.th2 * DEG);
    syncInputs();
    schedule();
  }

  function renderInfluence(m) {
    if (!$('inf-var')) buildInfluence();
    var v = state.inf.variable;
    var vmeta = INF.VARIABLES.filter(function (x) { return x.id === v; })[0];
    $('inf-var').value = v;
    if (document.activeElement !== $('inf-delta')) $('inf-delta').value = F.trim(state.inf.delta, 4);

    var dv = $('inf-deriv');
    dv.innerHTML = '';
    dv.appendChild(html('<h4>Sensibilidad a ' + vmeta.full + ' — derivadas analíticas</h4>'));
    dv.appendChild(html('<p class="note">La tabla no procede de la sonda numérica inferior: son las derivadas '
      + 'exactas de las fórmulas, válidas para cualquier signo de las variables.</p>'));
    addHtml(dv, derivTable(state.st, v));

    var ph = $('inf-phys');
    ph.innerHTML = '';
    ph.appendChild(html('<h4>Qué ocurre y por qué</h4>'));
    var ul = ce('ul', 'inf-list');
    INF.PHYSICS[v].forEach(function (t) { ul.appendChild(html('<li>' + t + '</li>')); });
    ph.appendChild(ul);

    var pr = INF.probe(state.st, m.theta, v, state.inf.delta);
    var pb = $('inf-probe');
    pb.innerHTML = '';
    pb.appendChild(html('<h4>Sonda: ' + (pr.sign > 0 ? 'aumento' : 'disminución') + ' de ' + vmeta.full
      + ' en Δ = ' + (pr.sign > 0 ? '+' : '−') + F.stress(state.inf.delta, 4) + '</h4>'));
    addHtml(pb, probeTable(pr));

    var tg = $('inf-targets');
    tg.innerHTML = '';
    tg.appendChild(html('<h4>Elementos afectados en la vista</h4>'));
    addHtml(tg, targetsTable(pr));
    tg.appendChild(html('<p class="note">Aplique +Δ o −Δ para cargar el estado modificado y observar el efecto en las '
      + 'tres vistas, o «Restablecer estado» para volver al punto de partida.</p>'));
  }

  function derivTable(st, v) {
    var varName = v === 'sx' ? 'σx' : (v === 'sy' ? 'σy' : (v === 'txy' ? 'τxy' : 'θ'));
    var body = '<table class="tbl tbl-sens"><thead><tr><th>Magnitud</th><th>Expresión</th>'
      + '<th>∂ / ∂' + varName + '</th><th>Tendencia</th></tr></thead><tbody>';
    INF.rows(st, v).forEach(function (r) {
      var d = r.deriv;
      var undef = !isFinite(d);
      var dTxt = undef ? 'no applicable' : (r.kind === 'angle' ? F.signed(d * DEG, 3) + ' °/unidad' : F.signed(d, 4));
      var flat = !undef && Math.abs(d) < 1e-12;
      var arrow = undef ? '—' : (flat ? '→ constante' : (d > 0 ? '↑ aumenta' : '↓ disminuye'));
      body += '<tr><th>' + r.label + '</th><td class="tex">' + texify(r.tex) + '</td>'
        + '<td class="num">' + dTxt + '</td>'
        + '<td class="dir ' + (undef ? '' : (flat ? 'flat' : (d > 0 ? 'up' : 'down'))) + '">' + arrow + '</td></tr>';
    });
    return body + '</tbody></table>';
  }

  function probeTable(pr) {
    var body = '<table class="tbl tbl-probe"><thead><tr><th>Magnitud</th><th>Antes</th><th>Después</th>'
      + '<th>Δ</th><th></th></tr></thead><tbody>';
    pr.changes.forEach(function (c) {
      if (c.key === 'sigma' || c.key === 'tau') return;
      var isA = c.kind === 'angle';
      var fmt = function (v) { return isA ? F.angle(v) : F.stress(v); };
      var mark = c.dir === 0 ? '→' : (c.dir > 0 ? '↑' : '↓');
      body += '<tr><th>' + c.label + '</th><td class="num">' + fmt(c.before) + '</td>'
        + '<td class="num">' + fmt(c.after) + '</td>'
        + '<td class="num">' + (c.dir === 0 ? '—' : (isA ? F.signed(c.delta, 2) + '°' : F.signed(c.delta))) + '</td>'
        + '<td class="dir ' + (c.dir === 0 ? 'flat' : (c.dir > 0 ? 'up' : 'down')) + '">' + mark + '</td></tr>';
    });
    return body + '</tbody></table>';
  }

  function targetsTable(pr) {
    var body = '<ul class="target-list">';
    INF.targets(pr).forEach(function (t) {
      var ch = pr.changes.filter(function (c) { return c.key === t.key; })[0];
      var moved = ch && ch.dir !== 0;
      var isA = ch && ch.kind === 'angle';
      body += '<li class="' + (moved ? 'is-moved' : 'is-still') + '">'
        + '<span class="tg-mark">' + (moved ? (ch.dir > 0 ? '↑' : '↓') : '→') + '</span>'
        + '<span class="tg-name">' + t.label + '</span>'
        + '<span class="tg-hint">' + t.hint + '</span>'
        + '<span class="tg-delta">' + (moved ? (isA ? F.signed(ch.delta, 2) + '°' : F.signed(ch.delta)) : 'sin cambio') + '</span>'
        + '</li>';
    });
    return body + '</ul>';
  }

  // --- ejercicios --------------------------------------------------------------
  function newExercise() {
    state.exercise = EX.generate(state.level);
    state.answers = {};
    state.result = null;
    state.exToken++;
  }

  function buildExercises() {
    var host = $('tabpanel-ejercicios');
    host.innerHTML = '';
    var ex = state.exercise;

    var bar = ce('div', 'ex-bar');
    var sel = document.createElement('select');
    sel.id = 'ex-level';
    sel.setAttribute('aria-label', 'Nivel del ejercicio');
    Object.keys(EX.LEVELS).forEach(function (k) {
      var op = ce('option', null, EX.LEVELS[k].name);
      op.value = k;
      if (k === state.level) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () { state.level = sel.value; newExercise(); render(); });
    bar.appendChild(labeled('Nivel', sel));
    var gen = ce('button', 'btn btn-primary', 'Generar nuevo ejercicio');
    gen.type = 'button';
    gen.addEventListener('click', function () { newExercise(); render(); });
    var chk = ce('button', 'btn', 'Comprobar');
    chk.type = 'button';
    chk.addEventListener('click', function () {
      state.result = EX.check(state.exercise, state.answers);
      refreshExerciseFeedback();
    });
    var rev = ce('button', 'btn', 'Ver solución');
    rev.type = 'button';
    rev.addEventListener('click', function () {
      state.exercise.questions.forEach(function (q) { state.answers[q.id] = q.answer; });
      state.result = EX.check(state.exercise, state.answers);
      render();
    });
    var load = ce('button', 'btn', 'Cargar en el simulador');
    load.type = 'button';
    load.addEventListener('click', function () {
      state.st = S.clone(ex.st);
      state.thetaDeg = ex.theta;
      syncInputs();
      schedule();
      flash($('panel-inputs'), 'Ejercicio cargado. Compruebe geométricamente sus respuestas en el círculo.');
    });
    var br = ce('div', 'btn-row');
    br.appendChild(gen); br.appendChild(chk); br.appendChild(rev); br.appendChild(load);
    bar.appendChild(br);
    host.appendChild(bar);

    host.appendChild(html('<p class="note">' + ex.note + '</p>'));

    var bits = ['σx = ' + F.stress(ex.st.xx), 'σy = ' + F.stress(ex.st.yy), 'τxy = ' + F.stress(ex.st.xy)];
    var needsTheta = ex.questions.some(function (q) { return q.id === 'sigma' || q.id === 'tau' || q.id === 'pSigma'; });
    if (needsTheta) bits.push('θ = ' + F.angle(ex.theta, 2));
    if (ex.questions.some(function (q) { return q.id === 'tresca' || q.id === 'vonMises'; })) bits.push('σz = 0');
    host.appendChild(html('<div class="ex-state"><span class="ex-lbl">Estado del problema</span>'
      + '<span class="ex-vals">' + bits.join('&nbsp;&nbsp;&nbsp;') + '</span></div>'));

    var grid = ce('div', 'ex-grid');
    ex.questions.forEach(function (q) {
      var cell = ce('div', 'ex-q');
      cell.id = 'exq-' + q.id;
      var lab = ce('label', 'ex-q-lbl');
      lab.appendChild(ce('span', 'ex-q-name', q.label));
      var inp = document.createElement('input');
      inp.type = 'number'; inp.step = 'any'; inp.className = 'ex-in';
      inp.id = 'ex-' + q.id;
      inp.setAttribute('data-q', q.id);
      inp.setAttribute('aria-label', q.label);
      if (state.answers[q.id] !== undefined && state.answers[q.id] !== null) inp.value = String(state.answers[q.id]);
      inp.addEventListener('input', function () {
        state.answers[q.id] = inp.value;
        if (state.result) { state.result = EX.check(state.exercise, state.answers); refreshExerciseFeedback(); }
      });
      lab.appendChild(inp);
      lab.appendChild(ce('span', 'ex-q-u', q.kind === 'angle' ? '°' : F.unit));
      cell.appendChild(lab);
      var hint = ce('button', 'ex-hint', 'Pista');
      hint.type = 'button';
      hint.addEventListener('click', function () {
        cell.querySelector('.ex-hinttext').textContent = EX.hint(ex, q.id);
        cell.classList.add('is-open');
      });
      cell.appendChild(hint);
      cell.appendChild(ce('div', 'ex-hinttext', ''));
      cell.appendChild(ce('div', 'ex-fb'));
      grid.appendChild(cell);
    });
    host.appendChild(grid);
    host.appendChild(ce('div', 'ex-score-row'));
    var note = ce('p', 'note', state.mode === 'estudiante'
      ? 'Los resultados calculados se ocultan hasta que se comprueben las respuestas.'
      : '');
    note.id = 'ex-note';
    host.insertBefore(note, host.firstChild);
  }

  function feedbackFor(r) {
    if (r.blank) return { cls: '', text: 'Sin responder.' };
    if (r.ok) return { cls: 'is-ok', text: 'Correcto. ' + r.why };
    return {
      cls: 'is-bad',
      text: 'No coincide. Su valor ' + (r.kind === 'angle' ? F.angle(r.given, 3) : F.stress(r.given))
          + '; el valor correcto es ' + (r.kind === 'angle' ? F.angle(r.answer, 3) : F.stress(r.answer))
          + ' (tolerancia ±' + (r.kind === 'angle' ? F.angle(r.tol, 2) : F.stress(r.tol)) + '). ' + r.why
    };
  }

  /** Refresca retroalimentación y marcador SIN reconstruir los campos de entrada. */
  function refreshExerciseFeedback() {
    if (!state.exercise) return;
    var res = state.result;
    state.exercise.questions.forEach(function (q) {
      var cell = $('exq-' + q.id);
      if (!cell) return;
      var fb = cell.querySelector('.ex-fb');
      if (!res) { fb.className = 'ex-fb'; fb.textContent = ''; cell.classList.remove('is-ok', 'is-bad'); return; }
      var r = res.results.filter(function (x) { return x.id === q.id; })[0];
      var f = feedbackFor(r);
      fb.className = 'ex-fb ' + f.cls;
      fb.textContent = f.text;
      cell.classList.toggle('is-ok', !!f.cls.match(/is-ok/));
      cell.classList.toggle('is-bad', !!f.cls.match(/is-bad/));
    });
    var row = document.querySelector('#tabpanel-ejercicios .ex-score-row');
    if (!row) return;
    row.innerHTML = '';
    if (!res) return;
    var sc = ce('div', 'ex-score ' + (res.score === 1 ? 'is-ok' : (res.score >= 0.6 ? 'is-mid' : 'is-bad')));
    sc.innerHTML = '<b>' + res.correct + ' / ' + res.total + '</b> correctas ('
      + Math.round(res.score * 100) + ' %)'
      + (res.complete ? '' : ' &nbsp;·&nbsp; ' + (res.total - res.answered) + ' sin responder');
    row.appendChild(sc);
    if (res.score === 1 && res.complete) {
      var p = ce('p', 'ex-praise');
      p.textContent = 'Todas las respuestas correctas. Pulse «Cargar en el simulador» para comprobar que el '
        + 'círculo, el elemento y la gráfica coinciden con sus respuestas.';
      row.appendChild(p);
    }
  }

  function renderExercises() {
    if (!state.exercise) newExercise();
    if (state.builtExToken !== state.exToken) {
      buildExercises();
      state.builtExToken = state.exToken;
    }
    var ex = state.exercise;
    var sel = $('ex-level');
    if (sel && sel.value !== state.level) sel.value = state.level;
    ex.questions.forEach(function (q) {
      var inp = $('ex-' + q.id);
      if (!inp || inp === document.activeElement) return;
      var a = state.answers[q.id];
      var want = (a === undefined || a === null) ? '' : String(a);
      if (inp.value !== want) inp.value = want;
    });
    refreshExerciseFeedback();
  }

  // ---------------------------------------------------------------------------
  // Arranque
  // ---------------------------------------------------------------------------
  function init() {
    F.unit = state.unit;
    F.setDecimals(state.decimals);

    views.element = new V.ElementView($('v-element'));
    views.circle = new V.CircleView($('v-circle'));
    views.chart = new CHT.AngularView($('v-chart'));
    views.element.onRotate = setTheta;
    views.circle.onRotate = setTheta;
    views.chart.onRotate = setTheta;

    buildVars();
    buildReadout();
    buildCases();
    buildTabs();
    buildConvention();
    buildTeacherToggles();
    buildRoles();
    buildConstructionUI();
    build3D();
    buildInfluence();
    bindVars();
    bindChartToggles();
    bindExport();

    document.querySelectorAll('.mode-switch button').forEach(function (b) {
      b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); });
    });

    var unitSel = $('unit');
    F.UNITS.forEach(function (u) {
      var op = ce('option', null, u.id + ' — ' + u.note);
      op.value = u.id;
      unitSel.appendChild(op);
    });
    unitSel.value = state.unit;
    unitSel.addEventListener('change', function () {
      F.unit = unitSel.value;
      syncInputs();
      schedule();
    });

    var decSel = $('dec');
    [2, 3, 4, 6].forEach(function (d) {
      var op = ce('option', null, d + ' decimales');
      op.value = String(d);
      decSel.appendChild(op);
    });
    decSel.value = String(state.decimals);
    decSel.addEventListener('change', function () {
      F.setDecimals(Number(decSel.value));
      syncInputs();
      schedule();
    });

    // Autodiagnóstico: si la suite de pruebas falla, se avisa en la propia interfaz.
    var res = VAL.run();
    var st = $('selftest');
    st.className = 'selftest ' + (res.fail === 0 ? 'is-ok' : 'is-bad');
    st.innerHTML = '<b>' + res.pass + ' / ' + res.total + '</b> pruebas automáticas superadas'
      + (res.fail === 0
        ? ': la matemática está verificada contra soluciones analíticas independientes.'
        : ' — <b>' + res.fail + ' fallo(s). Revise la consola.</b>')
      + ' &nbsp;<a href="tests/index.html" target="_blank" rel="noopener">ver detalle</a>';

    setMode('docente');
    syncInputs();
    selectTab(activeTab);
    render();

    // Si la pestaña se oculta con un render pendiente, se vuelca al volver.
    document.addEventListener('visibilitychange', function () { if (!document.hidden) flush(); });
    window.addEventListener('focus', flush);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  ML.app = {
    state: state, derive: derive, setVar: setVar, setTheta: setTheta,
    render: render, selectTab: selectTab, setMode: setMode
  };

})(typeof window !== 'undefined'
  ? (window.MohrLab = window.MohrLab || {})
  : (global.MohrLab = global.MohrLab || {}));
