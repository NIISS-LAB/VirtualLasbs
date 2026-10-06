/* =============================================================================
 * MOHR LAB — influence.js
 * ANÁLISIS DE INFLUENCIA DE VARIABLES (§16)
 *
 * No se limita a mostrar el resultado: expone la DERIVADA ANALÍTICA de cada
 * magnitud respecto de la variable elegida.  De este modo la explicación es
 * general y correcta para cualquier signo, y no una descripción improvisada.
 * ========================================================================== */
(function (ML) {
  'use strict';

  var DEG = 180 / Math.PI;

  var VARIABLES = [
    { id: 'sx',   key: 'xx', label: 'σx',  full: 'σx',  kind: 'stress' },
    { id: 'sy',   key: 'yy', label: 'σy',  full: 'σy',  kind: 'stress' },
    { id: 'txy',  key: 'xy', label: 'τxy', full: 'τxy', kind: 'stress' },
    { id: 'theta', key: 'th', label: 'θ',   full: 'θ',   kind: 'angle'  }
  ];

  /**
   * Derivadas analíticas de las magnitudes del círculo respecto de una variable.
   *   A = (σx−σy)/2 ,  B = τxy ,  R = √(A²+B²) ,  θp = ½·atan2(B, A)
   *   ∂σavg/∂σx = ∂σavg/∂σy = 1/2
   *   ∂R/∂σx = A/(2R)   ∂R/∂σy = −A/(2R)   ∂R/∂τ = B/R
   *   ∂θp/∂σx = −B/(4R²)  ∂θp/∂σy = B/(4R²)  ∂θp/∂τ = A/(2R²)
   * Los ángulos se devuelven en RADIANES por unidad; se convierten al presentar.
   */
  function derivatives(st, v) {
    var A = 0.5 * (st.xx - st.yy), B = st.xy, R = Math.hypot(A, B);
    var safe = R > 1e-12 ? R : 1e-12;
    var d = { avg: 0, R: 0, s1: 0, s2: 0, tauMax: 0, thp: 0, ths: 0, sigma: 0, tau: 0 };
    if (v === 'theta') {
      d.sigma = NaN; d.tau = NaN;         // dependen del ángulo en curso
      return d;
    }
    if (v === 'sx')  { d.avg = 0.5; d.R =  A / (2 * safe); d.thp = -B / (4 * safe * safe); }
    if (v === 'sy')  { d.avg = 0.5; d.R = -A / (2 * safe); d.thp =  B / (4 * safe * safe); }
    if (v === 'txy') { d.avg = 0;   d.R =  B / safe;        d.thp =  A / (2 * safe * safe); }
    d.s1 = d.avg + d.R;
    d.s2 = d.avg - d.R;
    d.tauMax = d.R;
    d.ths = d.thp;                        // θs = θp + 45° ⇒ misma derivada
    return d;
  }

  /** Magnitudes que se comparan en la tabla. */
  function magnitudes(st, th) {
    var c = ML.mohr.circle(st), tr = ML.tf.transform(st, th);
    return {
      avg: c.avg, R: c.R, s1: c.s1, s2: c.s2, tauMax: c.tauMax,
      thp: c.hydro ? 0 : ML.tf.principalAngle(st).thetaPdeg,
      ths: c.hydro ? 0 : ML.tf.principalAngle(st).thetaSdeg,
      sigma: tr.sigma, tau: tr.tau
    };
  }

  var META = {
    avg:    { label: 'σavg',  tex: 'σ_avg = (σx+σy)/2',        kind: 'stress' },
    R:      { label: 'R',     tex: 'R = √(((σx−σy)/2)² + τxy²)', kind: 'stress' },
    s1:     { label: 'σ1',    tex: 'σ1 = σavg + R',            kind: 'stress' },
    s2:     { label: 'σ2',    tex: 'σ2 = σavg − R',            kind: 'stress' },
    tauMax: { label: 'τmax',  tex: 'τmax = R',                 kind: 'stress' },
    thp:    { label: 'θp',    tex: 'θp = ½·atan2(τxy, (σx−σy)/2)', kind: 'angle' },
    ths:    { label: 'θs',    tex: 'θs = θp + 45°',            kind: 'angle' },
    sigma:  { label: 'σθ',    tex: 'σθ(θ)',                    kind: 'stress' },
    tau:    { label: 'τθ',    tex: 'τθ(θ)',                    kind: 'stress' }
  };

  /** Filas de la tabla de sensibilidad, ya calculadas para la variable elegida. */
  function rows(st, v) {
    var d = derivatives(st, v);
    var list = v === 'theta' ? ['sigma', 'tau'] : ['avg', 'R', 's1', 's2', 'tauMax', 'thp', 'ths'];
    return list.map(function (k) {
      var m = META[k];
      return { key: k, label: m.label, tex: m.tex, kind: m.kind, deriv: d[k] };
    });
  }

  /** Sonda: aplica ±Δ y devuelve el antes/después de todas las magnitudes. */
  function probe(st, th, v, delta) {
    var before = magnitudes(st, th);
    var st2 = ML.stress.clone(st), th2 = th;
    if (v === 'theta') th2 = ML.mohr.normalize(th + delta / DEG);
    else if (v === 'sx') st2.xx = st.xx + delta;
    else if (v === 'sy') st2.yy = st.yy + delta;
    else if (v === 'txy') st2.xy = st.xy + delta;
    var after = magnitudes(st2, th2);
    var keys = Object.keys(before);
    var changes = keys.map(function (k) {
      var b = before[k], a = after[k];
      var dd = a - b;
      var scale = Math.max(Math.abs(a), Math.abs(b), 1e-12);
      var rel = dd / scale;
      var dir = Math.abs(rel) < 1e-10 ? 0 : (dd > 0 ? 1 : -1);
      return { key: k, label: META[k].label, kind: META[k].kind, before: b, after: a, delta: dd, dir: dir };
    });
    return { before: before, after: after, changes: changes, st2: st2, th2: th2,
             sign: delta >= 0 ? 1 : -1, delta: delta, variable: v };
  }

  /** Magnitudes que el usuario está mirando en las tres vistas. */
  function targets(pr) {
    return [
      { id: 'centro', label: 'Centro C', hint: 'σavg',        key: 'avg' },
      { id: 'radio',  label: 'Radio R',  hint: 'τmax = R',    key: 'R' },
      { id: 's1',     label: 'σ1',       hint: 'σavg + R',    key: 's1' },
      { id: 's2',     label: 'σ2',       hint: 'σavg − R',    key: 's2' },
      { id: 'taumax', label: 'τmax',     hint: 'máximo cortante', key: 'tauMax' },
      { id: 'thp',    label: 'θp',       hint: 'plano principal',  key: 'thp' },
      { id: 'p',      label: 'Punto P',  hint: 'posición en el círculo', key: 'sigma' }
    ];
  }

  // ---------------------------------------------------------------------------
  // Lectura física: texto general, correcto para cualquier signo de las variables
  // ---------------------------------------------------------------------------

  var PHYSICS = {
    sx: [
      '<b>El centro.</b> σavg = (σx+σy)/2, luego ∂σavg/∂σx = 1/2: al aumentar σx el círculo se desplaza hacia la derecha <em>sin deformarse</em>.',
      '<b>El radio.</b> R depende del contraste entre las dos normales: ∂R/∂σx = (σx−σy)/(4R). El radio <em>aumenta si σx &gt; σy y disminuye si σx &lt; σy</em>; si σx = σy el centro se mueve y el radio no cambia.',
      '<b>Los esfuerzos principales.</b> σ1 = σavg+R y σ2 = σavg−R. Si σx crece más que σy, ambos suben y además se separan, porque σ1−σ2 = 2R.',
      '<b>La orientación principal.</b> ∂θp/∂σx = −τxy/(4R²). Con τxy &gt; 0 el plano principal gira en sentido <em>horario</em>; con τxy &lt; 0 en sentido <em>antihorario</em>; con τxy = 0 no se mueve, porque los planos principales ya son paralelos a los ejes.',
      '<b>En el elemento.</b> Sólo crece la flecha normal de las caras ±x: la ruptura de la simetría respecto de σavg es exactamente lo que ensancha la circunferencia.'
    ],
    sy: [
      '<b>El centro.</b> σavg = (σx+σy)/2, luego ∂σavg/∂σy = 1/2: σy tiene el mismo peso que σx en la posición del círculo.',
      '<b>El radio.</b> ∂R/∂σy = −(σx−σy)/(4R), de signo opuesto al de σx: <em>el radio aumenta si σy &gt; σx y disminuye si σy &lt; σx</em>.',
      '<b>Los esfuerzos principales.</b> Si σy se acerca a σx, R disminuye y los dos esfuerzos principales convergen; en el límite σx = σy el círculo se reduce a un punto.',
      '<b>La orientación principal.</b> ∂θp/∂σy = τxy/(4R²), de signo opuesto al de σx: con el mismo cortante, el giro se invierte porque σy actúa en el sentido contrario del Triedro.', 
      '<b>En el elemento.</b> Sólo crece la flecha normal de las caras ±y; la paridad de σx y σy respecto de σavg determina si el círculo se abre o se cierra.'
    ],
    txy: [
      '<b>El centro no se mueve.</b> σavg = (σx+σy)/2 no contiene τxy: el cortante puro es un estado centrado en el origen.',
      '<b>El radio.</b> ∂R/∂τxy = τxy/R, siempre del mismo signo que τxy. Por eso τmax = R crece estrictamente con el <em>módulo</em> del cortante y R = 0 cuando τxy = 0 y σx = σy.',
      '<b>Los esfuerzos principales.</b> σ1 y σ2 se separan simétricamente respecto de σavg: en el Triedro (σx, τxy) el cortante actúa como el otro cateto de R.',
      '<b>La orientación principal.</b> ∂θp/∂τxy = (σx−σy)/(4R²): es la influencia más fuerte de todas, sobre todo cuando el contraste normal es fuerte y el cortante pequeño. Por eso una pequeña perturbación de τxy puede girar mucho los planos principales.',
      '<b>En el círculo.</b> El punto A = (σx, τxy) se desplaza verticalmente mientras C y la forma de la circunferencia permanecen; el ángulo 2θp se abre desde el eje σ.'
    ],
    theta: [
      '<b>El círculo es inmutable.</b> σavg, R, σ1, σ2 y τmax no contienen θ. Girar el elemento <em>no cambia el estado tensional</em>: sólo cambia qué caras del elemento se están observando. Ésta es la idea central del círculo de Mohr.',
      '<b>Lo único que se mueve es P</b>, que recorre la circunferencia con un ángulo 2θ en sentido horario, y su antípoda en la cara perpendicular.',
      '<b>En la gráfica.</b> dσθ/dθ = −(σx−σy)·sen2θ + 2τxy·cos2θ y dτθ/dθ = −(σx−σy)·cos2θ − 2τxy·sen2θ (por radiante). En los planos principales dσθ/dθ = 0 y en los de máximo cortante dτθ/dθ = 0.',
      '<b>Periodicidad.</b> El estado es 180°-periódico: el elemento vuelve a su posición y P al mismo punto de la circunferencia.'
    ]
  };

  ML.influence = {
    VARIABLES: VARIABLES,
    META: META,
    derivatives: derivatives,
    magnitudes: magnitudes,
    rows: rows,
    probe: probe,
    targets: targets,
    PHYSICS: PHYSICS
  };

})(typeof window !== 'undefined'
  ? (window.MohrLab = window.MohrLab || {})
  : (global.MohrLab = global.MohrLab || {}));
