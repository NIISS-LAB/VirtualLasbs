/* =============================================================================
 * MOHR LAB — mohr.js
 * Geometría del Círculo de Mohr.  Sin DOM.  Ángulos siempre en RADIANES.
 *
 * CORRESPONDENCIA FUNDAMENTAL  θ_Mohr = 2·θ_físico
 *
 * Definición de los puntos:
 *   A = (σx ,  τxy)   cara +x  (normal exterior e₁)
 *   B = (σy , −τxy)  cara +y  (normal exterior e₂)
 *   P = (σθ ,  τθ)   cara inclinada θ
 *
 * De las ecuaciones de transformación se obtiene, con
 *      A₀ = (σx−σy)/2 ,  B₀ = τxy ,
 *      P − C = ( A₀·cos2θ + B₀·sin2θ ,  −A₀·sin2θ + B₀·cos2θ )
 * es decir  P − C = Rot(−2θ)·(A₀, B₀):  en el círculo el punto gira −2θ, esto es
 * en SENTIDO HORARIO cuando τ se representa hacia arriba. Ésta es la convención
 * clásica de Mohr y la que usa esta aplicación de forma consistente.
 * ========================================================================== */
(function (ML) {
  'use strict';

  var TWO_PI = 2 * Math.PI;
  var TAU_ = Math.PI;   // periodo del estado: 180°

  /**
   * Geometría completa del círculo a partir del estado plano.
   * @param {{xx,yy,xy}} s estado en MPa
   */
  function circle(s) {
    var avg = 0.5 * (s.xx + s.yy);
    var a = 0.5 * (s.xx - s.yy);
    var b = s.xy;
    var R = Math.hypot(a, b);
    return {
      avg: avg,
      a: a,
      b: b,
      R: R,
      s1: avg + R,
      s2: avg - R,
      tauMax: R,
      hydro: R < 1e-12 * Math.max(1, Math.abs(avg)),
      // Dirección angular de la semirrecta C→A medida desde +σ, en radianes.
      // A queda sobre la circunferencia: |A−C| = R.
      angleA: Math.atan2(b, a)
    };
  }

  /** Punto de la circunferencia para un plano girado θ (radianes). */
  function pointFor(c, theta) {
    var c2 = Math.cos(2 * theta), s2 = Math.sin(2 * theta);
    return { sigma: c.avg + c.a * c2 + c.b * s2, tau: -c.a * s2 + c.b * c2 };
  }

  /**
   * Punto diametralmente opuesto: cara perpendicular (normal e₂, ángulo θ+90°).
   * Verificado:  σ(θ+90°) = σx+σy−σ(θ)   y   τ(θ+90°) = −τ(θ).
   */
  function oppositeFor(c, theta) {
    var p = pointFor(c, theta);
    return { sigma: 2 * c.avg - p.sigma, tau: -p.tau };
  }

  /**
   * INVERSA EXACTA de pointFor.  Dado un punto (σ,τ) — se proyecta previamente
   * sobre la circunferencia — devuelve el ángulo físico θ que lo genera.
   *
   *   P − C = Rot(−2θ)·(A₀,B₀)  ⇒  2θ = ∠(A₀,B₀) − ∠(P−C)
   *
   * Ésta es la función que permite arrastrar P respetando la geometría del
   * círculo: nunca se admite un P fuera de la circunferencia.
   * @returns {number} θ en radianes, normalizado a [0, π)
   */
  function thetaFor(c, sigma, tau) {
    if (c.R < 1e-12) return 0;
    var dx = sigma - c.avg;
    var dy = tau;
    if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) return 0;
    var phi = Math.atan2(dy, dx);            // dirección del radio C→P
    var th = 0.5 * (c.angleA - phi);
    return normalize(th);
  }

  /** Proyecta un punto arbitrario sobre la circunferencia (restricción de arrastre). */
  function projectOnCircle(c, sigma, tau) {
    if (c.R < 1e-12) return { sigma: c.avg, tau: 0 };
    var dx = sigma - c.avg, dy = tau;
    var len = Math.hypot(dx, dy);
    if (len < 1e-12) return { sigma: c.avg + c.R, tau: 0 };
    return { sigma: c.avg + c.R * dx / len, tau: c.R * dy / len };
  }

  function normalize(theta) {
    var t = theta % TAU_;
    if (t < 0) t += TAU_;
    if (t >= TAU_) t -= TAU_;
    return t;
  }

  /** Puntos notables sobre la circunferencia. */
  function featurePoints(c, theta) {
    var p = pointFor(c, theta);
    var m = oppositeFor(c, theta);
    return {
      A: { sigma: c.avg + c.a, tau: c.b },
      B: { sigma: c.avg - c.a, tau: -c.b },
      P: p,
      Pperp: m,
      s1: { sigma: c.s1, tau: 0 },
      s2: { sigma: c.s2, tau: 0 },
      tauMaxPos: { sigma: c.avg, tau: c.R },
      tauMaxNeg: { sigma: c.avg, tau: -c.R }
    };
  }

  /**
   * Extensión del eje σ necesaria para encuadrar el círculo en el visor.
   * Incluye siempre el origen, σ1, σ2, σx, σy, σavg y el punto P en curso.
   */
  function sigmaExtent(c, theta, extra) {
    var f = featurePoints(c, theta);
    var lo = Math.min(0, c.s2, f.A.sigma, f.B.sigma, f.P.sigma, f.Pperp.sigma);
    var hi = Math.max(0, c.s1, f.A.sigma, f.B.sigma, f.P.sigma, f.Pperp.sigma);
    if (extra) {
      if (isFinite(extra.min)) lo = Math.min(lo, extra.min);
      if (isFinite(extra.max)) hi = Math.max(hi, extra.max);
    }
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    return { min: lo, max: hi };
  }

  ML.mohr = {
    circle: circle,
    pointFor: pointFor,
    oppositeFor: oppositeFor,
    thetaFor: thetaFor,
    projectOnCircle: projectOnCircle,
    normalize: normalize,
    featurePoints: featurePoints,
    sigmaExtent: sigmaExtent
  };

})(typeof window !== 'undefined'
  ? (window.MohrLab = window.MohrLab || {})
  : (global.MohrLab = global.MohrLab || {}));
