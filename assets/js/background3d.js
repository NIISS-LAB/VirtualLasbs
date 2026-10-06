/* ============================================================================
   VIRTUAL LAB CENTER — fondo 3D
   Paneles holográficos a la deriva + polvo en profundidad, proyectados a mano
   (sin librerías). Movimiento lento y continuo, reacciona al puntero, se pausa
   si la pestaña se oculta y respeta prefers-reduced-motion.
   ========================================================================== */
window.VLC = window.VLC || {};

VLC.background3d = (function () {
  const canvas = document.getElementById('bg3d');
  if (!canvas) return { destroy() {} };

  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return { destroy() {} };

  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mqCoarse = window.matchMedia('(pointer: coarse)');

  let W = 0;
  let H = 0;
  let dpr = 1;
  let pal = null;
  let raf = 0;
  let last = 0;
  let clock = 0;
  let running = false;

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const reduced = () => mqReduce.matches;

  /* ------------------------------------------------------------- paleta -- */
  function rgba(hex, a) {
    const h = (hex || '').replace('#', '').trim();
    if (h.length !== 6) return `rgba(120,190,210,${a})`;
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const get = (v, f) => (cs.getPropertyValue(v) || '').trim() || f;
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    pal = {
      accent: get('--ch-1', dark ? '#38d2e8' : '#0a7286'),
      warm: get('--ch-2', dark ? '#f2a93b' : '#a2620b'),
      ink: get('--ink', dark ? '#e8f1f6' : '#0c1a24'),
      dark: dark,
    };
  }

  /* --------------------------------------------------------- entidades --- */
  // x,y en unidades de pantalla (-0.5 .. 0.5), z en px (negativo = lejos)
  function makeSlabs() {
    return [
      { x: -0.36, y: -0.20, z: -260, w: 210, h: 132, rx: 0.30, ry: 0.52, rz: -0.10, spin: 0.055, bob: 0.10, ph: 0.0, drift: 0.014, col: 0 },
      { x: 0.34, y: 0.22, z: -430, w: 268, h: 168, rx: 0.24, ry: -0.46, rz: 0.07, spin: -0.041, bob: 0.14, ph: 1.7, drift: 0.011, col: 1 },
      { x: 0.30, y: -0.30, z: -120, w: 176, h: 108, rx: 0.44, ry: 0.30, rz: 0.16, spin: 0.068, bob: 0.08, ph: 3.1, drift: 0.019, col: 0 },
      { x: -0.30, y: 0.34, z: -560, w: 320, h: 200, rx: 0.20, ry: 0.68, rz: -0.04, spin: 0.033, bob: 0.16, ph: 4.4, drift: 0.009, col: 1 },
      { x: 0.02, y: 0.44, z: -700, w: 400, h: 240, rx: 0.14, ry: 0.10, rz: 0.00, spin: 0.022, bob: 0.12, ph: 2.2, drift: 0.006, col: 0 },
      { x: -0.48, y: 0.06, z: -660, w: 240, h: 260, rx: 0.52, ry: -0.24, rz: 0.22, spin: -0.048, bob: 0.18, ph: 5.3, drift: 0.017, col: 1 },
    ];
  }

  function makeDust(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        x: Math.random() - 0.5,
        y: Math.random() - 0.5,
        z: -760 + Math.random() * 940,
        s: 0.7 + Math.random() * 2.1,
        vx: (Math.random() - 0.5) * 0.006,
        vy: -0.004 - Math.random() * 0.010,
        warm: Math.random() < 0.22,
        ph: Math.random() * 6.28,
      });
    }
    return out;
  }

  let slabs = makeSlabs();
  let dust = makeDust(mqCoarse.matches ? 70 : 150);

  /* ------------------------------------------------------------ helpers -- */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const FOCAL = 1150;
  function project(x, y, z) {
    const s = FOCAL / (FOCAL + z);
    return [W * 0.5 + (x * W + pointer.x * (0.6 - z / 2600)) * s, H * 0.5 + (y * H + pointer.y * (0.6 - z / 2600)) * s, s];
  }

  function rotate(p, rx, ry, rz) {
    let [x, y, z] = p;
    let c = Math.cos(ry), s = Math.sin(ry);
    [x, z] = [x * c - z * s, x * s + z * c];
    c = Math.cos(rx); s = Math.sin(rx);
    [y, z] = [y * c - z * s, y * s + z * c];
    c = Math.cos(rz); s = Math.sin(rz);
    [x, y] = [x * c - y * s, x * s + y * c];
    return [x, y, z];
  }

  function quad(sl) {
    const b = Math.sin(clock * sl.bob + sl.ph) * 16;
    const cx = sl.x + Math.sin(clock * sl.drift * 3.1 + sl.ph) * 0.03;
    const ry = sl.ry + clock * sl.spin;
    const rx = sl.rx + Math.sin(clock * 0.21 + sl.ph) * 0.09;
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
      const [x, y] = rotate([sx * sl.w, sy * sl.h + b, 0], rx, ry, sl.rz);
      return project(cx * W + x, y + sl.y * H, sl.z);
    });
    return pts;
  }

  /* ------------------------------------------------------------- dibujo -- */
  function drawPanel(sl) {
    const p = quad(sl);
    const base = sl.col === 1 ? pal.warm : pal.accent;
    const [p0, p1, p2, p3] = p;

    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();

    const g = ctx.createLinearGradient(p0[0], p0[1], p2[0], p2[1]);
    g.addColorStop(0, rgba(base, pal.dark ? 0.10 : 0.07));
    g.addColorStop(0.55, rgba(pal.ink, pal.dark ? 0.018 : 0.012));
    g.addColorStop(1, rgba(base, pal.dark ? 0.045 : 0.03));
    ctx.fillStyle = g;
    ctx.fill();

    ctx.strokeStyle = rgba(base, pal.dark ? 0.3 : 0.24);
    ctx.lineWidth = 1;
    ctx.stroke();

    // trazas internas: el panel se lee como un instrumento
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.clip();

    ctx.strokeStyle = rgba(pal.ink, pal.dark ? 0.07 : 0.05);
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      ctx.beginPath();
      ctx.moveTo(p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t);
      ctx.lineTo(p3[0] + (p2[0] - p3[0]) * t, p3[1] + (p2[1] - p3[1]) * t);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p0[0] + (p3[0] - p0[0]) * t, p0[1] + (p3[1] - p0[1]) * t);
      ctx.lineTo(p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t);
      ctx.stroke();
    }

    // barra de señal dentro del panel
    const sy = 0.56;
    ctx.beginPath();
    for (let i = 0; i <= 34; i++) {
      const t = i / 34;
      const ax = p0[0] + (p1[0] - p0[0]) * t;
      const ay = p0[1] + (p1[1] - p0[1]) * t;
      const bx = p3[0] + (p2[0] - p3[0]) * t;
      const by = p3[1] + (p2[1] - p3[1]) * t;
      const wave = Math.sin(t * 11 + clock * 1.6 + sl.ph) * 0.06 + Math.sin(t * 27 - clock * 0.9) * 0.02;
      const x = ax + (bx - ax) * sy;
      const y = ay + (by - ay) * sy + wave * Math.abs(by - ay);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = rgba(base, pal.dark ? 0.5 : 0.42);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // esquina viva
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p1[0] + (p2[0] - p1[0]) * 0.22, p1[1] + (p2[1] - p1[1]) * 0.22);
    ctx.strokeStyle = rgba(base, pal.dark ? 0.85 : 0.7);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  function drawDust() {
    for (const d of dust) {
      d.x += d.vx * 0.016;
      d.y += d.vy * 0.016;
      if (d.y < -0.58) {
        d.y = 0.58;
        d.x = Math.random() - 0.5;
      }
      if (d.x > 0.6) d.x = -0.6;
      if (d.x < -0.6) d.x = 0.6;
      const tw = 0.65 + 0.35 * Math.sin(clock * 1.1 + d.ph);
      const [x, y, s] = project(d.x, d.y, d.z);
      ctx.fillStyle = rgba(d.warm ? pal.warm : pal.accent, (0.1 + 0.24 * (1 - (d.z + 760) / 940)) * tw);
      const size = d.s * s * 1.7;
      ctx.fillRect(x, y, size, size);
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(now - last, 60) : 16;
    last = now;
    clock += dt / 1000;

    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;

    ctx.clearRect(0, 0, W, H);
    drawDust();
    const order = slabs.slice().sort((a, b) => a.z - b.z);
    for (const sl of order) drawPanel(sl);

    if (!running) {
      running = true;
      show();
    }
  }

  function drawStill() {
    ctx.clearRect(0, 0, W, H);
    drawDust();
    for (const sl of slabs.slice().sort((a, b) => a.z - b.z)) drawPanel(sl);
    show();
  }

  /** la opacidad también se fija en línea: si el navegador no anima, el fondo se ve igual */
  function show() {
    canvas.classList.add('is-live');
    canvas.style.opacity = '0.82';
  }

  function start() {
    if (raf || reduced()) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ------------------------------------------------------------- eventos - */
  let rt = 0;
  window.addEventListener(
    'resize',
    () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        resize();
        if (reduced()) drawStill();
      }, 140);
    },
    { passive: true }
  );

  window.addEventListener(
    'pointermove',
    (e) => {
      if (mqCoarse.matches) return;
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * -34;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * -26;
    },
    { passive: true }
  );

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  const mo = new MutationObserver(() => {
    readPalette();
    if (reduced()) drawStill();
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  if (mqReduce.addEventListener) {
    mqReduce.addEventListener('change', () => {
      if (reduced()) {
        stop();
        drawStill();
      } else start();
    });
  }

  readPalette();
  resize();
  if (reduced()) drawStill();
  else start();

  // red de seguridad: si el navegador no concede el primer fotograma
  // (pestaña oculta, ahorro de energía), se dibuja un fotograma fijo.
  setTimeout(function () {
    if (!running) drawStill();
  }, 1400);

  return {
    destroy() {
      stop();
      mo.disconnect();
    },
  };
})();
