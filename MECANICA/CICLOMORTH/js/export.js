/* =============================================================================
 * MOHR LAB — export.js
 * Informe de resultados, procedimiento docente, captura SVG/PNG e impresión.
 *
 * La exportación reutiliza el MODELO ya calculado: nunca vuelve a resolver el
 * problema por otra vía, de modo que el informe y la pantalla son idénticos.
 * ========================================================================== */
(function (ML) {
  'use strict';

  var f = ML.format;
  var DEG = 180 / Math.PI;

  // ---------------------------------------------------------------------------
  // Procedimiento docente (§17) — ocho pasos con sustitución numérica
  // ---------------------------------------------------------------------------
  function procedure(m) {
    var st = m.st, c = m.c, tr = m.tr, pa = m.pa;
    var steps = [];

    steps.push({ n: 1, t: 'Estado inicial',
      body: 'Se parte del estado plano ' + u() + ': σx = ' + s(st.xx) + ', σy = ' + s(st.yy) + ', τxy = ' + s(st.xy) + '. '
          + 'El tensor es simétrico, de modo que sólo hay tres componentes independientes.',
      note: m.cls.label + '. ' + m.cls.note });

    steps.push({ n: 2, t: 'Centro de la circunferencia',
      body: 'σavg = (σx + σy)/2 = (' + s(st.xx) + ' + ' + s(st.yy) + ')/2 = ' + s(c.avg) + '. '
          + 'Es la proyección del centro sobre el eje σ, y coincide con el invariante I1 = σx + σy = ' + s(st.xx + st.yy) + '.',
      note: 'El cortante no interviene: el centro sólo depende de las normales.' });

    steps.push({ n: 3, t: 'Radio de la circunferencia',
      body: 'El Triedro de Gauss tiene catetos ((σx − σy)/2) = ' + s(0.5 * (st.xx - st.yy)) + ' y τxy = ' + s(st.xy) + '. '
          + 'R = √(' + s(0.5 * (st.xx - st.yy)) + '² + ' + s(st.xy) + '²) = ' + s(c.R) + '.',
      note: 'Si R = 0 el estado es hidrostático y no hay direcciones principales únicas.' });

    steps.push({ n: 4, t: 'Circunferencia de Mohr',
      body: 'La circunferencia de centro C = (' + s(c.avg) + ', 0) y radio ' + s(c.R) + ' contiene los puntos '
          + 'A = (σx, τxy) = (' + s(st.xx) + ', ' + s(st.xy) + '), '
          + 'B = (σy, −τxy) = (' + s(st.yy) + ', ' + f.signed(-st.xy) + '), que son diametralmente opuestos.',
      note: 'A y B son las caras +x y +y del elemento original; el segmento AB es un diámetro.' });

    steps.push({ n: 5, t: 'Esfuerzos principales',
      body: 'σ1 = σavg + R = ' + s(c.avg) + ' + ' + s(c.R) + ' = ' + s(c.s1) + '. '
          + 'σ2 = σavg − R = ' + s(c.avg) + ' − ' + s(c.R) + ' = ' + s(c.s2) + '.',
      note: 'Comprobación: σ1 + σ2 = ' + s(c.s1 + c.s2) + ' = σx + σy = ' + s(st.xx + st.yy)
          + ', y σ1·σ2 = ' + s(c.s1 * c.s2) + ' = σx·σy − τxy² = ' + s(st.xx * st.yy - st.xy * st.xy) + '.' });

    steps.push({ n: 6, t: 'Esfuerzo cortante máximo',
      body: 'τmax = R = ' + s(c.R) + ', y se alcanza con σ = σavg = ' + s(c.avg) + ', '
          + 'es decir en el centro de la circunferencia. '
          + 'De hecho (σ1 − σ2)/2 = (' + s(c.s1) + ' − ' + s(c.s2) + ')/2 = ' + s(c.tauMax) + '.',
      note: 'El cortante máximo es siempre la mitad de la diferencia de los esfuerzos principales.' });

    if (pa.hydro) {
      steps.push({ n: 7, t: 'Orientación',
        body: 'El estado es hidrostático plano (σx = σy, τxy = 0): R = 0, el círculo se reduce a un punto '
            + 'y no existen direcciones principales ni de máximo cortante distinguibles.',
        note: 'Todas las direcciones son equivalentes.' });
    } else {
      steps.push({ n: 7, t: 'Orientación principal y de máximo cortante',
        body: 'tan(2θp) = 2τxy/(σx − σy) = ' + f.signed(2 * st.xy) + '/' + f.signed(st.xx - st.yy)
            + ' = ' + (pa.tan2 === Infinity ? '∞' : (pa.tan2 === -Infinity ? '−∞' : f.decimal(pa.tan2, 4)))
            + '. Con 2θp = ' + f.angle(pa.twoPdeg, 3) + ' (cuadrante ' + pa.quadrant + ') resulta '
            + 'θp = ' + f.angle(pa.thetaPdeg, 3) + '. El plano de máximo cortante está a 45°: '
            + 'θs = θp + 45° = ' + f.angle(pa.thetaSdeg, 3) + '.',
        note: 'Es fundamental usar atan2 en lugar de arctan: 2τxy y (σx − σy) pueden ser negativos a la vez '
            + 'y el cuadrante determina cuál de los dos ejes es σ1.' });
    }

    steps.push({ n: 8, t: 'Transformación en el plano θ = ' + f.angle(m.thetaDeg, 2),
      body: 'Con 2θ = ' + f.angle(2 * m.thetaDeg, 2) + ': σθ = ' + f.stressDisplay(c.avg) + ' + '
          + f.stressDisplay(0.5 * (st.xx - st.yy)) + '·cos(' + f.angle(2 * m.thetaDeg, 2) + ') + '
          + f.stressDisplay(st.xy) + '·sen(' + f.angle(2 * m.thetaDeg, 2) + ') = ' + s(tr.sigma) + '; '
          + 'τθ = −' + f.stressDisplay(0.5 * (st.xx - st.yy)) + '·sen(' + f.angle(2 * m.thetaDeg, 2) + ') + '
          + f.stressDisplay(st.xy) + '·cos(' + f.angle(2 * m.thetaDeg, 2) + ') = ' + s(tr.tau) + '. '
          + 'El punto P = (' + s(tr.sigma) + ', ' + s(tr.tau) + ') está sobre la circunferencia, a un ángulo 2θ = '
          + f.angle(2 * m.thetaDeg, 2) + ' de A en sentido horario.',
      note: 'La cara perpendicular vale σ(θ+90°) = σx + σy − σθ = ' + s(tr.sigmaM)
          + ' y τ(θ+90°) = −τθ = ' + s(tr.tauM) + '.' });

    return steps;
  }

  function s(x) { return f.stress(x); }
  function u() { return '[' + f.unit + ']'; }

  // ---------------------------------------------------------------------------
  // Informe de resultados (§26)
  // ---------------------------------------------------------------------------
  function report(m, extra) {
    var st = m.st, c = m.c, tr = m.tr, pa = m.pa;
    var L = [];
    L.push('MOHR LAB — Informe de estado de esfuerzos y círculo de Mohr');
    L.push('='.repeat(72));
    L.push('Generado: ' + new Date().toLocaleString('es-ES'));
    L.push('');
    L.push('1. ESTADO INICIAL');
    L.push('   σx    = ' + s(st.xx));
    L.push('   σy    = ' + s(st.yy));
    L.push('   τxy   = ' + s(st.xy));
    L.push('   θ     = ' + f.angle(m.thetaDeg, 3) + '   (en el círculo: 2θ = ' + f.angle(2 * m.thetaDeg, 3) + ')');
    L.push('   Clasificación: ' + m.cls.label);
    L.push('   ' + m.cls.note);
    L.push('');
    L.push('2. CÍRCULO DE MOHR');
    L.push('   σavg  = ' + s(c.avg));
    L.push('   R     = ' + s(c.R));
    L.push('   A     = (' + s(st.xx) + ', ' + s(st.xy) + ')');
    L.push('   B     = (' + s(st.yy) + ', ' + s(-st.xy) + ')');
    L.push('   P     = (' + s(tr.sigma) + ', ' + s(tr.tau) + ')');
    L.push('');
    L.push('3. ESFUERZOS PRINCIPALES');
    L.push('   σ1    = ' + s(c.s1));
    L.push('   σ2    = ' + s(c.s2));
    L.push('   τmax  = ' + s(c.tauMax) + '   (a σ = σavg = ' + s(c.avg) + ')');
    L.push('   σavg  = (σ1+σ2)/2 = ' + s(c.avg));
    if (!pa.hydro) {
      L.push('   θp    = ' + f.angle(pa.thetaPdeg, 3) + '   [normal del plano de σ1, en [0°,180°))');
      L.push('   θs    = ' + f.angle(pa.thetaSdeg, 3) + '   [plano de máximo cortante = θp + 45°]');
      L.push('   Separación angular entre planos principales y de máximo cortante: 45°');
    } else {
      L.push('   Estado hidrostático: no hay orientación principal definida (R = 0).');
    }
    L.push('   Naturaleza: ' + principalNature(c));
    L.push('');
    L.push('4. TRANSFORMACIÓN EN EL PLANO θ');
    L.push('   σθ    = ' + s(tr.sigma));
    L.push('   τθ    = ' + s(tr.tau));
    L.push('   σ(θ+90°) = ' + s(tr.sigmaM));
    L.push('   τ(θ+90°) = ' + s(tr.tauM));
    L.push('');
    L.push('5. INVARIANTES Y COMPROBACIONES');
    L.push('   I1 = σx + σy                = ' + s(st.xx + st.yy));
    L.push('   I2 = σx·σy − τxy²           = ' + s(st.xx * st.yy - st.xy * st.xy));
    L.push('   J2 = ((σx−σy)/2)² + τxy²    = ' + s(c.R * c.R) + '   (= R²)');
    L.push('   σ1 + σ2 = ' + s(c.s1 + c.s2) + ' = σx + σy = ' + s(st.xx + st.yy));
    L.push('   σ1·σ2   = ' + s(c.s1 * c.s2) + ' = σx·σy − τxy² = ' + s(st.xx * st.yy - st.xy * st.xy));
    L.push('');
    L.push('   Estado: ' + (m.checks.every(function (k) { return k.ok; }) ? 'TODAS LAS COMPROBACIONES SATISFECHAS' : 'HAY DISCREPANCIAS'));
    m.checks.forEach(function (k) {
      L.push('     [' + (k.ok ? 'OK  ' : 'FALLA') + '] ' + k.label);
    });
    L.push('');
    if (m.t3) {
      L.push('6. EXTENSIÓN TRIDIMENSIONAL (σz = ' + s(m.sz) + ')');
      L.push('   σ1,σ2,σ3 = ' + s(m.t3.s1) + ' , ' + s(m.t3.s2) + ' , ' + s(m.t3.s3));
      L.push('   Tresca (σ1−σ3)      = ' + s(m.t3.tresca));
      L.push('   von Mises            = ' + s(m.t3.vonMises));
      L.push('   τ octaédrico         = ' + s(m.t3.octaShear));
      L.push('');
    }
    if (extra) { L.push(extra); L.push(''); }
    L.push('CONVENCIÓN DE SIGNOS');
    L.push('   σ > 0 tracción · σ < 0 compresión');
    L.push('   τxy > 0 : en la cara +x el cortante actúa hacia +y; en la cara +y, hacia +x');
    L.push('   θ se mide en sentido antihorario desde +x hasta la normal exterior de la cara θ');
    L.push('   En el círculo τ se representa hacia arriba y el ángulo 2θ avanza en sentido horario');
    L.push('');
    L.push('='.repeat(72));
    L.push('MOHR LAB · Interactive Stress Transformation & Mohr Circle');
    return L.join('\n');
  }

  function principalNature(c) {
    if (c.hydro) return 'hidrostático plano (todos los planos equivalentes)';
    if (c.s1 > 0 && c.s2 > 0) return 'bilateral en tracción';
    if (c.s1 > 0 && c.s2 === 0) return 'uniaxial en tracción';
    if (c.s1 > 0 && c.s2 < 0) return 'biaxial de signo mixto (tracción y compresión)';
    if (c.s1 === 0 && c.s2 < 0) return 'uniaxial en compresión';
    return 'uniaxial en compresión (todos los planos comprimidos)';
  }

  // ---------------------------------------------------------------------------
  // Captura de los visores
  // ---------------------------------------------------------------------------

  /**
   * Compone un único SVG con los visores indicados, listo para descargar.
   * @param {string[]} ids identificadores de los <svg> a capturar
   * @param {Array<{label,id}>} captions
   */
  function snapshot(ids, captions, meta) {
    var W = 1180, pad = 18, capH = 26;
    var items = [], y = pad, totalW = 0;
    ids.forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;
      var vb = node.getAttribute('viewBox').split(/\s+/).map(Number);
      items.push({ node: node, vb: vb, w: vb[2], h: vb[3], y: y });
      y += vb[3] + capH + pad;
      totalW = Math.max(totalW, vb[2]);
    });
    var H = y + pad;
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">'];
    out.push('<rect width="' + W + '" height="' + H + '" fill="#0f151c"/>');
    out.push('<g fill="#dbe4ee" font-family="Bahnschrift, \'Segoe UI\', sans-serif">');
    out.push('<text x="' + pad + '" y="' + (pad + 12) + '" font-size="15" font-weight="600" letter-spacing="1.6">MOHR LAB</text>');
    out.push('<text x="' + (pad + 96) + '" y="' + (pad + 12) + '" font-size="11" fill="#7d8fa3">Interactive Stress Transformation &amp; Mohr Circle</text>');
    out.push('<text x="' + (W - pad) + '" y="' + (pad + 12) + '" font-size="11" fill="#7d8fa3" text-anchor="end">' + esc(meta) + '</text>');
    out.push('</g>');
    out.push('<line x1="' + pad + '" y1="' + (pad + 20) + '" x2="' + (W - pad) + '" y2="' + (pad + 20) + '" stroke="#1e2833"/>');

    items.forEach(function (it, i) {
      var scale = (W - pad * 2) / it.w;
      var x = pad, yy = it.y + capH;
      var raw = (captions && captions[i]) || '';
      var cap = (typeof raw === 'object') ? (raw.label || '') : String(raw);
      out.push('<text x="' + pad + '" y="' + (it.y + 12) + '" fill="#7d8fa3" font-size="10.5" letter-spacing="1.2" '
             + 'font-family="Bahnschrift, \'Segoe UI\', sans-serif">' + esc(cap.toUpperCase()) + '</text>');
      out.push('<g transform="translate(' + x + ',' + yy + ') scale(' + scale + ')">');
      out.push(new XMLSerializer().serializeToString(it.node));
      out.push('</g>');
    });
    out.push('</svg>');
    return out.join('');
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function download(filename, content, mime) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
  }

  /** Convierte un texto SVG en PNG mediante un <canvas> y lo descarga. */
  function svgToPng(svgText, filename, scale) {
    scale = scale || 2;
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var m = svgText.match(/width="(\d+)"\s+height="(\d+)"/);
      var w = m ? Number(m[1]) : 1180, h = m ? Number(m[2]) : 800;
      var blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      img.onload = function () {
        var cv = document.createElement('canvas');
        cv.width = w * scale; cv.height = h * scale;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#0f151c';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) {
          if (!b) { reject(new Error('No se pudo generar el PNG')); return; }
          download(filename, b);
          resolve();
        }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('No se pudo rasterizar el SVG')); };
      img.src = url;
    });
  }

  // ---------------------------------------------------------------------------
  // Impresión / PDF
  // ---------------------------------------------------------------------------
  function printSheet(m) {
    var host = document.getElementById('print-sheet');
    if (!host) return;
    var st = m.st, c = m.c, tr = m.tr, pa = m.pa;
    var rows = [
      ['σx', s(st.xx)], ['σy', s(st.yy)], ['τxy', s(st.xy)], ['θ', f.angle(m.thetaDeg, 3)],
      ['σavg', s(c.avg)], ['R', s(c.R)], ['σ1', s(c.s1)], ['σ2', s(c.s2)],
      ['τmax', s(c.tauMax)], ['σθ', s(tr.sigma)], ['τθ', s(tr.tau)]
    ];
    if (!pa.hydro) { rows.push(['θp', f.angle(pa.thetaPdeg, 3)]); rows.push(['θs', f.angle(pa.thetaSdeg, 3)]); }

    var html = '<div class="ps-head">'
      + '<div class="ps-title">MOHR LAB — Informe de estado de esfuerzos</div>'
      + '<div class="ps-sub">' + new Date().toLocaleString('es-ES') + ' · ' + principalNature(c) + '</div>'
      + '</div>';
    html += '<div class="ps-grid">';
    rows.forEach(function (r) {
      html += '<div class="ps-cell"><span class="ps-k">' + r[0] + '</span><span class="ps-v">' + r[1] + '</span></div>';
    });
    html += '</div>';
    html += '<div class="ps-figs">';
    ['v-element', 'v-circle', 'v-chart'].forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;
      var clone = node.cloneNode(true);
      clone.removeAttribute('tabindex');
      clone.setAttribute('class', (node.getAttribute('class') || '') + ' ps-fig');
      html += '<div class="ps-figwrap">' + new XMLSerializer().serializeToString(clone) + '</div>';
    });
    html += '</div>';
    html += '<div class="ps-checks">';
    m.checks.forEach(function (k) {
      html += '<div class="ps-check ' + (k.ok ? 'ok' : 'bad') + '">' + (k.ok ? 'OK' : 'FALLA') + ' · ' + k.label + '</div>';
    });
    html += '</div>';
    html += '<div class="ps-foot">Convención: σ &gt; 0 tracción, σ &lt; 0 compresión · τxy &gt; 0 en la cara +x hacia +y · '
          + 'θ antihorario desde +x · en el círculo τ hacia arriba y 2θ en sentido horario.</div>';
    host.innerHTML = html;
  }

  function print(m) {
    printSheet(m);
    document.documentElement.classList.add('is-printing');
    window.print();
    setTimeout(function () { document.documentElement.classList.remove('is-printing'); }, 800);
  }

  function stamp(m) {
    return 'σx ' + f.stressDisplay(m.st.xx) + ' · σy ' + f.stressDisplay(m.st.yy)
         + ' · τxy ' + f.stressDisplay(m.st.xy) + ' · θ ' + f.angle(m.thetaDeg, 1) + '  [' + f.unit + ']';
  }

  ML.export = {
    procedure: procedure,
    report: report,
    principalNature: principalNature,
    snapshot: snapshot,
    download: download,
    svgToPng: svgToPng,
    print: print,
    printSheet: printSheet,
    stamp: stamp
  };

})(typeof window !== 'undefined'
  ? (window.MohrLab = window.MohrLab || {})
  : (global.MohrLab = global.MohrLab || {}));
