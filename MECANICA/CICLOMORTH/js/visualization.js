/* =============================================================================
 * MOHR LAB — visualization.js
 * Capa de visualización en SVG.  No contiene matemática: consume el modelo ya
 * calculado (js/stress.js, js/mohr.js, js/transformations.js) y lo dibuja.
 *
 * Dos visores principales:
 *   ElementView  — elemento diferencial interactivo (arrastrable)
 *   CircleView   — círculo de Mohr interactivo (punto P arrastrable)
 *   Mohr3DView   — extensión: los tres círculos de Mohr en 3D
 *
 * CONVENCIÓN GEOMÉTRICA DE LOS VISORES
 *   Las coordenadas de pantalla tienen la Y hacia abajo.  En el círculo, τ se
 *   representa hacia ARRIBA, de modo que un ángulo matemático φ (medido desde
 *   +σ en sentido antihorario) se proyecta como  (cx + r·cos φ , cy − r·sin φ).
 *   Como P = C + Rot(−2θ)·(A₀,B₀), el punto P avanza en sentido HORARIO al
 *   aumentar θ: ése es el sentido del arco 2θ que se dibuja en el círculo.
 * ========================================================================== */
(function (ML) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  // ---------------------------------------------------------------------------
  // Utilidades SVG
  // ---------------------------------------------------------------------------

  function el(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] === null || attrs[k] === undefined) continue;
      n.setAttribute(k, attrs[k]);
    }
    if (text !== undefined && text !== null) n.appendChild(document.createTextNode(String(text)));
    return n;
  }
  function g(attrs) { return el('g', attrs); }
  function add(parent, child) { parent.appendChild(child); return child; }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function attr(node, attrs) { for (var k in attrs) { if (attrs[k] === null) node.removeAttribute(k); else node.setAttribute(k, attrs[k]); } return node; }

  /** Número "bonito" para la retícula: 1, 2, 2.5, 5, 10 × 10^k */
  function niceStep(raw) {
    if (!(raw > 0) || !isFinite(raw)) return 1;
    var exp = Math.floor(Math.log(raw) / Math.LN10);
    var f = raw / Math.pow(10, exp);
    var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return n * Math.pow(10, exp);
  }

  /**
   * Reparte etiquetas alrededor de un punto evitando solapamientos.
   * @param {Array<{x,y,cands:Array<[dx,dy,anchor]>,text,...}>}
   */
  function LabelPlacer() { this.boxes = []; }
  LabelPlacer.prototype.free = function (x, y, w, h) {
    for (var i = 0; i < this.boxes.length; i++) {
      var b = this.boxes[i];
      if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return false;
    }
    return true;
  };
  LabelPlacer.prototype.take = function (x, y, w, h) { this.boxes.push({ x: x, y: y, w: w, h: h }); };
  /** Devuelve el índice del primer candidato libre; si todos chocan, el 0. */
  LabelPlacer.prototype.pick = function (cands) {
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i], w = c[2] === 'end' ? c[3] : (c[2] === 'middle' ? c[3] / 2 : c[3]);
      var x = cands[i][4] - (c[2] === 'end' ? w : c[2] === 'middle' ? w : 0);
      var y = cands[i][5] - c[6] / 2;
      if (this.free(x, y, w, c[6])) { this.take(x, y, w, c[6]); return i; }
    }
    this.take(cands[0][4], cands[0][5] - cands[0][6] / 2, 20, cands[0][6]);
    return 0;
  };

  /** Crea el <defs> con las puntas de flecha de un visor. */
  function defs(prefix, colors) {
    var d = el('defs');
    for (var k in colors) {
      var m = el('marker', {
        id: prefix + '-mk-' + k,
        viewBox: '0 0 10 10', refX: '10', refY: '5',
        markerWidth: '7.4', markerHeight: '7.4',
        markerUnits: 'userSpaceOnUse', orient: 'auto'
      });
      m.appendChild(el('path', { d: 'M0,1.2 L10,5 L0,8.8 L2.4,5 Z', fill: colors[k] }));
      d.appendChild(m);
    }
    return d;
  }

  /** Convierte coordenadas de pantalla a coordenadas del viewBox. */
  function toLocal(svgNode, evt, vb) {
    var r = svgNode.getBoundingClientRect();
    var s = r.width / vb.w;               // el viewBox se ajusta sin letterbox
    return { x: (evt.clientX - r.left) / s, y: (evt.clientY - r.top) / s };
  }

  // ---------------------------------------------------------------------------
  // Visor 1 · Elemento diferencial
  // ---------------------------------------------------------------------------

  // Geometría por defecto del visor.  Puede sobreescribirse por instancia para
  // reutilizar EXACTAMENTE el mismo dibujo a distinta escala (diagramas de la
  // convención de signos), garantizando que ambas representaciones coinciden.
  var EV = { w: 400, h: 380, cx: 200, cy: 188, half: 76, arrowMax: 54, planeExt: 1.86 };

  function ElementView(svg, opts) {
    opts = opts || {};
    this.svg = svg;
    this.o = opts;
    var base = { w: EV.w, h: EV.h, cx: EV.cx, cy: EV.cy, half: EV.half, arrowMax: EV.arrowMax, planeExt: EV.planeExt };
    for (var kk in base) if (opts[kk] !== undefined) base[kk] = opts[kk];
    this.G = base;
    var G = this.G;
    this.vb = { w: G.w, h: G.h };
    attr(svg, { viewBox: '0 0 ' + G.w + ' ' + G.h, width: G.w, height: G.h,
                class: 'viz viz-element' + (opts.mini ? ' viz-mini' : ''),
                tabindex: opts.mini ? null : '0', role: opts.mini ? 'img' : 'application' });
    clear(svg);
    svg.appendChild(defs(opts.mini ? 'mn' : 'el', {
      tension: 'var(--tension)', compression: 'var(--compression)',
      shear: 'var(--shear)', axis: 'var(--axis)'
    }));

    this.gPlanes = add(svg, g({ class: 'v-planes' }));
    this.gGhost = add(svg, g({ class: 'v-ghost' }));
    this.gAxes = add(svg, g({ class: 'v-axes' }));
    this.gElem = add(svg, g({ class: 'v-elem' }));
    this.gArrows = add(svg, g({ class: 'v-arrows' }));
    this.gLabels = add(svg, g({ class: 'v-labels' }));
    this.gAngle = add(svg, g({ class: 'v-angle' }));
    this.gHit = add(svg, el('rect', { x: 0, y: 0, width: G.w, height: G.h, fill: 'transparent', class: 'v-hit' }));

    var self = this;
    if (!opts.mini) {
      svg.addEventListener('pointerdown', function (e) {
        if (self.onRotate) { self.dragging = true; svg.setPointerCapture(e.pointerId); self.apply(e); e.preventDefault(); }
      });
      svg.addEventListener('pointermove', function (e) { if (self.dragging) self.apply(e); });
      svg.addEventListener('pointerup', function (e) { self.dragging = false; try { svg.releasePointerCapture(e.pointerId); } catch (err) {} });
      svg.addEventListener('pointercancel', function () { self.dragging = false; });
      svg.addEventListener('keydown', function (e) { self.key(e); });
    }
  }

  /**
   * Teclado del visor: se emite un INCREMENTO, nunca un valor absoluto.
   * (Leer el valor de vuelta del DOM introduciría un desfase: el atributo
   *  data-theta sólo se actualiza en el siguiente render.)
   *   Flechas            ±0.5°      RePág / AvPág  ±15°
   *   Mayús + flechas    ±5°
   */
  function keyStep(e) {
    var small = e.shiftKey ? 5 : 0.5, big = 15;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') return small;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') return -small;
    if (e.key === 'PageUp') return big;
    if (e.key === 'PageDown') return -big;
    return null;
  }

  function handleKey(self, e) {
    var d = keyStep(e);
    if (d === null) return;
    e.preventDefault();
    if (self.onStep) self.onStep(d);
  }

  ElementView.prototype.apply = function (e) {
    var p = toLocal(this.svg, e, this.vb);
    var dx = p.x - this.G.cx, dy = p.y - this.G.cy;
    if (Math.hypot(dx, dy) < 16) return;      // demasiado cerca del centro: ángulo inestable
    // El ángulo en pantalla crece hacia abajo; el físico crece hacia arriba.
    var deg = Math.atan2(-dy, dx) * 180 / Math.PI;
    if (this.onRotate) this.onRotate(deg);
  };
  ElementView.prototype.key = function (e) { handleKey(this, e); };

  ElementView.prototype.update = function (m) {
    var svg = this.svg, G = this.G, o = this.o;
    var cx = G.cx, cy = G.cy, half = G.half;
    var mini = !!o.mini, mk = mini ? 'mn' : 'el';
    var th = m.theta, deg = m.thetaDeg;

    /* Base local en COORDENADAS MATEMÁTICAS (Y hacia arriba).
       El único volteo a coordenadas de pantalla ocurre en pt(): todos los
       puntos del dibujo pasan por ahí, de modo que el elemento no puede quedar
       espejado respecto de los ejes globales x,y que se dibujan aparte. */
    var c1 = { x: Math.cos(th), y: Math.sin(th) };      // e1 = (cosθ, senθ)
    var c2 = { x: -Math.sin(th), y: Math.cos(th) };     // e2 = (−senθ, cosθ)

    /** Punto (nx,ny) en coordenadas matemáticas a distancia d píxeles del origen. */
    function pt(nx, ny, d) { return { x: cx + nx * d, y: cy - ny * d }; }
    /** Dirección matemática (ux,uy) a píxeles de pantalla. */
    function dir(ux, uy, d) { return { x: ux * d, y: -uy * d }; }

    if (!mini) attr(svg, { 'data-theta': deg.toFixed(4) });

    var S = this.gPlanes, Gh = this.gGhost, A = this.gAxes,
        E = this.gElem, R = this.gArrows, L = this.gLabels, N = this.gAngle;
    [S, Gh, A, E, R, L, N].forEach(clear);

    // --- sistema de referencia global (fijo): +x a la derecha, +y hacia arriba -
    var axLen = half * 2.16;
    [[1, 0, 'x'], [0, 1, 'y']].forEach(function (v) {
      var p1 = pt(-v[0], -v[1], axLen), p2 = pt(v[0], v[1], axLen);
      add(A, el('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: 'v-global-axis' }));
      if (!mini) {
        var lp = pt(v[0], v[1], axLen + 13);
        add(A, el('text', { x: lp.x, y: lp.y + 4,
                             'text-anchor': v[0] > 0 ? 'start' : (v[0] < 0 ? 'end' : 'middle'),
                             class: 'v-axis-name' }, v[2]));
      }
    });

    // --- elemento fantasma en la posición de referencia θ = 0 ---------------
    [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(function (s) {
      var p1 = pt(s[0], s[1], half), p2 = pt(-s[1], -s[0], half);
      add(Gh, el('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: 'v-ghost-edge' }));
    });

    // --- planos principales y de máximo cortante ----------------------------
    var pa = m.pa;
    if (!mini && o.planes !== false && !pa.hydro) {
      [{ a: pa.thetaP, cls: 'v-plane-principal', tag: 'σ₁' },
       { a: pa.thetaS, cls: 'v-plane-shear', tag: 'τ' }].forEach(function (L2) {
        var ca = Math.cos(L2.a), sa = Math.sin(L2.a);
        var e = half * G.planeExt;
        var p1 = pt(-ca, -sa, e), p2 = pt(ca, sa, e);
        add(S, el('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: L2.cls }));
        // Etiqueta en la punta del semi-eje, fuera de la zona de flechas
        var lp = pt(ca, sa, e + 11);
        add(S, el('text', { x: lp.x, y: lp.y + 3.5,
                            'text-anchor': ca > 0.35 ? 'start' : (ca < -0.35 ? 'end' : 'middle'),
                            class: L2.cls + '-tag' }, L2.tag));
      });
    }

    // --- el elemento rotado --------------------------------------------------
    var corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(function (s) {
      return pt(s[0] * c1.x + s[1] * c2.x, s[0] * c1.y + s[1] * c2.y, half);
    });
    add(E, el('polygon', { points: corners.map(function (p) { return p.x.toFixed(2) + ',' + p.y.toFixed(2); }).join(' '),
                           class: 'v-element-face' }));
    corners.forEach(function (p, i) {
      if (i === 0) return;
      var q = corners[(i + 3) % 4];
      add(E, el('line', { x1: q.x, y1: q.y, x2: p.x, y2: p.y, class: 'v-element-edge' }));
    });
    add(E, el('circle', { cx: cx, cy: cy, r: 2.4, class: 'v-element-origin' }));

    // --- vectores de esfuerzo (datos de arrowSet, sin duplicar matemática) ----
    var arrows = m.arrows;
    var scale = G.arrowMax / Math.max(1e-9, m.arrowScale);
    var placer = new LabelPlacer();
    var minLen = mini ? 3 : 9, padL = mini ? 4 : 9;
    arrows.forEach(function (a) {
      if (Math.abs(a.value) < 1e-12) return;
      var len = Math.max(minLen, Math.min(G.arrowMax + 6, Math.abs(a.value) * scale));
      var sgn = a.value >= 0 ? 1 : -1;                    // el signo decide el sentido
      var o0 = pt(a.ox, a.oy, half);                     // centro de la cara
      var dd = dir(a.dx * sgn, a.dy * sgn, len);          // dirección efectiva
      var ex = o0.x + dd.x, ey = o0.y + dd.y;
      var col = a.kind === 'tau' ? 'shear' : (a.value >= 0 ? 'tension' : 'compression');
      add(R, el('line', { x1: o0.x.toFixed(2), y1: o0.y.toFixed(2), x2: ex.toFixed(2), y2: ey.toFixed(2),
                          class: 'v-arrow v-arrow-' + col,
                          'marker-end': 'url(#' + mk + '-mk-' + col + ')' }));
      if (mini) return;
      // Valor junto a la punta
      var txt = ML.format.stressDisplay(a.value) + (a.kind === 'tau' ? ' τ' : ' σ');
      var ux = a.dx * sgn, uy = a.dy * sgn;
      var anc = ux > 0.3 ? 'start' : (ux < -0.3 ? 'end' : 'middle');
      var lx = ex + ux * padL, ly = ey - uy * padL + 3.5;
      var w = txt.length * 5.1;
      var cand = [[lx, ly, anc, w, lx, ly]];
      var f2 = cand[placer.pick(cand)];
      add(L, el('text', { x: f2[4], y: f2[5], 'text-anchor': f2[2], class: 'v-value v-value-' + col }, txt));
    });

    if (mini) return;

    // --- rótulos de las caras y de los ejes locales --------------------------
    [['+x′', 1, 0], ['+y′', 0, 1], ['−x′', -1, 0], ['−y′', 0, -1]].forEach(function (t) {
      var p = pt(t[1] * c1.x + t[2] * c2.x, t[1] * c1.y + t[2] * c2.y, half * 1.30);
      add(L, el('text', { x: p.x, y: p.y + 3.5, 'text-anchor': 'middle', class: 'v-face-tag' }, t[0]));
    });
    var lx1 = pt(c1.x, c1.y, half * 1.02), lx2 = pt(c2.x, c2.y, half * 1.02);
    add(L, el('text', { x: lx1.x, y: lx1.y + 3.5, 'text-anchor': 'middle', class: 'v-local-axis' }, 'x′'));
    add(L, el('text', { x: lx2.x, y: lx2.y + 3.5, 'text-anchor': 'middle', class: 'v-local-axis' }, 'y′'));

    // --- ángulo θ: desde +x, en sentido antihorario (matemático) --------------
    var ar = half * 0.52;
    add(N, el('line', { x1: cx, y1: cy, x2: cx + ar, y2: cy, class: 'v-angle-ref' }));
    if (Math.abs(deg) > 0.05) {
      // θ positivo es antihorario en pantalla ⇒ sweep-flag 0 en coordenadas SVG
      var sweep = deg >= 0 ? 0 : 1;
      var pe = pt(Math.cos(th), Math.sin(th), ar);
      add(N, el('path', { d: 'M ' + (cx + ar) + ' ' + cy + ' A ' + ar + ' ' + ar + ' 0 0 ' + sweep + ' '
                              + pe.x.toFixed(2) + ' ' + pe.y.toFixed(2),
                          class: 'v-angle-arc', 'marker-end': 'url(#el-mk-axis)' }));
    }
    var lm = pt(Math.cos(th / 2), Math.sin(th / 2), ar + 15);
    add(N, el('text', { x: lm.x, y: lm.y + 3.5, 'text-anchor': 'middle', class: 'v-angle-tag' }, 'θ'));
  };

  // ---------------------------------------------------------------------------
  // Visor 2 · Círculo de Mohr
  // ---------------------------------------------------------------------------

  /* Rectángulo de trazado del círculo.  `label` es el margen reservado para que
     las etiquetas radiales nunca queden fuera del lienzo. */
  var CV = { w: 604, h: 566, bx: 88, by: 30, bw: 500, bh: 486, label: 44 };

  /**
   * Escala del círculo.  Se exige ASPECTO 1:1 —si no, deja de ser un círculo— y
   * se reserva el margen de etiquetas para que la circunferencia completa y sus
   * rótulos quepan siempre.
   *
   * Criterio de prioridad: el círculo es el objeto de estudio.  Si la escala
   * necesaria para incluir el origen lo reduce a un punto ilegible (σavg = 995
   * con R = 5, por ejemplo) se dibuja el círculo a tamaño legible y se marca el
   * origen como fuera de escala: un círculo de un píxel en un eje de 2000
   * unidades no informa de nada.
   */
  function circleScale(c, ext) {
    var halfX = Math.max(c.avg - ext.min, ext.max - c.avg, 1e-12);
    var halfY = c.R * 1.16;
    var half = Math.min(CV.bw, CV.bh) / 2;
    var kFit = Math.min((CV.bw / 2 - CV.label) / halfX, (CV.bh / 2 - CV.label) / halfY);
    var kCircle = (half - CV.label) / Math.max(c.R * 1.02, 1e-12);
    // R ≈ 0 (hidrostático o estado nulo): no hay circunferencia que priorizar, de
    // modo que la escala la fijan los datos.  Dividir por R daría valores
    // desorbitados.
    if (!(c.R > 1e-9)) return { k: kFit, originOffScale: false };
    if (kFit * c.R < 64) {
      var kC = (half - CV.label) / (c.R * 1.02);
      return { k: kC, originOffScale: true };
    }
    return { k: kFit, originOffScale: false };
  }

  /** Revelado progresivo de un trazo: efecto «dibujo con compás». */
  function drawIn(node, len, p) {
    if (p >= 1) { attr(node, { 'stroke-dasharray': null, 'stroke-dashoffset': null }); return; }
    if (!(p > 0)) { attr(node, { 'stroke-dasharray': len + ' ' + len, 'stroke-dashoffset': len }); return; }
    attr(node, { 'stroke-dasharray': len.toFixed(2), 'stroke-dashoffset': (len * (1 - p)).toFixed(2) });
  }

  function CircleView(svg, opts) {
    this.svg = svg;
    this.o = opts || {};
    this.vb = { w: CV.w, h: CV.h };
    this.buildStep = -1;
    attr(svg, { viewBox: '0 0 ' + CV.w + ' ' + CV.h, width: CV.w, height: CV.h,
                class: 'viz viz-circle', tabindex: '0', role: 'application' });
    clear(svg);
    svg.appendChild(defs('ci', { axis: 'var(--axis)', accent: 'var(--accent)',
                                 neutral: 'var(--neutral-mark)', build: 'var(--principal)' }));

    this.gGrid = add(svg, g({ class: 'v-grid' }));
    this.gBuild = add(svg, g({ class: 'v-build' }));
    this.gCircle = add(svg, g({ class: 'v-circle-layer' }));
    this.gLines = add(svg, g({ class: 'v-radial' }));
    this.gArc = add(svg, g({ class: 'v-arc' }));
    this.gPts = add(svg, g({ class: 'v-points' }));
    this.gLab = add(svg, g({ class: 'v-clabels' }));
    this.gHit = add(svg, el('rect', { x: 0, y: 0, width: CV.w, height: CV.h, fill: 'transparent', class: 'v-hit' }));

    var self = this;
    svg.addEventListener('pointerdown', function (e) {
      if (!self.onRotate || self.buildStep >= 0) return;   // durante la construcción no se arrastra
      self.dragging = true; svg.setPointerCapture(e.pointerId); self.apply(e); e.preventDefault();
    });
    svg.addEventListener('pointermove', function (e) { if (self.dragging) self.apply(e); });
    svg.addEventListener('pointerup', function (e) { self.dragging = false; try { svg.releasePointerCapture(e.pointerId); } catch (err) {} });
    svg.addEventListener('pointercancel', function () { this.dragging = false; });
    svg.addEventListener('keydown', function (e) { handleKey(this, e); });
  }

  CircleView.prototype.apply = function (e) {
    if (!this.model) return;
    var c = this.model.c;
    if (c.R < 1e-12) return;
    var p = toLocal(this.svg, e, this.vb);
    var g = this.proj;
    if (!g) return;
    // Posición del puntero en unidades de esfuerzo; se proyecta sobre el círculo.
    // cx es la posición de C, luego hay que volver a σ desde σavg.
    var sig = (p.x - g.cx) / g.k + g.avg;
    var tau = -(p.y - g.cy) / g.k;
    // Restricción geométrica: P nunca sale de la circunferencia.
    var on = ML.mohr.projectOnCircle(c, sig, tau);
    var deg = ML.mohr.thetaFor(c, on.sigma, on.tau) * 180 / Math.PI;
    if (this.onRotate) this.onRotate(deg);
  };

  /**
   * @param m     modelo
   * @param build reloj de construcción: -1 = vista normal.  Si es ≥ 0, la parte
   *              entera es el último paso alcanzado y la parte fraccionaria anima
   *              el trazo del paso en curso.  Así el paso final coincide
   *              EXACTAMENTE con la vista interactiva: no hay dos dibujos.
   */
  CircleView.prototype.update = function (m, build) {
    this.model = m;
    var hasBuild = (build !== undefined && build !== null && build >= 0);
    this.buildStep = hasBuild ? Math.floor(build) : -1;
    var T = hasBuild ? build : 99;
    var at = function (n) { return T >= n; };
    var prog = function (n) { return T <= n ? 0 : Math.min(1, T - n); };

    var svg = this.svg, c = m.c, th = m.theta;
    var GR = this.gGrid, BL = this.gBuild, CI = this.gCircle, LN = this.gLines,
        AR = this.gArc, PT = this.gPts, LB = this.gLab;
    [GR, BL, CI, LN, AR, PT, LB].forEach(clear);
    if (!hasBuild) attr(svg, { 'data-theta': m.thetaDeg.toFixed(4) });

    // --- escala: aspecto 1:1 con margen reservado para las etiquetas ----------
    var ext = ML.mohr.sigmaExtent(c, th);
    var sc = circleScale(c, ext);
    var k = sc.k;
    var cx = CV.bx + CV.bw / 2, cy = CV.by + CV.bh / 2;
    var rpx = c.R * k;
    /* PROYECCIÓN DEL EJE σ.
       El centro de la circunferencia C = (σavg, 0) se dibuja en el centro del
       marco, luego
             X(σ) = cx + (σ − σavg)·k
       y el cero σ = 0 cae en cx − σavg·k, dentro o fuera del marco.  No existe
       ningún desplazamiento artificial: originOffScale es sólo el aviso de que
       el cero no es visible.

       circleScale() es el ÚNICO lugar que decide la escala.  No hay una segunda
       corrección «por si acaso» aquí: cuando elige kFit garantiza por
       construcción que el origen cabe
         · ext incluye siempre el 0        ⇒  halfX ≥ |σavg|
         · kFit ≤ (bw/2 − label)/halfX    ⇒  |σavg|·kFit ≤ bw/2 − label = 206 px
       y el centro está a 250 px del borde, de modo que el 0 siempre es visible.
       Cuando el círculo resultaría ilegible, circleScale() cambia a kCircle y
       marca originOffScale.

       Una corrección segunda calculara mal el espacio disponible
       (min(CV.bx, CV.w−CV.bx) = 88 px en lugar de los 250 px reales), encogía el
       círculo en casi todos los estados y hacía que la escala partiese de 0,5 a
       8,0 al mover un deslizador. */
    var X = function (sg) { return cx + (sg - c.avg) * k; };
    var Y = function (t) { return cy - t * k; };
    this.proj = { k: k, cx: cx, cy: cy, avg: c.avg };
    this.originOffScale = sc.originOffScale;
    // Un punto (σ,τ) cae dentro del marco de trazado si su proyección de
    // pantalla está dentro del marco (con un pequeño margen para los rótulos).
    var inBox = function (sg, tt) {
      var px = cx + (sg - c.avg) * k, py = cy - tt * k;
      return px >= CV.bx - 2 && px <= CV.bx + CV.bw + 2 && py >= CV.by - 2 && py <= CV.by + CV.bh + 2;
    };

    /* --- retícula: se traza sobre la ventana VISIBLE, no sobre la extensión de
       datos.  Si el origen queda fuera de escala, la extensión de datos puede
       abarcar miles de veces la ventana y el número de líneas sería enorme. */
    var winLoX = c.avg + (CV.bx - cx) / k, winHiX = c.avg + (CV.bx + CV.bw - cx) / k;
    var winHiT = (cy - CV.by) / k, winLoT = (cy - (CV.by + CV.bh)) / k;
    var spanX = winHiX - winLoX, spanT = winHiT - winLoT;
    var MAXD = 40;                                   // tope de divisiones por eje
    var step = niceStep(Math.max(spanX, spanT) / 8);
    if (spanX / step > MAXD) step = niceStep(spanX / MAXD);
    if (spanT / step > MAXD) step = niceStep(spanT / MAXD);
    var v, i;
    for (v = Math.ceil(winLoX / step) * step; v <= winHiX + step * 1e-6; v += step) {
      if (Math.abs(v) < step * 1e-6) continue;
      var gx = X(v);
      if (gx < CV.bx - 0.5 || gx > CV.bx + CV.bw + 0.5) continue;
      add(GR, el('line', { x1: gx, y1: CV.by, x2: gx, y2: CV.by + CV.bh, class: 'v-gridline' }));
      add(GR, el('text', { x: gx, y: cy + 16, 'text-anchor': 'middle', class: 'v-tick' },
                   ML.format.axisValue(v, step)));
    }
    for (v = Math.ceil(winLoT / step) * step; v <= winHiT + step * 1e-6; v += step) {
      if (Math.abs(v) < step * 1e-6) continue;
      var gy = Y(v);
      if (gy < CV.by - 0.5 || gy > CV.by + CV.bh + 0.5) continue;
      add(GR, el('line', { x1: CV.bx, y1: gy, x2: CV.bx + CV.bw, y2: gy, class: 'v-gridline' }));
      add(GR, el('text', { x: cx - 9, y: gy + 3.4, 'text-anchor': 'end', class: 'v-tick' },
                   ML.format.axisValue(v, step)));
    }
    add(GR, el('line', { x1: CV.bx, y1: cy, x2: CV.bx + CV.bw, y2: cy, class: 'v-axis' }));
    add(GR, el('line', { x1: cx, y1: CV.by, x2: cx, y2: CV.by + CV.bh, class: 'v-axis' }));
    add(GR, el('rect', { x: CV.bx, y: CV.by, width: CV.bw, height: CV.bh, class: 'v-plot-frame' }));
    add(GR, el('circle', { cx: cx, cy: cy, r: 2, class: 'v-centre-dot' }));
    if (!sc.originOffScale) {
      // El cero es visible: se marca en su posición real sobre el eje.
      add(GR, el('line', { x1: X(0), y1: cy - 4, x2: X(0), y2: cy + 4, class: 'v-origin' }));
      add(GR, el('text', { x: X(0) - 6, y: cy + 16, 'text-anchor': 'end', class: 'v-tick v-tick-zero' }, '0'));
    } else {
      var ox0 = X(0) < cx ? CV.bx + 2 : CV.bx + CV.bw - 2;
      add(GR, el('line', { x1: ox0, y1: cy - 15, x2: ox0, y2: cy + 15, class: 'v-offscale-tick' }));
      // La etiqueta se coloca hacia el lado con espacio y se recorta al lienzo.
      var offTxt = 'σ = 0 fuera de escala', offW = offTxt.length * 5.1;
      var anc = X(0) < cx ? 'start' : 'end';
      var lx = ox0 + (anc === 'start' ? 6 : -6);
      if (anc === 'start' && lx + offW > CV.w - 4) { anc = 'end'; lx = ox0 - 6; }
      if (anc === 'end' && lx - offW < 4) { anc = 'start'; lx = ox0 + 6; }
      add(GR, el('text', { x: lx, y: cy - 20, 'text-anchor': anc, class: 'v-offscale' }, offTxt));
    }
    add(GR, el('text', { x: CV.bx + CV.bw, y: cy + 32, 'text-anchor': 'end', class: 'v-axis-title' },
               'σ  [' + ML.format.unit + ']'));
    add(GR, el('text', { x: cx - 13, y: CV.by + 12, 'text-anchor': 'end', class: 'v-axis-title' },
               'τ  [' + ML.format.unit + ']'));

    var A = m.pts.A, B = m.pts.B, Pp = m.pts.P, R = c.R;

    /* ══════════════ PASOS DE LA CONSTRUCCIÓN (0 … 7) ══════════════════════
       0  D y E sobre el eje σ
       1  segmentos de cortante → A y B, con los catetos del Triedro de Gauss
       2  AB es un diámetro → se marca el centro C
       3  se traza la circunferencia de radio R
       4  σ1 y σ2, intersecciones con el eje σ
       5  τmax, intersecciones con la vertical por C
       6  P: el radio CA barrido un ángulo 2θ en sentido horario
       7  construcción cerrada: estado completo e interactivo                */
    if (at(0)) {
      [{ s: m.st.xx, t: 'D' }, { s: m.st.yy, t: 'E' }].forEach(function (d) {
        if (!inBox(d.s, 0)) return;                 // fuera de la ventana visible
        if (Math.abs(d.s) > 1e-12) {
          add(BL, el('line', { x1: X(d.s), y1: cy - 6, x2: X(d.s), y2: cy + 6, class: 'v-aux' }));
        }
        add(LB, el('text', { x: X(d.s), y: cy - 11, 'text-anchor': 'middle', class: 'v-aux-tag' },
                   d.t + ' (' + ML.format.stressDisplay(d.s) + ', 0)'));
      });
    }
    if (at(1)) {
      [[m.st.xx, A.tau, 'v-build-a'], [m.st.yy, B.tau, 'v-build-b']].forEach(function (d) {
        if (!inBox(d[0], 0) && !inBox(d[0], d[1])) return;
        var len = Math.abs(d[1]) * k;
        if (len > 0.6) {
          drawIn(add(BL, el('line', { x1: X(d[0]), y1: cy, x2: X(d[0]), y2: Y(d[1]),
                                      class: 'v-build-seg ' + d[2] })), len, prog(1));
        } else {
          add(BL, el('circle', { cx: X(d[0]), cy: cy, r: 2.6, class: 'v-build-pt ' + d[2] }));
        }
        add(BL, el('circle', { cx: X(d[0]), cy: Y(d[1]), r: 4.2, class: 'v-build-pt ' + d[2] }));
      });
      // Catetos del Triedro de Gauss, rotulados con su longitud real
      var legH = Math.abs(m.st.xx - m.st.yy) * k, legV = Math.abs(2 * m.st.xy) * k;
      var up = A.tau >= 0;
      if (legH > 10 && inBox(m.st.xx, 0) && inBox(m.st.yy, 0)) {
        var ly = cy + (up ? 22 : -16);
        drawIn(add(BL, el('line', { x1: X(m.st.yy), y1: ly, x2: X(m.st.xx), y2: ly, class: 'v-leg' })), legH, prog(1));
        add(LB, el('text', { x: (X(m.st.yy) + X(m.st.xx)) / 2, y: ly + (up ? 14 : -5),
                             'text-anchor': 'middle', class: 'v-leg-tag' },
                   '|σx − σy| = ' + ML.format.stressDisplay(Math.abs(m.st.xx - m.st.yy))));
      }
      if (legV > 16 && inBox(m.st.xx, A.tau) && inBox(m.st.xx, B.tau)) {
        var lx = X(m.st.xx) + (up ? 9 : -9);
        drawIn(add(BL, el('line', { x1: lx, y1: Y(A.tau), x2: lx, y2: Y(B.tau), class: 'v-leg' })), legV, prog(1));
        var legTxt = '2τxy = ' + ML.format.stressDisplay(Math.abs(2 * m.st.xy));
        var legAnc = up ? 'start' : 'end', legLx = lx + (up ? 6 : -6);
        if (legAnc === 'start' && legLx + legTxt.length * 5.4 > CV.w - 4) legAnc = 'end';
        if (legAnc === 'end' && legLx - legTxt.length * 5.4 < 4) legAnc = 'start';
        add(LB, el('text', { x: legLx, y: (Y(A.tau) + Y(B.tau)) / 2,
                             'text-anchor': legAnc, class: 'v-leg-tag' }, legTxt));
      }
    }
    if (at(2) && inBox(A.sigma, A.tau) && inBox(B.sigma, B.tau)) {
      drawIn(add(BL, el('line', { x1: X(A.sigma), y1: Y(A.tau), x2: X(B.sigma), y2: Y(B.tau),
                                  class: 'v-build-diam' })),
             Math.hypot(A.sigma - B.sigma, A.tau - B.tau) * k, prog(2));
    }
    if (at(3)) {
      add(CI, el('line', { x1: cx, y1: cy - 5, x2: cx, y2: cy + 5, class: 'v-centre' }));
      add(CI, el('line', { x1: cx - 5, y1: cy, x2: cx + 5, y2: cy, class: 'v-centre' }));
      add(CI, el('text', { x: cx + 9, y: cy - 8, class: 'v-centre-tag' },
                 'C   σavg = ' + ML.format.stressDisplay(c.avg)));
      if (c.hydro) {
        add(CI, el('circle', { cx: cx, cy: cy, r: 5.5, class: 'v-circle-degenerate' }));
      } else {
        drawIn(add(CI, el('circle', { cx: cx, cy: cy, r: rpx.toFixed(2), class: 'v-circle' })),
               2 * Math.PI * rpx, prog(3));
        drawIn(add(CI, el('line', { x1: cx, y1: cy, x2: cx + rpx, y2: cy, class: 'v-radius' })), rpx, prog(3));
        add(LB, el('text', { x: cx + rpx / 2, y: cy - 8, 'text-anchor': 'middle', class: 'v-leg-tag' },
                   'R = ' + ML.format.stressDisplay(R)));
      }
    }
    if (at(4)) {
      add(PT, el('path', { d: 'M 0,-7.4 L 6.4,4.6 L -6.4,4.6 Z',
                           transform: 'translate(' + X(c.s1).toFixed(2) + ',' + Y(0).toFixed(2) + ')',
                           class: 'v-pt-tension' }));
      add(PT, el('path', { d: 'M 0,7.4 L 6.4,-4.6 L -6.4,-4.6 Z',
                           transform: 'translate(' + X(c.s2).toFixed(2) + ',' + Y(0).toFixed(2) + ')',
                           class: 'v-pt-compression' }));
    }
    if (at(5) && !c.hydro) {
      drawIn(add(BL, el('line', { x1: cx, y1: Y(c.R), x2: cx, y2: Y(-c.R), class: 'v-build-seg v-build-c' })),
             2 * rpx, prog(5));
      add(PT, el('path', { d: 'M 6.6,-6 L -4,0 L 6.6,6 Z',
                           transform: 'translate(' + X(c.avg).toFixed(2) + ',' + Y(c.R).toFixed(2) + ')',
                           class: 'v-pt-shear' }));
      add(PT, el('path', { d: 'M -6.6,-6 L 4,0 L -6.6,6 Z',
                           transform: 'translate(' + X(c.avg).toFixed(2) + ',' + Y(-c.R).toFixed(2) + ')',
                           class: 'v-pt-shear' }));
    }
    if (at(6) && !c.hydro) {
      add(LN, el('line', { x1: cx, y1: cy, x2: X(A.sigma), y2: Y(A.tau), class: 'v-radial v-radial-a' }));
      drawIn(add(LN, el('line', { x1: cx, y1: cy, x2: X(Pp.sigma), y2: Y(Pp.tau), class: 'v-radial v-radial-p',
                                  'marker-end': 'url(#ci-mk-accent)' })), rpx, prog(6));
      var two = 2 * th;
      if (two > 1e-3 && two < 2 * Math.PI - 1e-3) {
        var ra = rpx * 0.52, p1 = c.angleA, p2 = c.angleA - two, large = two > Math.PI ? 1 : 0;
        add(AR, el('path', { d: 'M ' + (cx + ra * Math.cos(p1)).toFixed(2) + ' ' + (cy - ra * Math.sin(p1)).toFixed(2)
                                + ' A ' + ra + ' ' + ra + ' 0 ' + large + ' 1 '
                                + (cx + ra * Math.cos(p2)).toFixed(2) + ' ' + (cy - ra * Math.sin(p2)).toFixed(2),
                            class: 'v-arc-2t' }));
        var pm = p1 - two / 2;
        add(AR, el('text', { x: cx + (ra + 15) * Math.cos(pm), y: cy - (ra + 15) * Math.sin(pm) + 3.5,
                             'text-anchor': 'middle', class: 'v-arc-tag' },
                   ML.format.angle(2 * m.thetaDeg, 1)));
      }
      add(PT, el('circle', { cx: X(Pp.sigma), cy: Y(Pp.tau), r: 11, class: 'v-pt-p-halo' }));
      add(PT, el('circle', { cx: X(Pp.sigma), cy: Y(Pp.tau), r: 5.6, class: 'v-pt-p' }));
    }
    if (at(7)) {
      add(PT, el('rect', { x: X(A.sigma) - 4.6, y: Y(A.tau) - 4.6, width: 9.2, height: 9.2, class: 'v-pt-a' }));
      if (!c.hydro) {
        add(PT, el('rect', { x: X(B.sigma) - 4.6, y: Y(B.tau) - 4.6, width: 9.2, height: 9.2, class: 'v-pt-b' }));
      }
    }

    /* --- Etiquetas: nunca fuera del lienzo, nunca solapadas ---------------- */
    var placer = new LabelPlacer();
    function place(anchor, x, y, w, cls, text) {
      var left = anchor === 'end' ? x - w : (anchor === 'middle' ? x - w / 2 : x);
      if (left < 4) x += 4 - left;
      if (left + w > CV.w - 4) x -= (left + w) - (CV.w - 4);
      if (y < 12) y = 12;
      if (y > CV.h - 4) y = CV.h - 4;
      placer.take(x - (anchor === 'end' ? w : (anchor === 'middle' ? w / 2 : 0)), y - 10, w, 13);
      add(LB, el('text', { x: x, y: y, 'text-anchor': anchor, class: cls }, text));
    }
    function radialLabel(sig, tau, text, cls, extraR) {
      var dx = sig - c.avg, dy = tau, len = Math.hypot(dx, dy) || 1;
      var ux = dx / len, uy = dy / len, rr = rpx + (extraR || 15);
      var anc = ux > 0.35 ? 'start' : (ux < -0.35 ? 'end' : 'middle');
      var w = text.length * 5.4, cands = [];
      [0, 14, -11, 28, -25].forEach(function (d2) {
        cands.push([cx + ux * rr, cy - uy * rr + d2 + 3.5]);
      });
      var f = cands[placer.pick(cands.map(function (q) { return [q[0], q[1], anc, w, q[0], q[1]]; }))];
      place(anc, f[0], f[1], w, cls, text);
    }
    function axisLabel(sig, text, cls, above) {
      place('middle', X(sig), above ? Y(0) - 11 : Y(0) + 20, text.length * 5.4, cls, text);
    }

    if (at(4)) {
      axisLabel(c.s1, 'σ₁ = ' + ML.format.stressDisplay(c.s1), 'v-clabel v-clabel-principal', true);
      axisLabel(c.s2, 'σ₂ = ' + ML.format.stressDisplay(c.s2), 'v-clabel v-clabel-principal', false);
    }
    if (at(5) && !c.hydro) {
      radialLabel(c.avg, c.R, 'τmax = ' + ML.format.stressDisplay(R), 'v-clabel v-clabel-shear', 16);
    }
    if (at(6) && !c.hydro) {
      radialLabel(Pp.sigma, Pp.tau, 'P  (' + ML.format.stressDisplay(Pp.sigma) + ', ' + ML.format.stressDisplay(Pp.tau) + ')', 'v-clabel v-clabel-p', 28);
    }
    if (at(7)) {
      radialLabel(A.sigma, A.tau, 'A  (' + ML.format.stressDisplay(A.sigma) + ', ' + ML.format.stressDisplay(A.tau) + ')', 'v-clabel v-clabel-ref', 16);
      if (!c.hydro) {
        radialLabel(B.sigma, B.tau, 'B  (' + ML.format.stressDisplay(B.sigma) + ', ' + ML.format.stressDisplay(B.tau) + ')', 'v-clabel v-clabel-ref', 16);
      }
    }
  };

  /* ══════════════════════════════════════════════════════════════════════════
   * PASOS DIDÁCTICOS DE LA CONSTRUCCIÓN DEL CÍRCULO
   * Cada paso expone el título, la explicación y la fórmula con los números
   * del estado actual, calculados a partir del MISMO modelo que la pantalla.
   * ══════════════════════════════════════════════════════════════════════════ */
  function buildSteps(m) {
    var st = m.st, c = m.c, f = ML.format;
    var s = function (x) { return f.stress(x); };
    var steps = [
      { n: 1, t: 'El estado sobre el eje σ',
        d: 'Se trasladan los dos esfuerzos normales al eje σ como puntos D = (σx, 0) y E = (σy, 0). '
         + 'D representa la cara +x del elemento y E la cara +y.',
        f: 'D = (σx, 0) = (' + s(st.xx) + ', 0)  ·  E = (σy, 0) = (' + s(st.yy) + ', 0)' },
      { n: 2, t: 'Los cortantes, opuestos y de igual módulo',
        d: 'El cortante τxy actúa hacia un lado en la cara +x y hacia el contrario en la cara +y. '
         + 'Desde D se traza un segmento vertical de longitud τxy hasta A = (σx, τxy) y desde E otro de '
         + 'longitud −τxy hasta B = (σy, −τxy). D y E son los catetos y AB la hipotenusa del Triedro de Gauss.',
        f: 'A = (σx, τxy) = (' + s(st.xx) + ', ' + s(st.xy) + ')  ·  B = (σy, −τxy) = (' + s(st.yy) + ', ' + s(-st.xy) + ')'
         + '  ·  |AB| = √((σx−σy)² + 4τxy²) = ' + s(2 * c.R) },
      { n: 3, t: 'El centro: punto medio de un diámetro',
        d: 'A y B son diametralmente opuestos, luego AB es un diámetro y su punto medio es el centro C. '
         + 'C projected sobre el eje σ es exactamente σavg, la semisuma de las normales.',
        f: 'C = ((σx+σy)/2, 0) = (' + s(c.avg) + ', 0)  ·  σavg = ' + s(c.avg) },
      { n: 4, t: 'La circunferencia de Mohr',
        d: 'Se traza con el compás la circunferencia de centro C y radio R = |AB|/2. '
         + 'Todos los estados posibles de un plano del elemento están sobre ella.',
        f: 'R = |AB|/2 = √(((σx−σy)/2)² + τxy²) = ' + s(c.R) },
      { n: 5, t: 'Los esfuerzos principales',
        d: 'Son los puntos donde la circunferencia corta el eje σ. Coinciden con los valores normal y '
         + 'cortante de un plano sin cortante.',
        f: 'σ1 = σavg + R = ' + s(c.avg + c.R) + '  ·  σ2 = σavg − R = ' + s(c.avg - c.R) },
      { n: 6, t: 'El esfuerzo cortante máximo',
        d: 'Son los puntos donde corta la vertical que pasa por C. allí el esfuerzo normal vale σavg y el '
         + 'cortante es el mayor posible en el plano.',
        f: 'τmax = R = ' + s(c.R) + '  a σ = σavg = ' + s(c.avg) },
      { n: 7, t: 'El punto P: la relación 2θ',
        d: 'A corresponde a la cara +x, es decir θ = 0. Al girar el elemento un ángulo θ, el radio CA barre '
         + 'sobre la circunferencia un ángulo 2θ en sentido HORARIO, y su extremo es P. Ésta es la razón de que '
         + 'el ángulo en el círculo sea el doble del ángulo físico y de sentido opuesto.',
        f: '2θ = ' + f.angle(2 * m.thetaDeg, 2) + '  ·  P = (σθ, τθ) = (' + s(m.tr.sigma) + ', ' + s(m.tr.tau) + ')'
         + '  ·  θ_Mohr = 2·θ_físico' },
      { n: 8, t: 'Construcción cerrada',
        d: 'El círculo queda determinado por los tres componentes del estado: A y B fijan un diámetro, C su '
         + 'centro y R su radio. θ sólo mueve P. La simulación vuelve a ser interactiva.',
        f: 'σ1 = ' + s(c.s1) + '  ·  σ2 = ' + s(c.s2) + '  ·  τmax = ' + s(c.tauMax)
         + '  ·  θp = ' + (m.pa.hydro ? 'no definido' : f.angle(m.pa.thetaPdeg, 3)) }
    ];
    return steps;
  }

  /**
   * Mini-diagrama del papel geométrico de un parámetro, dibujado a partir del
   * modelo real (no esquemático): dónde actúa σx, σy, τxy y θ en la construcción.
   * @param which 'sx' | 'sy' | 'txy' | 'theta'
   */
  function paramRole(m, which) {
    var W = 168, H = 92, c = m.c;
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'viz viz-role' });
    var f = ML.format;
    // Extensión común: de min(0,σ1,σ2) a max(0,σ1,σ2) con un margen
    var lo = Math.min(0, c.s2, m.st.xx, m.st.yy);
    var hi = Math.max(0, c.s1, m.st.xx, m.st.yy);
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    var pad = (hi - lo) * 0.12;
    lo -= pad; hi += pad;
    var kx = (W - 24) / (hi - lo);
    var ox = 12, oy = H * 0.5;
    var X = function (s) { return ox + (s - lo) * kx; };
    var Y = function (t) { return oy - t * kx; };
    var kr = Math.min(kx, H / 2 - 12) / Math.max(c.R, 1e-9);

    // eje σ
    add(svg, el('line', { x1: 4, y1: oy, x2: W - 4, y2: oy, class: 'v-aux-axis' }));
    add(svg, el('text', { x: W - 4, y: oy + 13, 'text-anchor': 'end', class: 'v-aux-mini' }, 'σ'));
    add(svg, el('text', { x: X(0) + 3, y: oy + 13, class: 'v-aux-mini' }, '0'));
    if (c.R > 1e-9) {
      add(svg, el('circle', { cx: X(c.avg), cy: oy, r: (c.R * kr).toFixed(2), class: 'v-circle' }));
    }

    if (which === 'sx') {
      add(svg, el('line', { x1: X(m.st.xx), y1: oy, x2: X(m.st.xx), y2: Y(m.pts.A.tau), class: 'v-build-seg v-build-a' }));
      add(svg, el('circle', { cx: X(m.st.xx), cy: Y(m.pts.A.tau), r: 3.4, class: 'v-build-pt v-build-a' }));
      add(svg, el('text', { x: X(m.st.xx), y: oy - 6, 'text-anchor': 'middle', class: 'v-aux-mini v-aux-hi' },
                 'D → A'));
    } else if (which === 'sy') {
      add(svg, el('line', { x1: X(m.st.yy), y1: oy, x2: X(m.st.yy), y2: Y(m.pts.B.tau), class: 'v-build-seg v-build-b' }));
      add(svg, el('circle', { cx: X(m.st.yy), cy: Y(m.pts.B.tau), r: 3.4, class: 'v-build-pt v-build-b' }));
      add(svg, el('text', { x: X(m.st.yy), y: oy - 6, 'text-anchor': 'middle', class: 'v-aux-mini v-aux-hi' }, 'E → B'));
    } else if (which === 'txy') {
      add(svg, el('line', { x1: X(m.st.xx), y1: oy, x2: X(m.st.xx), y2: Y(m.pts.A.tau), class: 'v-build-seg v-build-a' }));
      add(svg, el('line', { x1: X(m.st.yy), y1: oy, x2: X(m.st.yy), y2: Y(m.pts.B.tau), class: 'v-build-seg v-build-b' }));
      add(svg, el('line', { x1: X(m.st.xx), y1: Y(m.pts.B.tau), x2: X(m.st.xx), y2: Y(m.pts.A.tau), class: 'v-leg' }));
      add(svg, el('text', { x: X(m.st.xx) + 4, y: oy - 4, class: 'v-aux-mini v-aux-hi' },
                 '2τxy = ' + f.stressDisplay(Math.abs(2 * m.st.xy))));
    } else {
      // θ: ángulo 2θ entre A y P
      var r = c.R * kr, cx0 = X(c.avg);
      var a1 = c.angleA, a2 = c.angleA - 2 * m.theta;
      add(svg, el('line', { x1: cx0, y1: oy, x2: cx0 + r * Math.cos(a1), y2: oy - r * Math.sin(a1), class: 'v-radial v-radial-a' }));
      add(svg, el('line', { x1: cx0, y1: oy, x2: cx0 + r * Math.cos(a2), y2: oy - r * Math.sin(a2), class: 'v-radial v-radial-p' }));
      var two = 2 * m.theta;
      if (two > 1e-3 && two < 2 * Math.PI - 1e-3) {
        add(svg, el('path', { d: 'M ' + (cx0 + r * 0.62 * Math.cos(a1)).toFixed(2) + ' ' + (oy - r * 0.62 * Math.sin(a1)).toFixed(2)
          + ' A ' + (r * 0.62).toFixed(2) + ' ' + (r * 0.62).toFixed(2) + ' 0 ' + (two > Math.PI ? 1 : 0) + ' 1 '
          + (cx0 + r * 0.62 * Math.cos(a2)).toFixed(2) + ' ' + (oy - r * 0.62 * Math.sin(a2)).toFixed(2), class: 'v-arc-2t' }));
      }
      add(svg, el('circle', { cx: cx0 + r * Math.cos(a2), cy: oy - r * Math.sin(a2), r: 3.6, class: 'v-pt-p' }));
      add(svg, el('text', { x: cx0 + r * Math.cos(a2) + 5, y: oy - r * Math.sin(a2) + 3, class: 'v-aux-mini v-aux-hi' }, 'P'));
      add(svg, el('text', { x: 6, y: oy + 13, class: 'v-aux-mini v-aux-hi' }, '2θ = ' + f.angle(2 * m.thetaDeg, 1)));
    }
    return svg;
  }

  // ---------------------------------------------------------------------------
  // Visor 3 · Extensión: los tres círculos de Mohr en 3D
  // ---------------------------------------------------------------------------

  function Mohr3DView(svg) {
    this.svg = svg;
    this.vb = { w: 420, h: 300 };
    attr(svg, { viewBox: '0 0 420 300', width: 420, height: 300, class: 'viz viz-3d' });
    clear(svg);
    this.g = add(svg, g());
  }

  Mohr3DView.prototype.update = function (p3, unit) {
    var G = this.g; clear(G);
    var lo = 0, hi = 0;
    p3.circles.forEach(function (cc) { lo = Math.min(lo, cc.c - cc.r); hi = Math.max(hi, cc.c + cc.r); });
    var span = Math.max(hi - lo, 1e-9), pad = span * 0.09;
    lo -= pad; hi += pad;
    var bx = 46, bw = 362, by = 18, bh = 244;
    // Una sola escala para ambos ejes: los tres círculos deben ser círculos.
    var Rmax = Math.max.apply(null, p3.circles.map(function (c) { return c.r; }));
    var k = Math.min(bw / (hi - lo), bh / (2 * (Rmax + pad)));
    var cx = bx + bw / 2, cy = by + bh / 2;
    var X = function (s) { return cx + (s - (lo + hi) / 2) * k; };
    var step = niceStep(66 / k);
    for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      if (Math.abs(v) < step * 1e-6) continue;
      add(G, el('line', { x1: bx, y1: cy, x2: bx + bw, y2: cy, class: 'v-gridline' }));
      add(G, el('text', { x: X(v), y: cy + 15, 'text-anchor': 'middle', class: 'v-tick' }, ML.format.axisValue(v, step)));
    }
    for (var t = -Rmax - pad; t <= Rmax + pad; t += step) {
      if (Math.abs(t) < step * 1e-6) continue;
      add(G, el('line', { x1: X((lo + hi) / 2), y1: cy - t * k, x2: X((lo + hi) / 2), y2: cy + t * k, class: 'v-gridline' }));
      add(G, el('text', { x: X((lo + hi) / 2) - 8, y: cy - t * k + 3.4, 'text-anchor': 'end', class: 'v-tick' },
                 ML.format.axisValue(t, step)));
    }
    add(G, el('line', { x1: bx, y1: cy, x2: bx + bw, y2: cy, class: 'v-axis' }));

    /* Los tres círculos de Mohr son coaxiales: comparten el eje σ y sus centros
       están sobre él.  Se rotulan C1 = (σ1,σ2), C2 = (σ2,σ3) y C3 = (σ1,σ3), y se
       marca C3 como la circunferencia dominante, que es la que gobierna el
       criterio de fallo.  Las líneas de trazos son la construcción: la vertical
       lleva cada centro al eje σ y la horizontal marca el radio. */
    var styles = ['v-circle3d-c1', 'v-circle3d-c2', 'v-circle3d-c3'];
    var names = ['C₁', 'C₂', 'C₃'];
    p3.circles.forEach(function (cc, i) {
      var cxp = X(cc.c), rp = cc.r * k, gov = (i === 2);
      // Construcción: vertical desde el centro al eje, y radio horizontal
      add(G, el('line', { x1: cxp, y1: cy, x2: cxp, y2: cy + rp, class: 'v-constr' }));
      add(G, el('line', { x1: cxp, y1: cy, x2: cxp + rp, y2: cy, class: 'v-constr' }));
      // Marca del centro sobre el eje
      add(G, el('line', { x1: cxp, y1: cy - 4, x2: cxp, y2: cy + 4, class: 'v-constr-centre' }));
      // Extremos sobre el eje σ
      add(G, el('line', { x1: cxp - rp, y1: cy - 4, x2: cxp - rp, y2: cy + 4, class: 'v-constr-ext' }));
      add(G, el('line', { x1: cxp + rp, y1: cy - 4, x2: cxp + rp, y2: cy + 4, class: 'v-constr-ext' }));
      add(G, el('circle', { cx: cxp, cy: cy, r: rp.toFixed(2), class: 'v-circle3d ' + styles[i] }));
      // Nombre del círculo, dentro de la circunferencia
      add(G, el('text', { x: cxp, y: cy - rp * 0.42, 'text-anchor': 'middle',
                         class: 'v-c3d-name ' + styles[i] }, names[i]));
      add(G, el('text', { x: cxp, y: cy - rp * 0.42 + 13, 'text-anchor': 'middle',
                         class: 'v-c3d-sub ' + styles[i] },
                 (cc.from !== cc.to ? (cc.label + '  R = ' + ML.format.stressDisplay(cc.r)) : '')));
    });
    [[p3.s1, 'σ1', 'v-pt-tension'], [p3.s2, 'σ2', 'v-pt-shear'],
     [p3.s3, 'σ3', 'v-pt-compression']].forEach(function (s) {
      add(G, el('circle', { cx: X(s[0]), cy: cy, r: 3, class: s[2] }));
      add(G, el('text', { x: X(s[0]), y: cy + 27, 'text-anchor': 'middle', class: 'v-clabel3d' },
                 s[1] + ' = ' + ML.format.stressDisplay(s[0])));
    });
    add(G, el('text', { x: bx + bw, y: cy + 41, 'text-anchor': 'end', class: 'v-axis-title' },
               'σ  [' + ML.format.unit + ']'));
  };

  ML.viz = {
    el: el, g: g, add: add, clear: clear, attr: attr,
    niceStep: niceStep, defs: defs, toLocal: toLocal, LabelPlacer: LabelPlacer,
    ElementView: ElementView,
    CircleView: CircleView,
    Mohr3DView: Mohr3DView,
    buildSteps: buildSteps,
    paramRole: paramRole
  };

})(typeof window !== 'undefined'
  ? (window.MohrLab = window.MohrLab || {})
  : (global.MohrLab = global.MohrLab || {}));
