/* =============================================================================
 * MOHR LAB — equations.js
 * PRESENTACIÓN DE LA MATEMÁTICA en HTML.
 *
 * No se usa ninguna librería externa (ni MathJax ni KaTeX): las ecuaciones se
 * construyen con marcado propio y clases CSS (fracción, radical, matrices) para
 * que la aplicación sea totalmente autocontenida y funcione desde file://
 * sin conexión.
 *
 * Todas las sustituciones numéricas se hacen en la UNIDAD ACTIVA. La conversión
 * de unidades es una homotecia (factor constante), y todas las fórmulas de este
 * tema son homogéneas de grado 1, de modo que sustituir en la unidad de
 * pantalla da exactamente el mismo resultado que en MPa.
 * ========================================================================== */
(function (ML) {
  'use strict';

  var f = ML.format;
  var DEG = 180 / Math.PI;

  // --- primitivas de marcado -------------------------------------------------
  function frac(num, den) {
    return '<span class="frac"><span class="frac-num">' + num + '</span><span class="frac-den">' + den + '</span></span>';
  }
  function sqrt(body) {
    return '<span class="sqrt"><span class="sqrt-sign">√</span><span class="sqrt-body">' + body + '</span></span>';
  }
  function sup(b) { return '<sup>' + b + '</sup>'; }
  function v(name) { return '<i class="sym">' + name + '</i>'; }
  function n(x) { return '<b class="vnum">' + x + '</b>'; }
  function val(x) { return n(f.stressDisplay(x)); }
  function u() { return '<span class="eq-unit">[' + f.unit + ']</span>'; }

  /** Una ecuación con nombre, forma simbólica, sustitución numérica y resultado. */
  function eqRow(name, symbolic, numeric, result) {
    return '<div class="eq-row">'
         + '<span class="eq-name">' + name + '</span>'
         + '<span class="eq-body">'
         +   '<span class="eq-sym">' + symbolic + '</span>'
         +   (numeric ? '<span class="eq-eq">=</span><span class="eq-num">' + numeric + '</span>' : '')
         +   (result ? '<span class="eq-eq">=</span><span class="eq-res">' + result + '</span>' : '')
         + '</span></div>';
  }

  // --- bloque simbólico -------------------------------------------------------
  function symbolicBlock() {
    var s = '';
    s += '<div class="eq-block">';
    s += eqRow('Centro', v('σ') + '<sub>avg</sub> = ' + frac(v('σ') + v('x') + ' + ' + v('σ') + v('y'), '2'));
    s += eqRow('Radio', 'R = ' + sqrt(frac('(' + v('σ') + v('x') + ' − ' + v('σ') + v('y') + ')', '2')
             + '<sup>2</sup> + ' + v('τ') + '<sub>xy</sub><sup>2</sup>'));
    s += eqRow('Transformación',
          v('σ') + '<sub>θ</sub> = ' + v('σ') + '<sub>avg</sub> + ' + frac(v('σ') + '<sub>x</sub> − ' + v('σ') + '<sub>y</sub>', '2')
          + '·cos 2' + v('θ') + ' + ' + v('τ') + '<sub>xy</sub>·sen 2' + v('θ'));
    s += eqRow('',
          v('τ') + '<sub>θ</sub> = −' + frac(v('σ') + '<sub>x</sub> − ' + v('σ') + '<sub>y</sub>', '2')
          + '·sen 2' + v('θ') + ' + ' + v('τ') + '<sub>xy</sub>·cos 2' + v('θ'));
    s += eqRow('Principales',
          v('σ') + '<sub>1</sub> = ' + v('σ') + '<sub>avg</sub> + R ,&nbsp;&nbsp; '
          + v('σ') + '<sub>2</sub> = ' + v('σ') + '<sub>avg</sub> − R ,&nbsp;&nbsp; '
          + v('τ') + '<sub>max</sub> = R');
    s += eqRow('Orientación', 'tan 2' + v('θ') + '<sub>p</sub> = ' + frac('2' + v('τ') + '<sub>xy</sub>', v('σ') + v('x') + ' − ' + v('σ') + v('y')));
    s += eqRow('Relación angular', v('θ') + '<sub>Mohr</sub> = 2' + v('θ') + '<sub>físico</sub>');
    s += '</div>';
    return s;
  }

  // --- transformación con sustitución ----------------------------------------
  function transformBlock(st, thetaDeg) {
    var c = ML.mohr.circle(st), tr = ML.tf.transform(st, thetaDeg / DEG);
    var sx = f.stressDisplay(st.xx), sy = f.stressDisplay(st.yy), tx = f.stressDisplay(st.xy);
    var avg = f.stressDisplay(c.avg), half = f.stressDisplay(Math.abs(0.5 * (st.xx - st.yy)));
    var two = f.decimal(2 * thetaDeg, 2);
    var sgn = (0.5 * (st.xx - st.yy)) < 0 ? '−' : '';
    var out = '<div class="eq-block">';
    out += eqRow(v('σ') + '<sub>θ</sub>',
        v('σ') + '<sub>avg</sub> + ' + frac(v('σ') + v('x') + ' − ' + v('σ') + v('y'), '2') + '·cos 2' + v('θ') + ' + ' + v('τ') + '<sub>xy</sub>·sen 2' + v('θ'),
        avg + ' + ' + half + '·cos(' + two + '°) + ' + tx + '·sen(' + two + '°)',
        val(tr.sigma) + ' ' + u());
    out += eqRow(v('τ') + '<sub>θ</sub>',
        '−' + frac(v('σ') + v('x') + ' − ' + v('σ') + v('y'), '2') + '·sen 2' + v('θ') + ' + ' + v('τ') + '<sub>xy</sub>·cos 2' + v('θ'),
        sgn + half + '·sen(' + two + '°) + ' + tx + '·cos(' + two + '°)',
        val(tr.tau) + ' ' + u());
    out += eqRow('Cara perpendicular 2',
        v('σ') + '<sub>θ+90°</sub> = ' + v('σ') + v('x') + ' + ' + v('σ') + v('y') + ' − ' + v('σ') + '<sub>θ</sub> ,&nbsp;&nbsp; '
        + v('τ') + '<sub>θ+90°</sub> = −' + v('τ') + '<sub>θ</sub>',
        sx + ' + ' + sy + ' − ' + f.stressDisplay(tr.sigma) + ' ,&nbsp; −' + f.stressDisplay(tr.tau),
        val(tr.sigmaM) + ' ,&nbsp; ' + val(tr.tauM) + ' ' + u());
    out += '</div>';
    return out;
  }

  // --- círculo con sustitución ------------------------------------------------
  function circleBlock(st) {
    var c = ML.mohr.circle(st);
    var half = f.stressDisplay(Math.abs(0.5 * (st.xx - st.yy))), tx = f.stressDisplay(st.xy);
    var out = '<div class="eq-block">';
    out += eqRow('Centro', v('σ') + '<sub>avg</sub> = ' + frac(v('σ') + v('x') + ' + ' + v('σ') + v('y'), '2'),
        frac(f.stressDisplay(st.xx) + ' + ' + f.stressDisplay(st.yy), '2'), val(c.avg) + ' ' + u());
    out += eqRow('Radio', 'R = ' + sqrt('(' + half + ')' + '<sup>2</sup> + ' + tx + '<sup>2</sup>'),
        sqrt('(' + half + ')' + '<sup>2</sup> + ' + tx + '<sup>2</sup>'),
        val(c.R) + ' ' + u());
    out += eqRow('Comprobación', v('σ') + '<sub>1</sub> + ' + v('σ') + '<sub>2</sub> = ' + v('σ') + v('x') + ' + ' + v('σ') + v('y'),
        f.stressDisplay(c.s1) + ' + ' + f.stressDisplay(c.s2),
        f.stressDisplay(c.s1 + c.s2) + ' = ' + f.stressDisplay(st.xx + st.yy) + ' ' + u());
    out += eqRow('Comprobación', v('σ') + '<sub>1</sub>' + v('σ') + '<sub>2</sub> = ' + v('σ') + v('x') + v('σ') + v('y') + ' − ' + v('τ') + '<sub>xy</sub><sup>2</sup>',
        f.stressDisplay(c.s1 * c.s2),
        f.stressDisplay(st.xx * st.yy - st.xy * st.xy) + ' ' + u());
    out += '</div>';
    return out;
  }

  // --- principales con sustitución -------------------------------------------
  function principalBlock(st) {
    var c = ML.mohr.circle(st), pa = ML.tf.principalAngle(st);
    var out = '<div class="eq-block">';
    out += eqRow(v('σ') + '<sub>1</sub>,&nbsp;' + v('σ') + '<sub>2</sub>',
        v('σ') + '<sub>avg</sub> ± R',
        f.stressDisplay(c.avg) + ' ± ' + f.stressDisplay(c.R),
        val(c.s1) + ' ,&nbsp; ' + val(c.s2) + ' ' + u());
    out += eqRow(v('τ') + '<sub>max</sub>', 'R = ' + frac(v('σ') + '<sub>1</sub> − ' + v('σ') + '<sub>2</sub>', '2'),
        frac(f.stressDisplay(c.s1) + ' − ' + f.stressDisplay(c.s2), '2'), val(c.tauMax) + ' ' + u());
    if (!pa.hydro) {
      out += eqRow(v('θ') + '<sub>p</sub>', '½·atan2(' + v('τ') + '<sub>xy</sub> , ' + frac(v('σ') + v('x') + ' − ' + v('σ') + v('y'), '2') + ')',
          '½·atan2(' + f.stressDisplay(st.xy) + ' , ' + f.stressDisplay(0.5 * (st.xx - st.yy)) + ')',
          f.angle(pa.thetaPdeg, 2));
      out += eqRow(v('θ') + '<sub>s</sub>', v('θ') + '<sub>p</sub> + 45°',
          f.angle(pa.thetaPdeg, 2) + ' + 45°', f.angle(pa.thetaSdeg, 2));
    }
    out += '</div>';
    return out;
  }

  // --- matrices ---------------------------------------------------------------
  function matrix(rows, cls) {
    var s = '<span class="mat ' + (cls || '') + '">';
    rows.forEach(function (r) {
      s += '<span class="mat-row">';
      r.forEach(function (cell, i) {
        s += '<span class="mat-cell' + (i === r.length - 1 ? ' mat-last' : '') + '">' + cell + '</span>';
      });
      s += '</span>';
    });
    return s + '</span>';
  }

  function tensorBlock(st) {
    var sigmaM = matrix([
      [val(st.xx), val(st.xy)],
      [val(st.xy), val(st.yy)]
    ], 'mat-sigma');
    return '<div class="eq-block eq-block-mat">'
      + eqRow('Tensor de esfuerzos  <b>' + v('σ') + '</b>', '', '',
          sigmaM + ' ' + u())
      + eqRow('Tensado', 'definido por sus tres componentes independientes', '',
          '<span class="eq-res">simétrico: σ<sub>yx</sub> = σ<sub>xy</sub> = ' + val(st.xy) + ' ' + u() + '</span>')
      + '</div>';
  }

  function rotationBlock(thetaDeg) {
    var th = thetaDeg / DEG, c = Math.cos(th), s = Math.sin(th);
    var Q = matrix([
      [f.decimal(c, 4), f.decimal(s, 4)],
      [f.signed(-s, 4), f.decimal(c, 4)]
    ], 'mat-q');
    return '<div class="eq-block eq-block-mat">'
      + eqRow('Matriz de rotación', '<b>Q</b>(θ) =', '', Q)
      + eqRow('Relación tensorial', '<b>' + v('σ') + '′</b> = <b>Q</b>&nbsp;<b>' + v('σ') + '</b>&nbsp;<b>Q</b><sup>T</sup>', '',
          '<span class="eq-res">define las componentes σ<sub>11</sub>=σθ, σ<sub>22</sub>=σ(θ+90°), σ<sub>12</sub>=τθ</span>')
      + '</div>';
  }

  function sigmaPrimeBlock(st, thetaDeg) {
    var r = ML.tf.rotateTensor(st, thetaDeg / DEG);
    return '<div class="eq-block eq-block-mat">'
      + eqRow('<b>' + v('σ') + '′</b> = <b>Q</b><b>' + v('σ') + '</b><b>Q</b><sup>T</sup>', '',
        '',
        matrix([
          [val(r.xx), val(r.xy)],
          [val(r.xy), val(r.yy)]
        ], 'mat-sigma') + ' ' + u())
      + '</div>';
  }

  ML.equations = {
    frac: frac, sqrt: sqrt, sup: sup, v: v, n: n, val: val, u: u,
    eqRow: eqRow, matrix: matrix,
    symbolicBlock: symbolicBlock,
    transformBlock: transformBlock,
    circleBlock: circleBlock,
    principalBlock: principalBlock,
    tensorBlock: tensorBlock,
    rotationBlock: rotationBlock,
    sigmaPrimeBlock: sigmaPrimeBlock
  };

})(typeof window !== 'undefined'
  ? (window.MohrLab = window.MohrLab || {})
  : (global.MohrLab = global.MohrLab || {}));
