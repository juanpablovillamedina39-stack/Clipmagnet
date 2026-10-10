/* =========================================================================
   CLIPMAGNET · campo magnético del hero
   Un núcleo dorado de puntos con sus líneas de campo, y piezas (cubos,
   triángulos, esferas, como las del logo) que el panel atrae como un imán.
   La fuerza del imán sigue el estado de la herramienta:
   reposo → buscando → descargando (según el progreso) → listo.
   ========================================================================= */
(function () {
  const canvas = document.getElementById("field");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  const hero = canvas.parentElement;
  const target = document.getElementById("magnet-target");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const GOLD = [255, 196, 20];
  let W = 0, H = 0, DPR = 1;
  let core = { x: 0, y: 0, r: 300 };
  let coreTarget = { x: 0, y: 0, r: 300 };
  let magnet = { x: 0, y: 0, w: 600, h: 120 };
  let mode = "idle"; // idle | seeking | pulling | done
  let pull = 0.25, pullTarget = 0.25;
  let progress = 0;
  let running = false, visible = true, raf = 0, last = 0, t = 0;

  /* ---------- Núcleo: esfera de puntos ---------- */
  const DOTS = [];
  const N = 2600;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    const x = Math.cos(th) * rad, z = Math.sin(th) * rad;
    // "continentes" abstractos: ruido suave en latitud/longitud
    const lat = Math.asin(y), lon = Math.atan2(z, x);
    const n = Math.sin(lon * 3 + Math.sin(lat * 4) * 1.7) * Math.cos(lat * 2.6 - 0.6) + 0.5 * Math.sin(lon * 7 + lat * 5);
    DOTS.push({ x, y, z, land: n > 0.12 });
  }

  /* ---------- Estrellas ---------- */
  let STARS = [];
  function seedStars() {
    STARS = Array.from({ length: Math.round((W * H) / 9000) }, () => ({
      x: Math.random() * W, y: Math.random() * H * 0.85, a: Math.random() * 0.5 + 0.1, s: Math.random() < 0.15 ? 1.4 : 0.8,
    }));
  }

  /* ---------- Piezas atraídas ---------- */
  const SHAPES = ["cube", "tri", "orb", "cube", "tri"];
  const parts = [];
  function spawn(burst) {
    const side = Math.random();
    let x, y;
    if (burst) {
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60;
      x = magnet.x + Math.cos(a) * d; y = magnet.y + Math.sin(a) * d;
    } else if (side < 0.38) { x = -30; y = Math.random() * H * 0.9; }
    else if (side < 0.76) { x = W + 30; y = Math.random() * H * 0.9; }
    else { x = Math.random() * W; y = -30; }
    const size = 3 + Math.random() * (W < 700 ? 6 : 9);
    parts.push({
      x, y, vx: burst ? (x - magnet.x) * 0.12 : (Math.random() - 0.5) * 0.6, vy: burst ? (y - magnet.y) * 0.12 : (Math.random() - 0.5) * 0.6,
      size, shape: SHAPES[(Math.random() * SHAPES.length) | 0], rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.04,
      life: 1, burst: !!burst, age: 0,
    });
  }

  function wantedParts() {
    const base = W < 700 ? 0.55 : 1;
    if (mode === "pulling") return Math.round((26 + progress * 60) * base);
    if (mode === "seeking") return Math.round(40 * base);
    if (mode === "done") return Math.round(14 * base);
    return Math.round(18 * base);
  }

  /* ---------- Geometría ---------- */
  function measure() {
    const hr = hero.getBoundingClientRect();
    W = hr.width; H = hr.height;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    locate(true);
    seedStars();
  }

  function locate(snap) {
    if (!target) return;
    const hr = hero.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    magnet = { x: tr.left - hr.left + tr.width / 2, y: tr.top - hr.top + Math.min(tr.height, 150) / 2, w: tr.width, h: tr.height };
    const r = Math.min(Math.max(W * 0.46, 260), 620);
    // la cima del núcleo asoma por detrás del panel
    const top = tr.top - hr.top + Math.min(tr.height, 170) - 26;
    coreTarget = { x: W / 2, y: top + r, r };
    if (snap) core = { ...coreTarget };
  }

  /* ---------- Dibujo ---------- */
  function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

  function drawBackground() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    for (const s of STARS) {
      ctx.fillStyle = `rgba(255,236,190,${s.a})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
  }

  function drawHalo() {
    const { x, y, r } = core;
    const glow = 0.75 + pull * 0.35;
    // corona exterior
    let g = ctx.createRadialGradient(x, y, r * 0.86, x, y, r * 1.55);
    g.addColorStop(0, `rgba(255,150,0,${0.55 * glow})`);
    g.addColorStop(0.18, `rgba(255,110,0,${0.22 * glow})`);
    g.addColorStop(0.5, `rgba(120,50,0,${0.08 * glow})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // disco del núcleo (tapa las estrellas)
    g = ctx.createRadialGradient(x, y - r * 0.55, r * 0.1, x, y, r);
    g.addColorStop(0, "#1a0f00");
    g.addColorStop(0.7, "#0b0600");
    g.addColorStop(0.93, "#2a1400");
    g.addColorStop(1, `rgba(255,170,30,${0.9 * glow})`);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    // borde incandescente
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 1.02, Math.PI * 1.98);
    ctx.strokeStyle = `rgba(255,214,110,${0.75 * glow})`;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = "rgba(255,170,0,0.9)"; ctx.shadowBlur = 24;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawDots() {
    const { x: cx, y: cy, r } = core;
    const rot = t * 0.00006;
    const tilt = -0.42;
    const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
    for (const d of DOTS) {
      // rotación en Y y luego inclinación en X
      const x1 = d.x * cr + d.z * sr;
      const z1 = -d.x * sr + d.z * cr;
      const y2 = d.y * ct - z1 * st;
      const z2 = d.y * st + z1 * ct;
      if (z2 < 0.02) continue;
      const px = cx + x1 * r * 0.985, py = cy - y2 * r * 0.985;
      if (py > H + 4 || py < -4) continue;
      const edge = Math.pow(z2, 0.6);
      const a = d.land ? 0.3 + edge * 0.7 : 0.07 + edge * 0.12;
      const s = d.land ? 1.4 + edge * 1.5 : 1.1;
      ctx.fillStyle = d.land ? `rgba(255,${200 + edge * 40 | 0},${90 + edge * 120 | 0},${a})` : rgba(GOLD, a);
      ctx.fillRect(px - s / 2, py - s / 2, s, s);
    }
  }

  /* Líneas de campo de un dipolo: r = L·sin²θ (eje vertical del núcleo) */
  function drawFieldLines() {
    const { x: cx, y: cy, r } = core;
    const Ls = [1.35, 1.75, 2.3, 3.1, 4.2];
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 10]);
    ctx.lineDashOffset = -t * 0.012 * (1 + pull * 2);
    for (let k = 0; k < Ls.length; k++) {
      const L = Ls[k] * r;
      const th0 = Math.asin(Math.sqrt(r / L));
      const alpha = (0.32 - k * 0.045) * (0.7 + pull * 0.6);
      ctx.strokeStyle = `rgba(255,200,80,${Math.max(alpha, 0.05)})`;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 90; i++) {
          const th = th0 + (Math.PI / 2 - th0) * (i / 90) * 1.0;
          const rr = L * Math.sin(th) ** 2;
          const px = cx + side * rr * Math.sin(th);
          const py = cy - rr * Math.cos(th);
          if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  function drawPart(p) {
    const a = Math.max(0, Math.min(1, p.life)) * (p.burst ? 1 : Math.min(1, p.age / 30));
    if (a <= 0.01) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = a;
    const s = p.size;
    const g = ctx.createLinearGradient(-s, -s, s, s);
    g.addColorStop(0, "#fff3c4"); g.addColorStop(0.45, "#ffc21a"); g.addColorStop(1, "#a86400");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(255,170,0,0.8)"; ctx.shadowBlur = s * 1.6;
    if (p.shape === "orb") {
      ctx.beginPath(); ctx.arc(0, 0, s * 0.75, 0, Math.PI * 2); ctx.fill();
    } else if (p.shape === "tri") {
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.9, s * 0.6); ctx.lineTo(-s * 0.9, s * 0.6); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,250,225,0.55)";
      ctx.fillRect(-s * 0.7, -s * 0.7, s * 1.4, s * 0.35);
    }
    ctx.restore();
  }

  function stepParts(dt) {
    const want = wantedParts();
    if (parts.filter((p) => !p.burst).length < want && Math.random() < 0.25 * dt) spawn(false);
    const force = 0.018 + pull * 0.06;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      const dx = magnet.x - p.x, dy = magnet.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (p.burst) {
        p.vx *= 0.94; p.vy *= 0.94; p.life -= 0.012 * dt;
      } else {
        const f = force * Math.min(1, 260 / dist + 0.25);
        p.vx += (dx / dist) * f * dt; p.vy += (dy / dist) * f * dt;
        // giro tangencial: entran en espiral, como limaduras
        p.vx += (-dy / dist) * 0.004 * dt; p.vy += (dx / dist) * 0.004 * dt;
        p.vx *= 0.985; p.vy *= 0.985;
        const inX = Math.abs(dx) < magnet.w / 2 - 20, inY = Math.abs(dy) < 40;
        if (inX && inY || dist < 30) p.life -= 0.08 * dt;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.life <= 0 || p.x < -80 || p.x > W + 80 || p.y > H + 80) parts.splice(i, 1);
    }
  }

  function frame(now) {
    const dt = Math.min(3, last ? (now - last) / 16.67 : 1);
    last = now; t += dt * 16.67;
    pull += (pullTarget - pull) * 0.05 * dt;
    core.x += (coreTarget.x - core.x) * 0.08 * dt;
    core.y += (coreTarget.y - core.y) * 0.08 * dt;
    core.r += (coreTarget.r - core.r) * 0.08 * dt;
    drawBackground();
    drawHalo();
    drawDots();
    drawFieldLines();
    stepParts(dt);
    for (const p of parts) drawPart(p);
    if (running) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced || !visible || document.hidden) return;
    running = true; last = 0; raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  function staticFrame() {
    for (let i = 0; i < 16; i++) { spawn(false); const p = parts[parts.length - 1]; p.x = magnet.x + (Math.random() - 0.5) * W * 0.9; p.y = Math.random() * magnet.y * 1.4; p.age = 60; }
    t = 0; drawBackground(); drawHalo(); drawDots(); drawFieldLines(); for (const p of parts) drawPart(p);
  }

  /* ---------- API pública para app.js ---------- */
  window.CMField = {
    setMode(next, value) {
      mode = next;
      if (next === "pulling") { progress = value || 0; pullTarget = 0.6 + progress * 0.9; }
      else if (next === "seeking") pullTarget = 0.9;
      else if (next === "done") { pullTarget = 0.35; for (let i = 0; i < (W < 700 ? 22 : 40); i++) spawn(true); }
      else pullTarget = 0.25;
      if (reduced) staticFrame();
    },
    relayout() { locate(false); if (reduced) staticFrame(); },
  };

  /* ---------- Ciclo de vida ---------- */
  measure();
  new ResizeObserver(() => { measure(); if (reduced) staticFrame(); }).observe(hero);
  if (target) new ResizeObserver(() => locate(false)).observe(target);
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    visible ? start() : stop();
  }).observe(hero);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  if (reduced) staticFrame(); else start();
})();
