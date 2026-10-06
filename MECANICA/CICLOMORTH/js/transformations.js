/* =============================================================================
 * MOHR LAB — transformations.js
 * Transformación de esfuerzos, matriz de rotación y orientación principal.
 * Sin DOM.  Ángulos en RADIANES salvo indicación explícita.
 *
 * Base teórica (tensión plana):
 *      σ = [ σx  τxy ; τxy  σy ]
 *      Q = [ cosθ  sinθ ; −sinθ  cosθ ]
 *      σ' = Q·σ·Qᵀ
 *
 * De ahí, con la base local e₁=(cosθ,sinθ), e₂=(−sinθ,cosθ):
 *      σθ = σ'₁₁ = (σx+σy)/2 + (σx−σy)/2·cos2θ + τxy·sin2θ
 *      τθ = σ'₁₂ = −(σx−σy)/2·sin2θ + τxy·cos2θ
 * ========================================================================== */
(function (ML) {
  'use strict';

  var DEG = 180 / Math.PI;
  var RAD = Math.PI / 180;

  /**
   * Estado sobre un plano girado θ.  Vía principal (forma cerrada del enunciado).
   * @param {{xx,yy,xy}} s estado en MPa
   * @param {number} th  θ en radianes
   */
  function transform(s, th) {
    var avg = 0.5 * (s.xx + s.yy);
    var a = 0.5 * (s.xx - s.yy);
    var c2 = Math.cos(2 * th), s2 = Math.sin(2 * th);
    var sigmaT = avg + a * c2 + s.xy * s2;
    var tauT = -a * s2 + s.xy * c2;
    return {
      sigma: sigmaT,
      tau: tauT,
      // Cara perpendicular (normal e₂, ángulo θ+90°)
      sigmaM: s.xx + s.yy - sigmaT,
      tauM: -tauT,
      avg: avg,
      a: a,
      R: Math.hypot(a, s.xy),
      cos2: c2,
      sin2: s2
    };
  }

  /**
   * Matriz de rotación Q(θ) = [[cosθ, sinθ], [−sinθ, cosθ]]
   */
  function rotationMatrix(th) {
    var c = Math.cos(th), s = Math.sin(th);
    return [[c, s], [-s, c]];
  }

  /**
   * σ' = Q·σ·Qᵀ calculado por producto matricial explícito.
   * Ruta INDEPENDIENTE de transform(): se emplea en validation.js para verificar
   * que la forma cerrada y la definición tensorial coinciden.
   */
  function rotateTensor(s, th) {
    var Q = rotationMatrix(th);
    var S = [[s.xx, s.xy], [s.xy, s.yy]];
    // QT = Q transpuesta
    var QT = [[Q[0][0], Q[1][0]], [Q[0][1], Q[1][1]]];
    // T = S·QT
    var T = [
      [S[0][0] * QT[0][0] + S[0][1] * QT[1][0], S[0][0] * QT[0][1] + S[0][1] * QT[1][1]],
      [S[1][0] * QT[0][0] + S[1][1] * QT[1][0], S[1][0] * QT[0][1] + S[1][1] * QT[1][1]]
    ];
    // P = Q·T
    var P = [
      [Q[0][0] * T[0][0] + Q[0][1] * T[1][0], Q[0][0] * T[0][1] + Q[0][1] * T[1][1]],
      [Q[1][0] * T[0][0] + Q[1][1] * T[1][0], Q[1][0] * T[0][1] + Q[1][1] * T[1][1]]
    ];
    return { xx: P[0][0], yy: P[1][1], xy: P[0][1] };
  }

  /**
   * Orientación de las direcciones principales.
   *
   *   σθ es máxima cuando dσθ/dθ = 0  ⇒  τxy·cos2θ = ((σx−σy)/2)·sin2θ
   *                              ⇒  tan2θp = 2τxy/(σx−σy)
   *
   * Se usa atan2(2τxy, σx−σy) para obtener directamente el cuadrante correcto:
   * θp queda en [0, 180) y corresponde SIEMPRE a σ1 (el mayor). El estado es
   * 180°-periódico y σ1≠σ2 salvo estado hidrostático.
   */
  function principalAngle(s) {
    var a = 0.5 * (s.xx - s.yy);
    var R2 = a * a + s.xy * s.xy;
    if (R2 < 1e-24) {
      return {
        thetaP: 0, thetaPdeg: 0,
        thetaS: 45, thetaSdeg: 45,
        hydro: true, tan2: (s.xx === s.yy ? Infinity : 0),
        quadrant: 'indefinido'
      };
    }
    var twoP = Math.atan2(s.xy, a);          // ∈ (−π, π]
    var tp = 0.5 * twoP;
    // Normalizar a [0, π)
    if (tp < 0) tp += Math.PI;
    if (tp >= Math.PI) tp -= Math.PI;
    var ts = tp + Math.PI / 4;
    if (ts >= Math.PI) ts -= Math.PI;
    return {
      thetaP: tp,
      thetaPdeg: tp * DEG,
      thetaS: ts,
      thetaSdeg: ts * DEG,
      hydro: false,
      twoPdeg: twoP * DEG,
      tan2: (s.xx === s.yy) ? (s.xy === 0 ? 0 : Infinity) : (2 * s.xy) / (s.xx - s.yy),
      quadrant: quadrantOf(twoP)
    };
  }

  function quadrantOf(twoP) {
    var d = twoP * DEG;
    if (d >= 0 && d < 90) return 'I';
    if (d >= 90 && d <= 180) return 'II';
    if (d < 0 && d > -90) return 'IV';
    if (d <= -90 && d >= -180) return 'III';
    return 'I';
  }

  /** Base local del elemento girado. */
  function basis(th) {
    var c = Math.cos(th), s = Math.sin(th);
    return {
      e1: { x: c, y: s },      // normal de la cara θ  (eje x' local)
      e2: { x: -s, y: c }      // normal de la cara θ+90° (eje y' local)
    };
  }

  /**
   * Esfuerzos sobre las dos parejas de caras del elemento, listos para dibujar.
   *
   * De t = σ·n, evaluating en la base local (e₁,e₂):
   *   cara de normal e₁ :  t = σθ·e₁ + τθ·e₂      (σ'₁₁ = σθ , σ'₂₁ = τθ)
   *   cara de normal e₂ :  t = τθ·e₁ + σ⊥·e₂      (σ'₂₁ = τθ , σ'₂₂ = σ⊥)
   *
   * El cortante es el MISMO componente del tensor (σ'₁₂ = σ'₂₁ = τθ) en ambas
   * parejas de caras: por eso las flechas de cortante de la cara +x′ y de la
   * cara +y′ apuntan cada una hacia el vértice común, patrón clásico de τ > 0.
   * Las caras opuestas (−e₁, −e₂) llevan todos los signos invertidos.
   *
   * @returns {{basis, n:{nx,ny,sdir,tdir,sigma,tau}, m:{...}}}
   *   nx,ny  normal exterior unitaria de la cara
   *   sdir   dirección unitaria del esfuerzo normal
   *   tdir   dirección unitaria del esfuerzo cortante
   *   sigma  valor normal (positivo = tracción)
   *   tau    valor cortante (positivo según la convención de la aplicación)
   */
  function faces(s, th) {
    var t = transform(s, th);
    var b = basis(th);
    return {
      basis: b,
      n: { nx: b.e1.x, ny: b.e1.y, sdir: b.e1, tdir: b.e2, sigma: t.sigma, tau: t.tau },
      m: { nx: b.e2.x, ny: b.e2.y, sdir: b.e2, tdir: b.e1, sigma: t.sigmaM, tau: t.tau }
    };
  }

  /**
   * Los ocho vectores de esfuerzo del elemento (4 caras × 2 componentes), en
   * coordenadas NORMALIZADAS del elemento: el cuadrado ocupa [−1,1]², de modo
   * que el CENTRO de cada cara coincide con su normal exterior
   * (ox,oy) = ±(nx,ny), y el punto medio de una arista quedaría en ±0.5.
   *
   * REGLA DE DIBUJO (esencial para la convención de signos):
   *   la flecha NORMAL se dibuja a lo largo de la normal EXTERIOR de cada cara
   *   con el valor σ sin alterar; por tanto una tracción (σ>0) apunta hacia
   *   fuera en las cuatro caras y una compresión (σ<0) hacia dentro en las
   *   cuatro. Lo mismo ocurre con τ: el cortante conserva su signo y lo que
   *   cambia al pasar a la cara opuesta es la dirección tangencial.
   *   De este modo t(−n̂) = −t(n̂) y el elemento queda en equilibrio.
   *
   * Ésta es la lista exacta que consume el renderizador SVG, de modo que la
   * prueba de validación y el dibujo comparten literalmente el mismo dato: si se
   * altera un signo o un factor de escala aquí, la validación lo detecta.
   *
   * @returns {Array<{pair,sign,comp,kind,ox,oy,dx,dy,value}>}
   *   ox,oy  origen = centro de la cara   dx,dy  dirección unitaria
   *   value  magnitud con signo (MPa)      kind   'sigma' | 'tau'
   */
  function arrowSet(s, th) {
    var f = faces(s, th);
    var out = [];
    [f.n, f.m].forEach(function (fc) {
      [1, -1].forEach(function (k) {
        var cx = k * fc.nx, cy = k * fc.ny;
        out.push({ pair: fc === f.n ? 'n' : 'm', sign: k, comp: 'normal', kind: 'sigma',
                   ox: cx, oy: cy, dx: k * fc.sdir.x, dy: k * fc.sdir.y, value: fc.sigma });
        out.push({ pair: fc === f.n ? 'n' : 'm', sign: k, comp: 'shear', kind: 'tau',
                   ox: cx, oy: cy, dx: k * fc.tdir.x, dy: k * fc.tdir.y, value: fc.tau });
      });
    });
    return out;
  }

  ML.tf = {
    DEG: DEG,
    RAD: RAD,
    transform: transform,
    rotationMatrix: rotationMatrix,
    rotateTensor: rotateTensor,
    principalAngle: principalAngle,
    basis: basis,
    faces: faces,
    arrowSet: arrowSet
  };

})(typeof window !== 'undefined'
  ? (window.MohrLab = window.MohrLab || {})
  : (global.MohrLab = global.MohrLab || {}));
