/* =============================================================================
 * MOHR LAB — validation.js
 * (1) Comprobación en vivo del estado de esfuerzos (§13)
 * (2) Suite automática de pruebas contra soluciones analíticas (§28)
 *
 * La validación NO repite las mismas fórmulas que la aplicación: cuando es
 * posible usa una vía de cálculo independiente (ecuación característica,
 * producto matricial, recorrido completo de la circunferencia) para que la
 * comprobación tenga contenido real.
 * ========================================================================== */
(function (ML) {
  'use strict';

  var S = ML.stress, M = ML.mohr, T = ML.tf;
  var DEG = 180 / Math.PI;

  /** Comparación con tolerancia relativa y absoluta combinadas. */
  function near(a, b, relTol, absTol) {
    relTol = relTol === undefined ? 1e-9 : relTol;
    absTol = absTol === undefined ? 1e-9 : absTol;
    if (!isFinite(a) || !isFinite(b)) return a === b;
    var diff = Math.abs(a - b);
    var scale = Math.max(Math.abs(a), Math.abs(b), absTol);
    return diff <= Math.max(absTol, relTol * scale);
  }

  // ---------------------------------------------------------------------------
  // (1) Comprobación en vivo
  // ---------------------------------------------------------------------------

  /**
   * @param {{xx,yy,xy}} st  estado plano (MPa)
   * @param {number} th      θ en radianes
   * @returns {Array<{id,label,ok,detail,formula,rows}>}
   */
  function checks(st, th) {
    var inv = S.invariants(st);
    var pr = S.principalsFromInvariants(inv.I1, inv.I2);
    var c = M.circle(st);
    var tr = T.transform(st, th);
    var mx = T.rotateTensor(st, th);
    var tol = 1e-9 * Math.max(1, Math.abs(st.xx), Math.abs(st.yy), Math.abs(st.xy));

    // --- 1. Ecuaciones consistentes -----------------------------------------
    var sumOk = near(c.s1 + c.s2, st.xx + st.yy, 1e-9, 1e-7);
    var prodOk = near(c.s1 * c.s2, st.xx * st.yy - st.xy * st.xy, 1e-9, 1e-7);
    var eqOK = sumOk && prodOk;
    var equations = [
      eqItem('σ1 + σ2 = σx + σy', c.s1 + c.s2, st.xx + st.yy, sumOk),
      eqItem('σ1·σ2 = σx·σy − τxy²', c.s1 * c.s2, st.xx * st.yy - st.xy * st.xy, prodOk)
    ];

    // --- 2. Invariantes consistentes ----------------------------------------
    // Contrastados contra la vía cuadrática: λ² − I1λ + I2 = 0
    var invOK = near(pr.hi, c.s1, 1e-9, 1e-7) && near(pr.lo, c.s2, 1e-9, 1e-7);
    var invariants = [
      eqItem('I1 = tr σ = σx + σy', inv.I1, st.xx + st.yy, true),
      eqItem('I2 = σx·σy − τxy²', inv.I2, st.xx * st.yy - st.xy * st.xy, true),
      eqItem('Raíz cuadrática λ+ = σ1', pr.hi, c.s1, near(pr.hi, c.s1, 1e-9, 1e-7)),
      eqItem('Raíz cuadrática λ− = σ2', pr.lo, c.s2, near(pr.lo, c.s2, 1e-9, 1e-7))
    ];
    // J2 en tensión plana coincide con R²
    var j2 = Math.pow(c.R, 2);
    var j2check = Math.pow((st.xx - st.yy) / 2, 2) + Math.pow(st.xy, 2);
    invariants.push(eqItem('J2 = ((σx−σy)/2)² + τxy² = R²', j2, j2check, near(j2, j2check, 1e-9, 1e-9)));
    invOK = invOK && near(j2, j2check, 1e-9, 1e-9);

    // --- 3. Transformación consistente --------------------------------------
    // Forma cerrada contra σ' = Q·σ·Qᵀ
    var tfOK = near(tr.sigma, mx.xx, 1e-9, 1e-7) && near(tr.tau, mx.xy, 1e-9, 1e-7)
            && near(tr.sigmaM, mx.yy, 1e-9, 1e-7);
    // Relación de ortogonalidad entre caras perpendiculares
    var tr90 = T.transform(st, th + Math.PI / 2);
    var orthOK = near(tr90.sigma, st.xx + st.yy - tr.sigma, 1e-9, 1e-7)
              && near(tr90.tau, -tr.tau, 1e-9, 1e-7);
    var transformation = [
      eqItem('σθ (forma cerrada) = (Q·σ·Qᵀ)₁₁', tr.sigma, mx.xx, near(tr.sigma, mx.xx, 1e-9, 1e-7)),
      eqItem('τθ (forma cerrada) = (Q·σ·Qᵀ)₁₂', tr.tau, mx.xy, near(tr.tau, mx.xy, 1e-9, 1e-7)),
      eqItem('σ(θ+90°) = σx + σy − σθ', tr90.sigma, st.xx + st.yy - tr.sigma, orthOK),
      eqItem('τ(θ+90°) = −τθ', tr90.tau, -tr.tau, orthOK)
    ];
    tfOK = tfOK && orthOK;

    // --- 4. Geometría del círculo consistente --------------------------------
    var p = M.pointFor(c, th);
    var radErr = Math.hypot(p.sigma - c.avg, p.tau) - c.R;
    var radOK = Math.abs(radErr) < 1e-7 * Math.max(1, c.R);
    // Ida y vuelta del arrastre: θ → P → θ
    var thBack = M.thetaFor(c, p.sigma, p.tau);
    var dth = Math.abs(((thBack - th) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2);
    var dthOK = Math.abs(thBack - th) < 1e-7 || Math.abs(thBack - th - Math.PI) < 1e-7
             || Math.abs(thBack - th + Math.PI) < 1e-7;
    // Los extremos del círculo están donde deben
    var s1OK = near(c.s1 - c.avg, c.R, 1e-9, 1e-9) && near(c.avg - c.s2, c.R, 1e-9, 1e-9);
    var geometry = [
      eqItem('|P − C| = R', Math.hypot(p.sigma - c.avg, p.tau), c.R, radOK),
      eqItem('σ1 − σavg = R', c.s1 - c.avg, c.R, near(c.s1 - c.avg, c.R, 1e-9, 1e-9)),
      eqItem('σavg − σ2 = R', c.avg - c.s2, c.R, near(c.avg - c.s2, c.R, 1e-9, 1e-9)),
      eqItem('θ → P → θ (ida y vuelta del arrastre)', thBack * DEG, th * DEG, dthOK)
    ];
    var geoOK = radOK && dthOK && s1OK;

    return [
      { id: 'eq', label: 'Ecuaciones consistentes', ok: eqOK, rows: equations,
        note: 'Compara los valores calculados con la igualdad que deben satisfacer por definición de autovalores del tensor.' },
      { id: 'inv', label: 'Invariantes consistentes', ok: invOK, rows: invariants,
        note: 'Los esfuerzos principales se recalculan por la ecuación característica λ² − I1λ + I2 = 0, ruta independiente de σavg ± R.' },
      { id: 'tf', label: 'Transformación consistente', ok: tfOK, rows: transformation,
        note: 'Contrasta la forma cerrada del enunciado con la definición tensorial σ′ = Q·σ·Qᵀ.' },
      { id: 'geo', label: 'Geometría del círculo consistente', ok: geoOK, rows: geometry,
        note: 'Verifica que P pertenece a la circunferencia y que el arrastre devuelve exactamente el mismo θ.' }
    ];
  }

  function eqItem(label, got, expected, ok) {
    return { label: label, got: got, expected: expected, ok: ok };
  }

  // ---------------------------------------------------------------------------
  // (2) Suite automática
  // ---------------------------------------------------------------------------

  /** Generador congruencial lineal: reproducible entre ejecuciones. */
  function lcg(seed) {
    var x = seed >>> 0;
    return function () {
      x = (1664525 * x + 1013904223) >>> 0;
      return x / 4294967296;
    };
  }

  function approx(a, b, tol) { return near(a, b, 0, tol); }

  var TESTS = [];

  function T1() {
    var st = S.plane(100, 0, 0), c = M.circle(st);
    return {
      name: 'TEST 1 · Tracción uniaxial  σx=100, σy=0, τxy=0',
      ok: approx(c.s1, 100, 1e-9) && approx(c.s2, 0, 1e-9) && approx(c.tauMax, 50, 1e-9),
      detail: 'σ1 = ' + c.s1.toFixed(6) + '  σ2 = ' + c.s2.toFixed(6) + '  τmax = ' + c.tauMax.toFixed(6)
    };
  }
  function T2() {
    var st = S.plane(0, 0, 50), c = M.circle(st);
    return {
      name: 'TEST 2 · Cortante puro  σx=0, σy=0, τxy=50',
      ok: approx(c.s1, 50, 1e-9) && approx(c.s2, -50, 1e-9) && approx(c.tauMax, 50, 1e-9),
      detail: 'σ1 = ' + c.s1.toFixed(6) + '  σ2 = ' + c.s2.toFixed(6) + '  τmax = ' + c.tauMax.toFixed(6)
    };
  }
  function T3() {
    var st = S.plane(80, -30, 0), c = M.circle(st), pa = T.principalAngle(st);
    return {
      name: 'TEST 3 · Estado biaxial sin cortante  σx=80, σy=−30, τxy=0',
      ok: approx(c.s1, 80, 1e-9) && approx(c.s2, -30, 1e-9) && approx(c.tauMax, 55, 1e-9)
          && approx(pa.thetaPdeg, 0, 1e-9) && approx(pa.thetaSdeg, 45, 1e-9),
      detail: 'σ1 = ' + c.s1.toFixed(6) + '  σ2 = ' + c.s2.toFixed(6) + '  τmax = ' + c.tauMax.toFixed(6)
              + '  θp = ' + pa.thetaPdeg.toFixed(6) + '  θs = ' + pa.thetaSdeg.toFixed(6)
    };
  }
  function T4() {
    var st = S.plane(80, -30, 40), c = M.circle(st), pa = T.principalAngle(st);
    return {
      name: 'TEST 4 · Estado combinado  σx=80, σy=−30, τxy=40',
      ok: approx(c.s1, 93.007353, 1e-6) && approx(c.s2, -43.007353, 1e-6) && approx(c.tauMax, 68.007353, 1e-6)
          && approx(pa.thetaPdeg, 18.013687, 1e-5) && approx(pa.thetaSdeg, 63.013687, 1e-5),
      detail: 'σ1 = ' + c.s1.toFixed(6) + '  σ2 = ' + c.s2.toFixed(6) + '  τmax = ' + c.tauMax.toFixed(6)
              + '  θp = ' + pa.thetaPdeg.toFixed(6) + '  θs = ' + pa.thetaSdeg.toFixed(6)
    };
  }
  function T5() {
    // En cortante puro, a 45° desaparece el cortante y aparece σ1 en toda su magnitud.
    var st = S.plane(0, 0, 50), tr = T.transform(st, 45 / DEG);
    return {
      name: 'TEST 5 · Cortante puro, θ=45°  ⇒  σθ = σ1 y τθ = 0',
      ok: approx(tr.sigma, 50, 1e-9) && approx(tr.tau, 0, 1e-9),
      detail: 'σθ = ' + tr.sigma.toFixed(6) + '  τθ = ' + tr.tau.toFixed(9)
    };
  }
  function T6() {
    var st = S.plane(75, 75, 0), c = M.circle(st);
    return {
      name: 'TEST 6 · Estado hidrostático plano  σx=σy=75  ⇒  R = 0',
      ok: approx(c.R, 0, 1e-12) && approx(c.s1, 75, 1e-9) && approx(c.s2, 75, 1e-9),
      detail: 'R = ' + c.R.toExponential(3) + '  σ1 = σ2 = ' + c.s1.toFixed(6)
    };
  }
  function T7() {
    // σx=0, σy=-90: la dirección x ya lleva σ=0, luego es la dirección de σ1.
    var st = S.plane(0, -90, 0), c = M.circle(st), pa = T.principalAngle(st);
    return {
      name: 'TEST 7 · Compresión uniaxial  σx=0, σy=−90  ⇒  ningún esfuerzo principal positivo',
      ok: approx(c.s1, 0, 1e-9) && approx(c.s2, -90, 1e-9) && approx(c.tauMax, 45, 1e-9)
          && approx(pa.thetaPdeg, 0, 1e-9) && approx(pa.thetaSdeg, 45, 1e-9),
      detail: 'σ1 = ' + c.s1.toFixed(6) + '  σ2 = ' + c.s2.toFixed(6) + '  τmax = ' + c.tauMax.toFixed(6)
              + '  θp = ' + pa.thetaPdeg.toFixed(6) + '  θs = ' + pa.thetaSdeg.toFixed(6)
    };
  }
  function T8() {
    // τxy negativo ⇒ θp por debajo de 0°, debe normalizarse a [0,180)
    var st = S.plane(100, 40, -55), pa = T.principalAngle(st);
    return {
      name: 'TEST 8 · Normalización de θp con τxy < 0  ⇒  θp ∈ [0°, 180°)',
      ok: pa.thetaPdeg >= 0 && pa.thetaPdeg < 180 && approx(pa.thetaPdeg, 149.305226, 1e-5),
      detail: 'θp = ' + pa.thetaPdeg.toFixed(6) + '°   (sin normalizar: ' + pa.twoPdeg.toFixed(6) + '° en 2θ)'
    };
  }
  function T9() {
    // θs debe estar 45° de θp y producir |τ| = R con σ = σavg
    var st = S.plane(-20, 55, 30), c = M.circle(st), pa = T.principalAngle(st);
    var tp = T.transform(st, pa.thetaP), ts = T.transform(st, pa.thetaS);
    return {
      name: 'TEST 9 · Orientaciones principales  θp ⇒ σ=σ1,τ=0 ; θs ⇒ |τ|=R, σ=σavg',
      ok: approx(tp.sigma, c.s1, 1e-9) && approx(tp.tau, 0, 1e-9)
          && approx(Math.abs(ts.tau), c.R, 1e-9) && approx(ts.sigma, c.avg, 1e-9)
          && approx(Math.abs(pa.thetaSdeg - pa.thetaPdeg), 45, 1e-9),
      detail: 'θp = ' + pa.thetaPdeg.toFixed(4) + '°  θs = ' + pa.thetaSdeg.toFixed(4)
              + '°  (Δ = 45°)  σ(θp) = ' + tp.sigma.toFixed(6) + '  |τ(θs)| = ' + Math.abs(ts.tau).toFixed(6)
    };
  }
  function T10() {
    // Matriz de rotación ortogonal y σ' = QσQᵀ coincide con la forma cerrada en 400 ángulos
    var st = S.plane(65, -20, 45), worst = 0, orth = 0;
    for (var i = 0; i < 400; i++) {
      var th = i * (Math.PI / 400);
      var a = T.transform(st, th), b = T.rotateTensor(st, th);
      worst = Math.max(worst, Math.abs(a.sigma - b.xx), Math.abs(a.tau - b.xy), Math.abs(a.sigmaM - b.yy));
      var Q = T.rotationMatrix(th);
      orth = Math.max(orth, Math.abs(Q[0][0] * Q[0][0] + Q[0][1] * Q[0][1] - 1),
                            Math.abs(Q[0][0] * Q[1][0] + Q[0][1] * Q[1][1] - 0));
    }
    return {
      name: 'TEST 10 · Ortogonalidad de Q y equivalencia σ′ = Q·σ·Qᵀ en 400 ángulos',
      ok: worst < 1e-10 && orth < 1e-12,
      detail: 'error máximo = ' + worst.toExponential(2) + '   error de ortogonalidad = ' + orth.toExponential(2)
    };
  }
  function T11() {
    // Barrido aleatorio: invariantes, geometría e ida y vuelta del arrastre
    var rnd = lcg(20260927), worstInv = 0, worstRad = 0, worstTh = 0, worstQuad = 0;
    for (var i = 0; i < 3000; i++) {
      var st = S.plane((rnd() * 2 - 1) * 250, (rnd() * 2 - 1) * 250, (rnd() * 2 - 1) * 250);
      var th = rnd() * Math.PI;
      var c = M.circle(st), inv = S.invariants(st), pr = S.principalsFromInvariants(inv.I1, inv.I2);
      var sc = Math.max(1, Math.abs(st.xx), Math.abs(st.yy), Math.abs(st.xy));
      worstInv = Math.max(worstInv,
        Math.abs(c.s1 + c.s2 - (st.xx + st.yy)) / sc,
        Math.abs(c.s1 * c.s2 - (st.xx * st.yy - st.xy * st.xy)) / (sc * sc));
      worstQuad = Math.max(worstQuad, Math.abs(pr.hi - c.s1) / sc, Math.abs(pr.lo - c.s2) / sc);
      var p = M.pointFor(c, th);
      worstRad = Math.max(worstRad, Math.abs(Math.hypot(p.sigma - c.avg, p.tau) - c.R) / sc);
      var back = M.thetaFor(c, p.sigma, p.tau);
      var d = Math.abs(back - th);
      if (d > Math.PI / 2) d = Math.PI - d;
      worstTh = Math.max(worstTh, d);
    }
    return {
      name: 'TEST 11 · Barrido aleatorio (3000 estados) de invariantes, circunferencia e idempotencia θ',
      ok: worstInv < 1e-12 && worstRad < 1e-12 && worstTh < 1e-9 && worstQuad < 1e-12,
      detail: 'invariantes ' + worstInv.toExponential(2) + ' · radio ' + worstRad.toExponential(2)
              + ' · raíz cuadrática ' + worstQuad.toExponential(2) + ' · θ ' + worstTh.toExponential(2)
    };
  }
  function T12() {
    // Conversión de unidades ida y vuelta en las cinco unidades
    var worst = 0, u = ML.format.UNITS;
    for (var i = 0; i < u.length; i++) {
      for (var k = -3; k <= 3; k++) {
        var v = 137.482 * Math.pow(10, k);
        var back = ML.format.fromBase(ML.format.toBase(v, u[i].id), u[i].id);
        worst = Math.max(worst, Math.abs(back - v) / Math.max(1e-12, Math.abs(v)));
      }
    }
    return {
      name: 'TEST 12 · Conversión de unidades ida y vuelta (MPa, kPa, Pa, ksi, psi)',
      ok: worst < 1e-14,
      detail: 'error relativo máximo = ' + worst.toExponential(2)
    };
  }
  function T13() {
    // 1 ksi = 6.894757293168361 MPa
    var k = ML.format.toBase(1, 'ksi');
    return {
      name: 'TEST 13 · Factor de conversión  1 ksi = 6.894757293168361 MPa',
      ok: Math.abs(k - 6.894757293168361) < 1e-15,
      detail: 'valor = ' + k
    };
  }
  function T14() {
    // Añadir σz=0 al estado plano debe recuperar el mismo conjunto de esfuerzos
    // principales: {σ1, σ2, 0} reordenado.  No se presupone cuál es σ2 en 3D:
    // el plano de σz=0 puede interponerse entre los dos esfuerzos del plano.
    var st = S.plane(80, -30, 40);
    var p3 = S.principal3D(S.full3D(st, 0));
    var c2 = M.circle(st);
    var want = [c2.s1, c2.s2, 0].sort(function (a, b) { return b - a; });
    var got = [p3.s1, p3.s2, p3.s3];
    var worst = 0;
    for (var i = 0; i < 3; i++) worst = Math.max(worst, Math.abs(want[i] - got[i]));
    return {
      name: 'TEST 14 · Consistencia plano ↔ 3D con σz = 0 (extensión)',
      ok: worst < 1e-7 && got[0] >= got[1] && got[1] >= got[2],
      detail: 'plano [σ1,σ2] = [' + c2.s1.toFixed(4) + ', ' + c2.s2.toFixed(4) + ']  ⇒  3D [σ1,σ2,σ3] = ['
              + got.map(function (v) { return v.toFixed(4); }).join(', ') + ']   error = ' + worst.toExponential(2)
    };
  }
  function T15() {
    // τmax = (σ1 − σ2)/2  y  σavg = (σ1+σ2)/2  siempre
    var rnd = lcg(777), worst1 = 0, worst2 = 0;
    for (var i = 0; i < 2000; i++) {
      var st = S.plane((rnd() * 2 - 1) * 400, (rnd() * 2 - 1) * 400, (rnd() * 2 - 1) * 400);
      var c = M.circle(st), sc = Math.max(1, Math.abs(st.xx), Math.abs(st.yy), Math.abs(st.xy));
      worst1 = Math.max(worst1, Math.abs((c.s1 - c.s2) / 2 - c.tauMax) / sc);
      worst2 = Math.max(worst2, Math.abs((c.s1 + c.s2) / 2 - c.avg) / sc);
    }
    return {
      name: 'TEST 15 · Identidades τmax = (σ1−σ2)/2 y σavg = (σ1+σ2)/2 (2000 estados)',
      ok: worst1 < 1e-14 && worst2 < 1e-14,
      detail: 'error máximo: τmax ' + worst1.toExponential(2) + ' · σavg ' + worst2.toExponential(2)
    };
  }
  function T16() {
    // Verificación de la CONVENCIÓN DE TRACCIÓN que consume el dibujo del elemento.
    //   (a) independiente: t = σ·n calculado del tensor original en marco GLOBAL
    //       debe coincidir con el reconstruido a partir de σθ y τθ;
    //   (b) sobre los datos REALES que se dibujan (arrowSet): equilibrio ΣF = 0,
    //       par torsor ΣM = 0 y descomposición correcta en las cuatro caras, es
    //       decir  t·n̂ = σ_normal  y  t·t̂ = τ  con los signos de cada cara.
    var st = S.plane(70, 25, -48);
    var wDirect = 0, wEq = 0, wMom = 0, wProj = 0, wOrigin = 0;

    for (var i = 0; i < 40; i++) {
      var th = i * Math.PI / 80;
      var arrows = T.arrowSet(st, th);

      // El origen de cada vector debe ser el CENTRO de la cara, es decir un
      // punto de la circunferencia unidad en el cuadrado normalizado [−1,1]².
      arrows.forEach(function (a) {
        wOrigin = Math.max(wOrigin, Math.abs(Math.hypot(a.ox, a.oy) - 1));
      });

      // Reagrupa los ocho vectores en las cuatro caras del elemento
      var fc = {};
      arrows.forEach(function (a) {
        var key = a.pair + (a.sign > 0 ? '+' : '-');
        var q = fc[key] || (fc[key] = { nhat: null, that: null, sigma: 0, tau: 0 });
        if (a.comp === 'normal') { q.nhat = { x: a.dx, y: a.dy }; q.sigma = a.value; }
        else { q.that = { x: a.dx, y: a.dy }; q.tau = a.value; }
      });
      var keys = ['n+', 'n-', 'm+', 'm-'];

      // (a) contraste con el cálculo directo t = σ·n en marco global
      keys.forEach(function (k) {
        var q = fc[k];
        var nx = q.nhat.x, ny = q.nhat.y;                  // normal exterior de la cara
        var direct = { x: st.xx * nx + st.xy * ny, y: st.xy * nx + st.yy * ny };
        var built = { x: q.sigma * q.nhat.x + q.tau * q.that.x,
                      y: q.sigma * q.nhat.y + q.tau * q.that.y };
        wDirect = Math.max(wDirect, Math.hypot(direct.x - built.x, direct.y - built.y));
      });

      // (b) equilibrio y descomposición sobre los datos dibujados
      var fx = 0, fy = 0, mom = 0;
      keys.forEach(function (k) {
        var q = fc[k];
        var tx = q.sigma * q.nhat.x + q.tau * q.that.x;
        var ty = q.sigma * q.nhat.y + q.tau * q.that.y;
        fx += tx; fy += ty;
        mom += q.nhat.x * ty - q.nhat.y * tx;               // par torsor  f = n̂ × t
        // El esfuerzo normal es la proyección de la tracción sobre su propia
        // normal exterior; el cortante, sobre su dirección tangencial.
        wProj = Math.max(wProj,
          Math.abs((tx * q.nhat.x + ty * q.nhat.y) - q.sigma),
          Math.abs((tx * q.that.x + ty * q.that.y) - q.tau));
      });
      wEq = Math.max(wEq, Math.hypot(fx, fy));
      wMom = Math.max(wMom, Math.abs(mom));
    }

    var ok = wDirect < 1e-9 && wEq < 1e-9 && wMom < 1e-9 && wProj < 1e-9 && wOrigin < 1e-12;
    return {
      name: 'TEST 16 · Convención de tracción en 40 ángulos:  t = σ·n  ·  ΣF = 0  ·  ΣM = 0  ·  t·n̂ = σ y t·t̂ = τ  ·  origen en la cara',
      ok: ok,
      detail: 'error contra σ·n = ' + wDirect.toExponential(2)
              + '  ·  |ΣF| = ' + wEq.toExponential(2)
              + '  ·  |ΣM| = ' + wMom.toExponential(2)
              + '  ·  error de proyección = ' + wProj.toExponential(2)
              + '  ·  error de posición del origen = ' + wOrigin.toExponential(2)
    };
  }
  function T17() {
    // Rango completo de σθ(θ).  Se localiza el extremo por búsqueda ternaria
    // (método numérico independiente) y además se comprueba que el barrido
    // grueso de 0.1° contiene los extremos analíticos.
    var st = S.plane(55, -80, 25), c = M.circle(st);
    var f = function (th) { return T.transform(st, th).sigma; };
    var hi = ternaryMax(f, 0, Math.PI), lo = ternaryMin(f, 0, Math.PI);
    var sweepHi = -Infinity, sweepLo = Infinity;
    for (var i = 0; i <= 1800; i++) {
      var v = f(i * Math.PI / 1800);
      sweepHi = Math.max(sweepHi, v); sweepLo = Math.min(sweepLo, v);
    }
    var brackets = sweepHi >= c.s1 - 1e-3 && sweepLo <= c.s2 + 1e-3;
    var ok = near(hi, c.s1, 1e-9, 1e-8) && near(lo, c.s2, 1e-9, 1e-8) && brackets;
    return {
      name: 'TEST 17 · Rango completo de σθ(θ) en 0°≤θ≤180°  ⇒  [σ2, σ1]',
      ok: ok,
      detail: 'máx (ternaria) = ' + hi.toFixed(8) + ' vs σ1 = ' + c.s1.toFixed(8)
              + '   ·   mín (ternaria) = ' + lo.toFixed(8) + ' vs σ2 = ' + c.s2.toFixed(8)
              + '   ·   barrido 0.1° = [' + sweepLo.toFixed(4) + ', ' + sweepHi.toFixed(4) + ']'
    };
  }
  function T18() {
    // Rango completo de τθ(θ)  ⇒  [−R, +R]
    var st = S.plane(55, -80, 25), c = M.circle(st);
    var f = function (th) { return T.transform(st, th).tau; };
    var hi = ternaryMax(f, 0, Math.PI), lo = ternaryMin(f, 0, Math.PI);
    var ok = near(hi, c.R, 1e-9, 1e-8) && near(lo, -c.R, 1e-9, 1e-8);
    return {
      name: 'TEST 18 · Rango completo de τθ(θ) en 0°≤θ≤180°  ⇒  [−R, +R]',
      ok: ok,
      detail: 'máx (ternaria) = ' + hi.toFixed(8) + ' vs  R = ' + c.R.toFixed(8)
              + '   ·   mín (ternaria) = ' + lo.toFixed(8) + ' vs −R = ' + (-c.R).toFixed(8)
    };
  }

  /** Búsqueda ternaria del máximo de una función unimodal en [a,b]. */
  function ternaryMax(f, a, b) {
    for (var i = 0; i < 300; i++) {
      var m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
      if (f(m1) < f(m2)) a = m1; else b = m2;
    }
    return f((a + b) / 2);
  }
  function ternaryMin(f, a, b) {
    return -ternaryMax(function (x) { return -f(x); }, a, b);
  }

  TESTS = [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16, T17, T18];

  /** Ejecuta la suite completa. */
  function run() {
    var out = [], pass = 0;
    for (var i = 0; i < TESTS.length; i++) {
      var r;
      try { r = TESTS[i](); }
      catch (e) { r = { name: TESTS[i].name || ('TEST ' + (i + 1)), ok: false, detail: 'excepción: ' + e.message }; }
      if (r.ok) pass++;
      out.push(r);
    }
    return { total: TESTS.length, pass: pass, fail: TESTS.length - pass, results: out };
  }

  ML.validation = {
    near: near,
    checks: checks,
    TESTS: TESTS,
    run: run,
    lcg: lcg
  };

})(typeof window !== 'undefined'
  ? (window.MohrLab = window.MohrLab || {})
  : (global.MohrLab = global.MohrLab || {}));
