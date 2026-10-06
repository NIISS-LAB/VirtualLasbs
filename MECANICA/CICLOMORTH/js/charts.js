/* =============================================================================
 * MOHR LAB — charts.js
 * Gráfica σθ = f(θ) y τθ = f(θ) para 0° ≤ θ ≤ 180°  (§9)
 *
 * Las curvas se muestrean sobre las ecuaciones de transformación; hacer clic o
 * arrastrar sobre la gráfica fija θ y sincroniza el resto de la aplicación.
 * ========================================================================== */
(function (ML) {
  'use strict';

  var V = ML.viz;
  var el = V.el, g = V.g, add = V.add, clear = V.clear, attr = V.attr;

  var CH = { w: 760, h: 300, bx: 64, by: 20, bw: 684, bh: 234 };
  var N = 361;                       // muestras: 0.5° de resolución

  function AngularView(svg, opts) {
    this.svg = svg;
    this.vb = { w: CH.w, h: CH.h };
    attr(svg, { viewBox: '0 0 ' + CH.w + ' ' + CH.h, width: CH.w, height: CH.h,
                class: 'viz viz-chart', tabindex: '0', role: 'application' });
    clear(svg);
    this.gGrid = add(svg, g({ class: 'v-grid' }));
    this.gRef = add(svg, g({ class: 'v-ref' }));
    this.gCurves = add(svg, g({ class: 'v-curves' }));
    this.gMark = add(svg, g({ class: 'v-mark' }));
    this.gLab = add(svg, g({ class: 'v-clabels' }));
    this.gHit = add(svg, el('rect', { x: 0, y: 0, width: CH.w, height: CH.h, fill: 'transparent', class: 'v-hit' }));

    var self = this;
    svg.addEventListener('pointerdown', function (e) {
      if (!self.onRotate) return;
      self.dragging = true; svg.setPointerCapture(e.pointerId); self.apply(e); e.preventDefault();
    });
    svg.addEventListener('pointermove', function (e) { if (self.dragging) self.apply(e); });
    svg.addEventListener('pointerup', function (e) { self.dragging = false; try { svg.releasePointerCapture(e.pointerId); } catch (err) {} });
    svg.addEventListener('pointercancel', function () { self.dragging = false; });
    svg.addEventListener('keydown', function (e) { self.key(e); });
  }

  AngularView.prototype.apply = function (e) {
    var p = V.toLocal(this.svg, e, this.vb);
    var deg = (p.x - CH.bx) / CH.bw * 180;
    deg = Math.max(0, Math.min(180, deg));
    if (this.onRotate) this.onRotate(deg);
  };
  AngularView.prototype.key = function (e) {
    var step = e.shiftKey ? 5 : 0.5, cur = parseFloat(this.svg.getAttribute('data-theta')) || 0, d = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = -step;
    else return;
    e.preventDefault();
    if (this.onRotate) this.onRotate(cur + d);
  };

  AngularView.prototype.update = function (m, show) {
    this.model = m;
    var c = m.c, st = m.st;
    var GR = this.gGrid, RF = this.gRef, CU = this.gCurves, MK = this.gMark, LB = this.gLab;
    [GR, RF, CU, MK, LB].forEach(clear);
    attr(this.svg, { 'data-theta': m.thetaDeg.toFixed(4) });

    // --- escala vertical: abarca σθ ∈ [σ2,σ1] y τθ ∈ [−R,R] ----------------
    var lo = Math.min(c.s2, -c.R, 0), hi = Math.max(c.s1, c.R, 0);
    var span = Math.max(hi - lo, 1e-9);
    lo -= span * 0.10; hi += span * 0.10;
    var k = CH.bh / (hi - lo);
    var X = function (d) { return CH.bx + d / 180 * CH.bw; };
    var Y = function (s) { return CH.by + (hi - s) * k; };

    // --- retícula y ejes ------------------------------------------------------
    var step = V.niceStep(46 / k);
    for (var v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      if (Math.abs(v) < step * 1e-6) continue;
      add(GR, el('line', { x1: CH.bx, y1: Y(v), x2: CH.bx + CH.bw, y2: Y(v), class: 'v-gridline' }));
      add(GR, el('text', { x: CH.bx - 8, y: Y(v) + 3.4, 'text-anchor': 'end', class: 'v-tick' },
                   ML.format.axisValue(v, step)));
    }
    var dstep = 15;
    for (var d = 0; d <= 180; d += dstep) {
      add(GR, el('line', { x1: X(d), y1: CH.by, x2: X(d), y2: CH.by + CH.bh, class: d % 45 === 0 ? 'v-gridline v-gridline-major' : 'v-gridline' }));
      add(GR, el('text', { x: X(d), y: CH.by + CH.bh + 15, 'text-anchor': 'middle', class: 'v-tick' }, d + '°'));
    }
    add(GR, el('line', { x1: CH.bx, y1: Y(0), x2: CH.bx + CH.bw, y2: Y(0), class: 'v-axis' }));
    add(GR, el('rect', { x: CH.bx, y: CH.by, width: CH.bw, height: CH.bh, class: 'v-plot-frame' }));
    add(GR, el('text', { x: CH.bx, y: CH.by - 6, class: 'v-axis-title' }, 'σθ , τθ  [' + ML.format.unit + ']'));
    add(GR, el('text', { x: CH.bx + CH.bw, y: CH.by + CH.bh + 29, 'text-anchor': 'end', class: 'v-axis-title' }, 'θ  [°]'));

    // --- niveles de referencia: σ1, σ2, ±R -----------------------------------
    if (c.R > 1e-12) {
      [{ y: c.s1, t: 'σ₁' }, { y: c.s2, t: 'σ₂' }].forEach(function (r) {
        add(RF, el('line', { x1: CH.bx, y1: Y(r.y), x2: CH.bx + CH.bw, y2: Y(r.y), class: 'v-ref-principal' }));
        add(RF, el('text', { x: CH.bx + CH.bw - 3, y: Y(r.y) - 4, 'text-anchor': 'end', class: 'v-ref-label v-ref-principal' },
                     r.t + ' = ' + ML.format.stressDisplay(r.y)));
      });
      [{ y: c.R, t: '+τmax' }, { y: -c.R, t: '−τmax' }].forEach(function (r) {
        add(RF, el('line', { x1: CH.bx, y1: Y(r.y), x2: CH.bx + CH.bw, y2: Y(r.y), class: 'v-ref-shear' }));
        add(RF, el('text', { x: CH.bx + 3, y: r.y > 0 ? Y(r.y) - 4 : Y(r.y) + 12, 'text-anchor': 'start', class: 'v-ref-label v-ref-shear' },
                     r.t + ' = ±' + ML.format.stressDisplay(c.R)));
      });
    }

    // --- marcadores verticales de θp y θs ------------------------------------
    if (!m.pa.hydro) {
      [{ d: m.pa.thetaPdeg, t: 'θp', cls: 'v-ref-principal' },
       { d: m.pa.thetaSdeg, t: 'θs', cls: 'v-ref-shear' }].forEach(function (r) {
        if (r.d < 0 || r.d > 180) return;
        add(RF, el('line', { x1: X(r.d), y1: CH.by, x2: X(r.d), y2: CH.by + CH.bh, class: 'v-mark-line ' + r.cls }));
        add(RF, el('text', { x: X(r.d) + 3, y: CH.by + 11, class: 'v-ref-label ' + r.cls }, r.t));
      });
    }

    // --- curvas ---------------------------------------------------------------
    var pS = '', pT = '';
    for (var i = 0; i < N; i++) {
      var deg2 = i * 180 / (N - 1);
      var r = ML.tf.transform(st, deg2 * Math.PI / 180);
      pS += (i ? ' L ' : 'M ') + X(deg2).toFixed(2) + ' ' + Y(r.sigma).toFixed(2);
      pT += (i ? ' L ' : 'M ') + X(deg2).toFixed(2) + ' ' + Y(r.tau).toFixed(2);
    }
    if (show.sigma) add(CU, el('path', { d: pS, class: 'v-curve-sigma' }));
    if (show.tau) add(CU, el('path', { d: pT, class: 'v-curve-tau' }));

    // --- posición actual ------------------------------------------------------
    var dx = m.thetaDeg, tr = m.tr;
    add(MK, el('line', { x1: X(dx), y1: CH.by, x2: X(dx), y2: CH.by + CH.bh, class: 'v-cursor' }));
    if (show.sigma) {
      add(MK, el('circle', { cx: X(dx), cy: Y(tr.sigma), r: 4.4, class: 'v-cur-dot v-cur-sigma' }));
      add(LB, el('text', { x: X(dx) + (dx > 150 ? -7 : 7), y: Y(tr.sigma) - 8,
                           'text-anchor': dx > 150 ? 'end' : 'start', class: 'v-cur-label v-cur-sigma' },
                       'σθ = ' + ML.format.stressDisplay(tr.sigma)));
    }
    if (show.tau) {
      add(MK, el('circle', { cx: X(dx), cy: Y(tr.tau), r: 4.4, class: 'v-cur-dot v-cur-tau' }));
      add(LB, el('text', { x: X(dx) + (dx > 150 ? -7 : 7), y: Y(tr.tau) + 14,
                           'text-anchor': dx > 150 ? 'end' : 'start', class: 'v-cur-label v-cur-tau' },
                       'τθ = ' + ML.format.stressDisplay(tr.tau)));
    }
    add(LB, el('text', { x: X(dx), y: CH.by + CH.bh + 15, 'text-anchor': cursorAnchor(dx, 33),
                         class: 'v-cursor-tag' }, ML.format.angle(dx, 1)));
  };

  /** Anclaje que mantiene la etiqueta dentro del lienzo en los extremos. */
  function cursorAnchor(deg, w) {
    var x = CH.bx + deg / 180 * CH.bw;
    if (x + w / 2 > CH.w - 4) return 'end';
    if (x - w / 2 < 2) return 'start';
    return 'middle';
  }

  ML.charts = { AngularView: AngularView };

})(typeof window !== 'undefined'
  ? (window.MohrLab = window.MohrLab || {})
  : (global.MohrLab = global.MohrLab || {}));
