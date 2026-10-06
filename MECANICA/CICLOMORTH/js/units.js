/* =============================================================================
 * MOHR LAB — units.js
 * Sistema de unidades, conversión y formato numérico.
 *
 * UNIDAD CANÓNICA DEL MODELO: MPa (megapascal).
 * Toda la matemática interna (js/stress.js, js/mohr.js, js/transformations.js)
 * trabaja en MPa. La conversión ocurre únicamente en la frontera de la interfaz.
 *
 * Factor de conversión  toBase:  1 [unidad de usuario]  ->  N [MPa]
 *   MPa : 1
 *   kPa : 1e-3
 *   Pa  : 1e-6
 *   ksi : 6.894757293168361
 *   psi : 6.894757293168361e-3
 * ========================================================================== */
(function (ML) {
  'use strict';

  var UNITS = [
    { id: 'MPa', label: 'MPa', toBase: 1,                    span: 300,    step: 1,    defDec: 2, note: 'megapascal · 1 MPa = 1 N/mm²' },
    { id: 'kPa', label: 'kPa', toBase: 1e-3,                 span: 3e5,    step: 1e3,  defDec: 2, note: 'kilopascal' },
    { id: 'Pa',  label: 'Pa',  toBase: 1e-6,                 span: 3e8,    step: 1e6,  defDec: 1, note: 'pascal · unidad SI' },
    { id: 'ksi', label: 'ksi', toBase: 6.894757293168361,    span: 40,     step: 0.1,  defDec: 3, note: 'kip/pulg²' },
    { id: 'psi', label: 'psi', toBase: 6.894757293168361e-3, span: 6000,   step: 10,   defDec: 2, note: 'libra-fuerza/pulg²' }
  ];

  var BY_ID = {};
  UNITS.forEach(function (u) { BY_ID[u.id] = u; });

  var DEFAULTS = { unit: 'MPa', decimals: 3 };

  function get(id) { return BY_ID[id] || BY_ID.MPa; }

  /** Convierte un valor expresado en la unidad `from` a la unidad `to`. */
  function convert(value, from, to) {
    var a = get(from), b = get(to);
    return (value * a.toBase) / b.toBase;
  }

  /** Convierte de la unidad de usuario a la unidad canónica (MPa). */
  function toBase(value, from) { return value * get(from).toBase; }
  /** Convierte de la unidad canónica (MPa) a la unidad de usuario. */
  function fromBase(value, to) { return value / get(to).toBase; }

  /** Rango simétrico del deslizador para la unidad indicada. */
  function span(id) { return get(id).span; }

  // ---------------------------------------------------------------------------
  // Formato
  // ---------------------------------------------------------------------------

  var cfg = { decimals: DEFAULTS.decimals };

  function setDecimals(d) { cfg.decimals = Math.max(0, Math.min(8, d | 0)); }
  function decimals() { return cfg.decimals; }

  /** Elimina el "-0" espurio que aparece al redondear valores negativos pequeños. */
  function fixZero(v, d) {
    var r = round(v, d);
    return (r === 0) ? 0 : r;
  }

  function round(v, d) {
    var p = Math.pow(10, d);
    // Math.round es inconsistente con negativos en .5 (redondea hacia +∞).
    // Se usa redondeo simétrico ("half away from zero") para coherencia visual.
    var s = v < 0 ? -1 : 1;
    return s * Math.round(Math.abs(v) * p + Number.EPSILON * Math.abs(v)) / p;
  }

  /**
   * Notación compacta para ejes y valores muy grandes: 2.345×10⁸
   * Usa trim() porque en una retícula los ceros finales no aportan información.
   */
  var SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

  function superscript(n) {
    return String(n).split('').map(function (c) { return SUP[c] !== undefined ? SUP[c] : c; }).join('');
  }

  /**
   * Formato numérico para ejes: decimales adaptados al paso de la retícula y
   * multiplicador ×10ⁿ cuando el orden de magnitud es extremo.
   */
  function axisValue(v, step) {
    if (step === undefined || step === null) return trim(v, cfg.decimals);
    var e = Math.floor(Math.log10(Math.abs(step)) + 1e-9);
    if (e >= 5 || e <= -4) {
      var man = v / Math.pow(10, e);
      return trim(man, 2) + '×10' + superscript(e);
    }
    var d = Math.max(0, Math.min(4, 2 - e));
    return trim(v, d);
  }

  /**
   * RECORTA los ceros finales.  Se usa en la retícula y en los campos de
   * entrada, donde "80" es tan exacto como "80.000" y ocupa menos.
   */
  function trim(v, d) {
    var s = v.toFixed(d);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0') s = '0';
    return s;
  }

  /**
   * Formato de lectura: CONSERVA los ceros finales.
   * En un laboratorio de ingeniería el número de decimales es información:
   * "80.000" y "80" no son la misma precisión comunicada.  Por eso las lecturas
   * fijan siempre el número de decimales configurado y la retícula usa trim().
   */
  function decimal(v, d) {
    if (!isFinite(v)) return '—';
    d = (d === undefined) ? cfg.decimals : d;
    var s = fixZero(v, d).toFixed(d);
    if (s === '-0' || s === '-' + (0).toFixed(d)) s = (0).toFixed(d);
    return s;
  }

  /**
   * Notación compacta para lecturas cuyo orden de magnitud hinders la lectura.
   * Regla: NUNCA se muestra "0.000" para un valor distinto de cero — si la forma
   * de punto fijo redondearía a cero, o si el número tiene demasiados dígitos,
   * se pasa a  m×10ⁿ  conservando el número de decimales sobre la mantisa, de
   * modo que la precisión comunicada no cambia al cambiar de notación.
   */
  function compact(v, d) {
    if (!isFinite(v) || v === 0) return decimal(v, d);
    d = (d === undefined) ? cfg.decimals : d;
    var av = Math.abs(v);
    var e = Math.floor(Math.log10(av) + 1e-9);
    if (e >= 6 || av < 0.5 * Math.pow(10, -d)) {
      return trim(v / Math.pow(10, e), d) + '×10' + superscript(e);
    }
    return decimal(v, d);
  }

  /** Número con signo explícito (uso en tablas comparativas y ecuaciones). */
  function signed(v, d) {
    if (!isFinite(v)) return '—';
    var t = decimal(v, d);
    return (t.charAt(0) === '-' ? '' : '+') + t;
  }

  /** Ángulo en grados con sufijo. */
  function angle(deg, d) { return decimal(deg, d === undefined ? cfg.decimals : d) + '°'; }

  /** Valor de esfuerzo ya convertido a la unidad activa. */
  function stressDisplay(valueMPa, d) {
    return compact(fromBase(valueMPa, cfg.unit), d);
  }

  /** Valor de esfuerzo con la unidad activa. */
  function stress(valueMPa, d, withUnit) {
    var n = stressDisplay(valueMPa, d);
    return (withUnit === false) ? n : n + ' ' + cfg.unit;
  }

  return (ML.format = {
    UNITS: UNITS,
    DEFAULTS: DEFAULTS,
    get: get,
    convert: convert,
    toBase: toBase,
    fromBase: fromBase,
    span: span,
    setDecimals: setDecimals,
    decimals: decimals,
    get unit() { return cfg.unit; },
    set unit(v) { if (BY_ID[v]) cfg.unit = v; },
    round: round,
    fixZero: fixZero,
    trim: trim,
    decimal: decimal,
    compact: compact,
    signed: signed,
    angle: angle,
    axisValue: axisValue,
    stress: stress,
    stressDisplay: stressDisplay
  });

})(typeof window !== 'undefined'
  ? (window.MohrLab = window.MohrLab || {})
  : (global.MohrLab = global.MohrLab || {}));
