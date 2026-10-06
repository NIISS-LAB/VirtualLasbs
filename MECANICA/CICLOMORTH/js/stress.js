/* =============================================================================
 * MOHR LAB — stress.js
 * MODELO MATEMÁTICO. Estado de esfuerzos, tensores e invariantes.
 *
 * Este módulo es la ÚNICA fuente de verdad para cualquier propiedad del tensor de
 * esfuerzos. No contiene nada de DOM, SVG ni formato: sólo algebra en doble
 * precisión, sin redondeo interno.
 *
 * CONVENCIÓN DE SIGNOS (única en toda la aplicación)
 *   σ  > 0  tracción (separación de las caras)
 *   σ  < 0  compresión
 *   τxy > 0  en la cara +x el cortante actúa hacia +y; en la cara +y actúa hacia +x
 * ========================================================================== */
(function (ML) {
  'use strict';

  var EPS = 1e-12;

  /** Crea un estado plano normalizado (objeto plano, no con prototipos). */
  function plane(xx, yy, xy) {
    return { xx: xx, yy: yy, xy: xy };
  }

  /** Copia defensiva. */
  function clone(s) { return { xx: s.xx, yy: s.yy, xy: s.xy }; }

  /** ¿Es un estado hidrostático plano (R ≈ 0)? */
  function isHydrostatic(s) {
    return Math.hypot((s.xx - s.yy) / 2, s.xy) < EPS * Math.max(1, Math.abs(s.xx), Math.abs(s.yy));
  }

  /** Matriz de Cauchy 2×2 en forma de array de arrays: [[xx,xy],[xy,yy]] */
  function tensor(s) { return [[s.xx, s.xy], [s.xy, s.yy]]; }

  /** Traza y determinante (segundo invariante) del tensor. */
  function invariants(s) {
    return { I1: s.xx + s.yy, I2: s.xx * s.yy - s.xy * s.xy };
  }

  /**
   * Esfuerzos principales resueltos por la ECUACIÓN CARACTERÍSTICA
   *      λ² − I1·λ + I2 = 0
   * mediante la fórmula cuadrática estable. Es una vía de cálculo INDEPENDIENTE
   * de σavg ± R: sirve como contraprueba real en validation.js.
   */
  function principalsFromInvariants(I1, I2) {
    var disc = I1 * I1 - 4 * I2;
    if (disc < 0) disc = 0;                     // round-off sólo; el tensor es simétrico
    var sq = Math.sqrt(disc);
    // Forma numéricamente estable: evita restar magnitudes casi iguales.
    var hi = (0.5 * (I1 + sq));
    var lo = (I2 / hi);
    if (!isFinite(lo) || (hi === 0 && lo === 0)) { hi = 0.5 * (I1 + sq); lo = 0.5 * (I1 - sq); }
    return hi >= lo ? { hi: hi, lo: lo } : { hi: lo, lo: hi };
  }

  // ---------------------------------------------------------------------------
  // Clasificación del estado plano (§16, §11)
  // ---------------------------------------------------------------------------

  function classify(s) {
    var tol = 1e-9 * Math.max(1, Math.abs(s.xx), Math.abs(s.yy), Math.abs(s.xy));
    var pure = Math.abs(s.xy) <= tol;
    var nx = Math.abs(s.xx) > tol, ny = Math.abs(s.yy) > tol;
    if (pure && !nx && !ny) {
      return { key: 'hydrostatic', label: 'Estado nulo', note: 'σx = σy = τxy = 0: el elemento no está sometido a ningún esfuerzo. R = 0 y todas las magnitudes derivadas valen cero.' };
    }
    if (pure && nx && ny && Math.abs(s.xx - s.yy) <= tol) {
      return { key: 'hydrostatic', label: 'Estado hidrostático plano', note: 'σx = σy y sin cortante: el círculo colapsa a un punto (R = 0). No existen direcciones privilegiadas de cortante.' };
    }
    if (pure && (nx !== ny)) {
      return { key: 'uniaxial', label: 'Estado uniaxial', note: 'Un solo esfuerzo normal distintos de cero. Los planos principales coinciden con los ejes x e y.' };
    }
    if (pure) {
      return { key: 'biaxial', label: 'Estado biaxial sin cortante', note: 'Dos esfuerzos normales distintos y sin cortante: los planos principales son paralelos a los ejes.' };
    }
    if (!nx && !ny) {
      return { key: 'shear', label: 'Cortante puro', note: 'Sólo cortante: σavg = 0 y el círculo es simétrico respecto del origen. σ1 y σ2 son de igual magnitud y signos opuestos.' };
    }
    return { key: 'combined', label: 'Estado combinado', note: 'Las tres componentes son distintas de cero: el campo de direcciones principales está girado respecto de los ejes x,y.' };
  }

  // ---------------------------------------------------------------------------
  // Extensión tridimensional (§10)
  // Archivo preparado para σx, σy, σz, τxy, τyz, τxz.  La matemática 3D es
  // correcta y closed-form; el núcleo interactivo sigue siendo el estado plano.
  // ---------------------------------------------------------------------------

  function full3D(s, zz, yz, xz) {
    return { xx: s.xx, yy: s.yy, zz: zz || 0, xy: s.xy, yz: yz || 0, xz: xz || 0 };
  }

  /**
   * Esfuerzos principales de un tensor 3×1 (simétrico) por la solución
   * trigonométrica de la ecuación característica cúbica:
   *      λ³ − I1λ² + I2λ − I3 = 0
   * con p = I2 − I1²/3, q = −2I1³/27 + I1·I2/3 − I3.
   */
  function principal3D(t) {
    var I1 = t.xx + t.yy + t.zz;
    var I2 = t.xx * t.yy + t.yy * t.zz + t.zz * t.xx - (t.xy * t.xy + t.yz * t.yz + t.xz * t.xz);
    var I3 = t.xx * t.yy * t.zz + 2 * t.xy * t.yz * t.xz
           - t.xx * t.yz * t.yz - t.yy * t.xz * t.xz - t.zz * t.xy * t.xy;

    var p = I2 - I1 * I1 / 3;
    var q = -2 * I1 * I1 * I1 / 27 + I1 * I2 / 3 - I3;
    var vals;

    if (Math.abs(p) < 1e-18) {
      // Estado hidrostático: raíz triple.
      var r = -q / 3;
      vals = [r, r, r];
    } else {
      var m = 2 * Math.sqrt(-p / 3);
      var arg = (3 * q) / (2 * p) * Math.sqrt(-3 / p);
      if (arg > 1) arg = 1; else if (arg < -1) arg = -1;   // clamp por round-off
      var phi = Math.acos(arg) / 3;
      vals = [
        m * Math.cos(phi),
        m * Math.cos(phi - 2 * Math.PI / 3),
        m * Math.cos(phi - 4 * Math.PI / 3)
      ].map(function (v) { return v + I1 / 3; });
    }
    vals.sort(function (a, b) { return b - a; });

    /* Un autovalor analíticamente nulo (por ejemplo σ2 = 0 cuando σz = 0 y el
       estado es el del plano) aparece en la solución trigonométrica del cúbico
       como un residuo del orden de 1e-14.  Se limpia con una tolerancia RELATIVA
       al propio estado: no es redondeo para mostrar, es eliminar ruido de punto
       flotante de un valor que es exactamente cero.  Todo lo que se devuelve
       (invariantes, círculos, Tresca, von Mises) se recalcula con los valores
       ya saneados, de modo que el conjunto sigue siendo coherente. */
    var scale3 = Math.max(Math.abs(vals[0]), Math.abs(vals[1]), Math.abs(vals[2]), 1);
    var tol3 = 1e-12 * scale3;
    var s1 = Math.abs(vals[0]) < tol3 ? 0 : vals[0];
    var s2 = Math.abs(vals[1]) < tol3 ? 0 : vals[1];
    var s3 = Math.abs(vals[2]) < tol3 ? 0 : vals[2];

    var d12 = s1 - s2, d23 = s2 - s3, d13 = s1 - s3;
    var sumSq = d12 * d12 + d23 * d23 + d13 * d13;

    return {
      s1: s1, s2: s2, s3: s3,
      I1: s1 + s2 + s3,
      I2: s1 * s2 + s2 * s3 + s3 * s1,
      I3: s1 * s2 * s3,
      J2: sumSq / 6,
      tresca: d13,                                   // σ1 − σ3
      vonMises: Math.sqrt(sumSq / 2),
      octaShear: Math.sqrt(sumSq / 3),               // τ_oct
      circles: [
        { c: 0.5 * (s1 + s2), r: 0.5 * Math.abs(d12), label: 'σ1–σ2', from: s1, to: s2 },
        { c: 0.5 * (s2 + s3), r: 0.5 * Math.abs(d23), label: 'σ2–σ3', from: s2, to: s3 },
        { c: 0.5 * (s1 + s3), r: 0.5 * Math.abs(d13), label: 'σ1–σ3', from: s1, to: s3 }
      ]
    };
  }

  // ---------------------------------------------------------------------------
  // Casos predefinidos (§11). Valores en MPa.
  // ---------------------------------------------------------------------------

  var CASES = [
    {
      id: 'uniaxial-t', n: 1, title: 'Tracción uniaxial', tag: 'σx ≠ 0',
      note: 'Barra traccionada. σ1 = σx, σ2 = 0, τmax = σx/2 a 45°.',
      s: plane(120, 0, 0), theta: 0
    },
    {
      id: 'uniaxial-c', n: 2, title: 'Compresión uniaxial', tag: 'σx < 0',
      note: 'Columna comprimida. Ambos esfuerzos principales son negativos: no aparece tracción en ninguna dirección.',
      s: plane(0, -90, 0), theta: 0
    },
    {
      id: 'shear-puro', n: 3, title: 'Cortante puro', tag: 'σx = σy = 0',
      note: 'Estado de cortante puro: σavg = 0 y el círculo está centrado en el origen.',
      s: plane(0, 0, 60), theta: 0
    },
    {
      id: 'biaxial', n: 4, title: 'Estado biaxial', tag: 'σx ≠ σy, τxy = 0',
      note: 'Dosiaxial sin cortante: los planos principales son paralelos a los ejes.',
      s: plane(140, -35, 0), theta: 0
    },
    {
      id: 'combinado', n: 5, title: 'Estado combinado', tag: 'σx, σy, τxy ≠ 0',
      note: 'Las tres componentes activas: los planos principales están girados respecto de x,y.',
      s: plane(80, -30, 40), theta: 0
    },
    {
      id: 'hidrostatico', n: 6, title: 'Hidrostático plano', tag: 'σx = σy',
      note: 'R = 0: el círculo se reduce a un punto. No hay direcciones principales únicas.',
      s: plane(75, 75, 0), theta: 0
    }
  ];

  /** Normaliza un ángulo en grados al intervalo [0, 180) — el estado es 180°-periódico. */
  function normalizeTheta180(deg) {
    var d = deg % 180;
    if (d < 0) d += 180;
    if (d >= 180) d -= 180;
    return d;
  }

  ML.stress = {
    EPS: EPS,
    plane: plane,
    clone: clone,
    tensor: tensor,
    invariants: invariants,
    principalsFromInvariants: principalsFromInvariants,
    classify: classify,
    isHydrostatic: isHydrostatic,
    full3D: full3D,
    principal3D: principal3D,
    normalizeTheta180: normalizeTheta180,
    CASES: CASES
  };

})(typeof window !== 'undefined'
  ? (window.MohrLab = window.MohrLab || {})
  : (global.MohrLab = global.MohrLab || {}));
