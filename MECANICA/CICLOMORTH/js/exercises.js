/* =============================================================================
 * MOHR LAB — exercises.js
 * Modo estudiante (§18) y generador de ejercicios (§19)
 *
 * El enunciado se construye con valores aleatorios técnicamente razonables y
 * se evitan las degeneraciones que producirían respuestas ambiguas:
 *   · R = 0 o casi 0 (estado hidrostático: no hay dirección principal única)
 *   · 2τxy y (σx−σy) simultáneamente muy pequeños (θp numéricamente inestable)
 *   · estados con los tres componentes casi nulos
 * ========================================================================== */
(function (ML) {
  'use strict';

  var DEG = 180 / Math.PI;

  var LEVELS = {
    basico: {
      name: 'Básico',
      note: 'Estados sin cortante y de una sola componente dominante. Se pide la construcción del círculo y las orientaciones.',
      range: [20, 130], tauChance: 0, sameSign: true,
      ask: ['avg', 'R', 's1', 's2', 'tauMax', 'thp']
    },
    intermedio: {
      name: 'Intermedio',
      note: 'Aparece el cortante y la mezcla de signos. Se añaden los esfuerzos en un plano girado.',
      range: [20, 160], tauChance: 0.5, sameSign: false,
      ask: ['avg', 'R', 's1', 's2', 'tauMax', 'thp', 'ths', 'sigma', 'tau']
    },
    avanzado: {
      name: 'Avanzado',
      note: 'Magnitudes grandes y estados generales. Se pide además el punto P y su antípoda.',
      range: [50, 260], tauChance: 0.85, sameSign: false,
      ask: ['avg', 'R', 's1', 's2', 'tauMax', 'thp', 'ths', 'sigma', 'tau', 'pSigma', 'pTau']
    },
    ingenieria: {
      name: 'Ingeniería',
      note: 'Nivel de cálculo estructural: se añaden los criterios de fallo de Tresca y von Mises suponiendo σz = 0.',
      range: [80, 400], tauChance: 0.9, sameSign: false,
      ask: ['avg', 'R', 's1', 's2', 'tauMax', 'thp', 'ths', 'sigma', 'tau', 'pSigma', 'pTau', 'tresca', 'vonMises']
    }
  };

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rndSign() { return Math.random() < 0.5 ? -1 : 1; }
  function quantize(v, q) { return Math.round(v / q) * q; }

  /**
   * Genera un estado técnicamente razonable para el nivel indicado.
   * @returns {{xx,yy,xy,theta}}
   */
  function randomState(level) {
    var L = LEVELS[level] || LEVELS.intermedio;
    var attempt = 0, st;
    do {
      attempt++;
      var mag = L.range[1];
      var xx = quantize(rndSign() * rnd(L.range[0], mag), 5);
      var yy = quantize(rndSign() * rnd(L.range[0], mag * 0.9), 5);
      if (L.sameSign) yy = Math.abs(yy) * (Math.abs(xx) < 1 ? 1 : (xx > 0 ? 1 : -1));
      // Evita que σx y σy coincidan: produciría un θp trivial
      if (Math.abs(xx - yy) < 5) yy = yy >= 0 ? yy + 10 : yy - 10;
      var xy = 0;
      if (Math.random() < L.tauChance) xy = quantize(rndSign() * rnd(10, mag * 0.7), 5);
      st = ML.stress.plane(xx, yy, xy);
    } while (attempt < 200 && degenerate(st));
    st.theta = quantize(rnd(5, 175), 1);
    return st;
  }

  /** Rechaza estados hidrostáticos, casi nulos o con θp numéricamente inestable. */
  function degenerate(st) {
    var A = 0.5 * (st.xx - st.yy), B = st.xy;
    var R = Math.hypot(A, B);
    var scale = Math.max(Math.abs(st.xx), Math.abs(st.yy), Math.abs(st.xy));
    if (scale < 20) return true;                                  // estado trivialmente pequeño
    if (R < 0.06 * scale) return true;                            // casi hidrostático
    if (R < 5) return true;                                       // radio despreciable
    if (Math.abs(A) < 1 && Math.abs(B) < 1) return true;
    return false;
  }

  function questionsFor(level, st, theta) {
    var L = LEVELS[level] || LEVELS.intermedio;
    var c = ML.mohr.circle(st), tr = ML.tf.transform(st, theta), pa = ML.tf.principalAngle(st);
    var p3 = ML.stress.principal3D(ML.stress.full3D(st, 0));
    var ans = {
      avg: c.avg, R: c.R, s1: c.s1, s2: c.s2, tauMax: c.tauMax,
      thp: pa.thetaPdeg, ths: pa.thetaSdeg, sigma: tr.sigma, tau: tr.tau,
      pSigma: tr.sigma, pTau: tr.tau, tresca: p3.tresca, vonMises: p3.vonMises
    };
    var META = {
      avg:      { t: 'σavg',  u: 'stress', why: 'Centro de la circunferencia: la semisuma de las normales.' },
      R:        { t: 'R',     u: 'stress', why: 'Cateto (σx−σy)/2 y cateto τxy forman el Triedro de Gauss; R es su hipotenusa.' },
      s1:       { t: 'σ1',    u: 'stress', why: 'σavg + R: el extremo derecho del círculo sobre el eje σ.' },
      s2:       { t: 'σ2',    u: 'stress', why: 'σavg − R: el extremo izquierdo del círculo.' },
      tauMax:   { t: 'τmax',  u: 'stress', why: 'El radio R es el mayor cortante posible en el plano, a 45° de los principales.' },
      thp:      { t: 'θp',    u: 'angle',  why: 'Medido desde +x hasta la normal del plano de σ1, en [0°,180°).' },
      ths:      { t: 'θs',    u: 'angle',  why: 'Orientación del plano de máximo cortante: θp + 45°.' },
      sigma:    { t: 'σθ',    u: 'stress', why: 'Esfuerzo normal en el plano orientado θ (el que pide el enunciado).' },
      tau:      { t: 'τθ',    u: 'stress', why: 'Cortante en ese mismo plano θ.' },
      pSigma:   { t: 'σ de P', u: 'stress', why: 'Abscisa del punto P en el círculo: es σθ.' },
      pTau:     { t: 'τ de P', u: 'stress', why: 'Ordenada del punto P en el círculo: es τθ.' },
      tresca:   { t: 'Tresca', u: 'stress', why: 'Máxima diferencia de esfuerzos principales: σ1 − σ3 con σz = 0.' },
      vonMises: { t: 'von Mises', u: 'stress', why: '√(((σ1−σ2)²+(σ2−σ3)²+(σ3−σ1)²)/2) con σz = 0.' }
    };
    return L.ask.map(function (k) {
      var m = META[k];
      return {
        id: k, label: m.t, why: m.why,
        kind: m.u, answer: ans[k],
        tol: m.u === 'angle' ? 0.25 : Math.max(Math.abs(ans[k]) * 0.005, 0.02),
        // τ de P coincide con τθ: se pide sólo en los niveles que ya lo incluyen
        dup: (k === 'pSigma' || k === 'pTau') ? (L.ask.indexOf('sigma') >= 0 || L.ask.indexOf('tau') >= 0) : false
      };
    }).filter(function (q) { return !q.dup; });
  }

  /** Crea un ejercicio completo. */
  function generate(level) {
    var st = randomState(level);
    var theta = st.theta;
    var qs = questionsFor(level, st, theta);
    return {
      level: level,
      levelName: LEVELS[level].name,
      note: LEVELS[level].note,
      st: ML.stress.clone(st),
      theta: theta,
      questions: qs
    };
  }

  /** Comprueba las respuestas introducidas. Tolerancia por magnitud relativa. */
  function check(ex, answers) {
    var results = ex.questions.map(function (q) {
      var raw = answers[q.id];
      var given = (raw === undefined || raw === null || String(raw).trim() === '') ? null : Number(raw);
      var blank = given === null || !isFinite(given);
      var ok = !blank && Math.abs(given - q.answer) <= q.tol;
      return { id: q.id, label: q.label, kind: q.kind, given: given, answer: q.answer,
               tol: q.tol, ok: ok, blank: blank, why: q.why };
    });
    var answered = results.filter(function (r) { return !r.blank; });
    var correct = results.filter(function (r) { return r.ok; });
    return {
      results: results,
      answered: answered.length,
      total: results.length,
      correct: correct.length,
      score: results.length ? correct.length / results.length : 0,
      complete: answered.length === results.length
    };
  }

  /** Pista didáctica para una pregunta, sin revelar la respuesta. */
  function hint(ex, id) {
    var st = ex.st;
    var A = 0.5 * (st.xx - st.yy), B = st.xy;
    switch (id) {
      case 'avg': return 'Suma σx y σy y divide entre dos. No interviene τxy: el cortante no desplaza el centro.';
      case 'R': return 'Calcula ((σx−σy)/2) y τxy, y aplica Pitágoras: R = √(' + A.toFixed(2) + '² + ' + B.toFixed(2) + '²).';
      case 's1': return 'Suma σavg + R.';
      case 's2': return 'Resta σavg − R.';
      case 'tauMax': return 'El esfuerzo cortante máximo en el plano coincide con el radio de la circunferencia.';
      case 'thp': return 'Usa atan2(τxy, (σx−σy)/2) y divide el resultado entre 2. atan2 da el cuadrante correcto; el ángulo final va de 0° a 180°.';
      case 'ths': return 'El plano de máximo cortante está a 45° del plano principal: θs = θp + 45°. Si se sale de [0°,180°), réstale 180°.';
      case 'sigma': return 'Sustituye en σθ = σavg + ((σx−σy)/2)·cos2θ + τxy·sen2θ, con 2θ = ' + (2 * ex.theta).toFixed(1) + '°.';
      case 'tau': return 'Sustituye en τθ = −((σx−σy)/2)·sen2θ + τxy·cos2θ, con 2θ = ' + (2 * ex.theta).toFixed(1) + '°.';
      case 'pSigma': return 'Las coordenadas de P en el círculo son exactamente (σθ, τθ).';
      case 'pTau': return 'Las coordenadas de P en el círculo son exactamente (σθ, τθ).';
      case 'tresca': return 'Con σz = 0, σ3 es el menor de {σ1, σ2, 0}. Tresca = σ1 − σ3.';
      case 'vonMises': return 'Ordena {σ1, σ2, 0} de mayor a menor y aplica la fórmula de la raíz de la suma de cuadrados de las diferencias.';
      default: return '';
    }
  }

  ML.exercises = {
    LEVELS: LEVELS,
    randomState: randomState,
    generate: generate,
    questionsFor: questionsFor,
    check: check,
    hint: hint
  };

})(typeof window !== 'undefined'
  ? (window.MohrLab = window.MohrLab || {})
  : (global.MohrLab = global.MohrLab || {}));
