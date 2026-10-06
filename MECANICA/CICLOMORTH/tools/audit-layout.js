/* Auditoría de disposición de los TRES visores: verifica que ningún nodo
 * (incluidas las etiquetas) queda fuera de su lienzo.
 *   node tools/serve.js  →  abrir index.html  →  ejecutar en la consola
 * Devuelve un informe de texto con el número de desbordes por visor. */
window.__auditLayout = function () {
  var A = window.MohrLab.app;
  var CHARW = 5.45, CHARH = 12;

  function textBox(t, W, H) {
    var x = +t.getAttribute('x'), y = +t.getAttribute('y');
    if (!isFinite(x) || !isFinite(y)) return null;
    var anc = t.getAttribute('text-anchor');
    var w = t.textContent.length * CHARW;
    var left = (anc === 'end') ? x - w : (anc === 'middle' ? x - w / 2 : x);
    return { x: left, y: y - CHARH * 0.78, w: w, h: CHARH,
             cls: t.getAttribute('class') || 'text', txt: t.textContent };
  }

  function shapeBox(n) {
    var xs = [], ys = [];
    [['x1', 'y1'], ['x2', 'y2'], ['cx', 'cy'], ['x', 'y']].forEach(function (p) {
      var vx = n.getAttribute(p[0]), vy = n.getAttribute(p[1]);
      if (vx !== null && isFinite(+vx)) xs.push(+vx);
      if (vy !== null && isFinite(+vy)) ys.push(+vy);
    });
    var tx = 0, ty = 0, tr = n.getAttribute('transform');
    if (tr) {
      var t2 = /translate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/.exec(tr);
      if (t2) { tx = +t2[1]; ty = +t2[2]; }
    }
    var d = n.getAttribute('d');
    if (d) {
      var re = /(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/g, m;
      while ((m = re.exec(d)) !== null) { xs.push(+m[1] + tx); ys.push(+m[2] + ty); }
    }
    if (tx || ty) { xs.push(tx); ys.push(ty); }
    if (!xs.length) return null;
    if (n.tagName === 'circle') {
      var rr = +n.getAttribute('r') || 0;
      xs.push(xs[0] + rr, xs[0] - rr); ys.push(ys[0] + rr, ys[0] - rr);
    }
    if (n.tagName === 'rect') {
      var w2 = +n.getAttribute('width') || 0, h2 = +n.getAttribute('height') || 0;
      var x0 = +n.getAttribute('x') || 0, y0 = +n.getAttribute('y') || 0;
      xs.push(x0, x0 + w2); ys.push(y0, y0 + h2);
    }
    return { x: Math.min.apply(null, xs), y: Math.min.apply(null, ys),
             w: Math.max.apply(null, xs) - Math.min.apply(null, xs),
             h: Math.max.apply(null, ys) - Math.min.apply(null, ys),
             cls: n.getAttribute('class') || n.tagName, txt: '' };
  }

  function audit(id) {
    var svg = document.getElementById(id);
    var VB = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    var W = VB[2], H = VB[3], bad = [], i, b;
    var texts = svg.querySelectorAll('text');
    for (i = 0; i < texts.length; i++) {
      b = textBox(texts[i]);
      if (!b) continue;
      if (b.x < -0.5 || b.y < -0.5 || b.x + b.w > W + 0.5 || b.y + b.h > H + 0.5) {
        bad.push(b.cls + ' "' + b.txt.substring(0, 24) + '" x[' + b.x.toFixed(0) + '..'
               + (b.x + b.w).toFixed(0) + '] y[' + b.y.toFixed(0) + '..' + (b.y + b.h).toFixed(0) + ']');
      }
    }
    var shapes = svg.querySelectorAll('circle, path, line, rect, polygon');
    for (i = 0; i < shapes.length; i++) {
      var pts = shapes[i].getAttribute('points');
      var use = shapes[i];
      if (pts) { use = document.createElementNS('http://www.w3.org/2000/svg', 'path'); use.setAttribute('d', ''); }
      b = pts ? (function () {
        var xs = [], ys = [], pr = pts.trim().split(/\s+/);
        for (var j = 0; j < pr.length; j++) {
          var q = pr[j].split(',');
          if (q.length === 2 && isFinite(+q[0])) { xs.push(+q[0]); ys.push(+q[1]); }
        }
        return xs.length ? { x: Math.min.apply(null, xs), y: Math.min.apply(null, ys),
                             w: Math.max.apply(null, xs) - Math.min.apply(null, xs),
                             h: Math.max.apply(null, ys) - Math.min.apply(null, ys),
                             cls: shapes[i].getAttribute('class') || 'polygon', txt: '' } : null;
      })() : shapeBox(shapes[i]);
      if (!b) continue;
      if (b.x < -0.5 || b.y < -0.5 || b.x + b.w > W + 0.5 || b.y + b.h > H + 0.5) {
        bad.push(b.cls + ' x[' + b.x.toFixed(0) + '..' + (b.x + b.w).toFixed(0) + '] y['
               + b.y.toFixed(0) + '..' + (b.y + b.h).toFixed(0) + ']');
      }
    }
    return bad;
  }

  var states = [
    ['combinado', 80, -30, 40, 35], ['traccion uni', 120, 0, 0, 0],
    ['compresion uni', 0, -90, 0, 0], ['cortante puro', 0, 0, 60, 45],
    ['hidrostatico', 75, 75, 0, 0], ['nulo', 0, 0, 0, 90],
    ['todo negativo', -80, -40, -55, 120], ['lejano del origen', 1000, 990, 0, 10],
    ['muy lejano', 5000, 10, 0, 0], ['R enorme', 0, 0, 20000, 33],
    ['R minuscule', 3, 3.0001, 0, 0], ['sigma2 muy neg', -5, -400, 12, 160],
    ['theta 0', 80, -30, 40, 0], ['theta 179', 80, -30, 40, 179]
  ];
  var views = ['v-element', 'v-circle', 'v-chart'];
  var lines = [], totals = {};
  views.forEach(function (v) { totals[v] = 0; lines.push('── ' + v); });

  states.forEach(function (s) {
    A.state.st = MohrLab.stress.plane(s[1], s[2], s[3]);
    A.state.thetaDeg = s[4];
    A.selectTab('tresD'); A.render();                 // fuerza el render del visor 3D
    var per = [];
    [-1, 0, 3, 7].forEach(function (b) {
      A.state.build = b; A.render();
      views.forEach(function (v) {
        var bad = audit(v);
        if (bad.length) per.push(v + '→' + bad.length + ' :: ' + bad.slice(0, 2).join(' ; '));
        totals[v] += bad.length;
      });
    });
    A.state.build = -1; A.render();
    lines.push('  ' + s[0] + ' -> ' + (per.length ? per.join('  |  ') : 'los tres visores dentro'));
  });
  A.selectTab('principales');

  lines.push('');
  lines.push('TOTAL ' + views.map(function (v) { return v + '=' + totals[v]; }).join('  '));

  /* --- SANIDAD DE LA ESCALA DEL CÍRCULO -----------------------------------
     Dos regresiones que la auditoría debe cazar:
       a) una segunda corrección de escala calculaba mal el espacio disponible
          (88 px en lugar de 250), encogía el círculo y hacía que la escala
          partiese de 0,5 a 8,0 al mover un deslizador;
       b) la proyección del eje σ era cx + σ·k en vez de cx + (σ−σavg)·k, con lo
          que σ1, σ2 y los radios salían del lienzo en cuanto σavg ≠ 0.
     Se mide lo que el usuario percibe: el RADIO dibujado, en píxeles. */
  lines.push('');
  lines.push('── sanity de escala del círculo (recorrido de deslizadores)');
  var FRAME_H = 486, MIN_R = 60;          // 60 px ≈ 12% de la altura del marco
  var worstR = 1e9, worstAt = '', nBad = 0, nOff = 0, maxRadiusJump = 0, jumpAt = '';
  var prevR = 0, prevOff = false;
  ['rg-sx', 'rg-sy', 'rg-txy'].forEach(function (id) {
    var rg = document.getElementById(id);
    var lo = +rg.min, hi = +rg.max, n = 25;
    for (var i = 0; i <= n; i++) {
      var v = lo + (hi - lo) * i / n;
      rg.value = String(v);
      rg.dispatchEvent(new Event('input', { bubbles: true }));
      A.render();
      var m = A.derive();
      var c = document.querySelector('#v-circle .v-circle');
      if (m.c.R < 1e-9 || !c) { prevR = 0; continue; }
      var rp = +c.getAttribute('r');
      var off = !!document.querySelector('#v-circle .v-offscale');
      if (off) { nOff++; }
      else if (rp < worstR) { worstR = rp; worstAt = id + '=' + v.toFixed(0) + ' (R=' + m.c.R.toFixed(1) + ')'; }
      if (!off && rp < MIN_R) nBad++;
      // Continuidad del radio: sólo se mide si no cambia el modo de escala
      if (prevR && prevOff === off && Math.abs(rp - prevR) > maxRadiusJump) {
        maxRadiusJump = Math.abs(rp - prevR); jumpAt = id + '=' + v.toFixed(0);
      }
      prevR = rp; prevOff = off;
    }
  });
  lines.push('  radio minimo con el origen visible : ' + worstR.toFixed(1) + ' px  en ' + worstAt);
  lines.push('  estados con origen fuera de escala: ' + nOff);
  lines.push('  radios por debajo de ' + MIN_R + ' px         : ' + nBad);
  lines.push('  mayor salto del radio             : ' + maxRadiusJump.toFixed(1) + ' px  en ' + jumpAt);
  lines.push('  veredicto: ' + (nBad === 0 && maxRadiusJump < 40
    ? 'escala estable y círculo siempre legible'
    : 'REVISAR: hay radios ilegibles o saltos en la escala'));
  lines.push('  criterio: radio ≥ ' + MIN_R + ' px con el origen visible y saltos < 40 px');
  lines.push('  (cambiar a la escala del círculo es un salto permitido y esperado:');
  lines.push('   ocurre sólo en estados casi hidrostáticos muy alejados del origen)');

  // El visor 3D se comprueba aparte: vive dentro de una pestaña que se reconstruye
  A.selectTab('tresD'); A.render();
  var b3 = audit('v-circle3d');
  lines.push('visor 3D (una vez): ' + (b3.length ? b3.length + ' :: ' + b3.slice(0, 3).join(' ; ') : 'dentro'));
  A.selectTab('principales');
  return lines.join('\n');
};
'listo';
