// ─── Space Background ─────────────────────────────────────────────────────────

(function () {
  const canvas = document.getElementById('space-bg');
  const ctx    = canvas.getContext('2d');

  const NEBULAE = [
    { rx: 0.15, ry: 0.25, r: 0.30, color: [120,  30, 220] },
    { rx: 0.72, ry: 0.55, r: 0.32, color: [ 20,  90, 210] },
    { rx: 0.48, ry: 0.10, r: 0.22, color: [200,  40, 110] },
    { rx: 0.88, ry: 0.30, r: 0.20, color: [ 40, 160, 255] },
    { rx: 0.35, ry: 0.80, r: 0.25, color: [ 80,  20, 180] },
  ];

  let stars = [];
  const shooters = [];
  let VW = 0, VH = 0; // fixed virtual dimensions, set once

  // Resize only updates canvas dimensions — stars are never rebuilt
  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  function buildStars() {
    stars = [];
    // Lock virtual coordinate space to the largest likely screen size
    const W = Math.max(canvas.width,  window.screen.availWidth  || 2560);
    const H = Math.max(canvas.height, window.screen.availHeight || 1440);
    VW = W; VH = H;

    // Generate stars inside a circle (radius = half-diagonal of virtual rect).
    // A circle rotated around its centre always looks the same — no empty corners.
    const cx = VW / 2, cy = VH / 2;
    const R  = Math.sqrt(VW * VW + VH * VH) / 2;
    const n  = Math.min(Math.floor(Math.PI * R * R / 700), 5000);
    for (let i = 0; i < n; i++) {
      const size = Math.random() < 0.04 ? Math.random() * 2 + 1.5
                 : Math.random() < 0.15 ? Math.random() * 1 + 0.8
                 : Math.random() * 0.6 + 0.2;
      // Uniform distribution inside a circle
      const angle = Math.random() * Math.PI * 2;
      const r     = R * Math.sqrt(Math.random());
      stars.push({
        x:      cx + r * Math.cos(angle),
        y:      cy + r * Math.sin(angle),
        size,
        base:   Math.random() * 0.4 + (size > 1.5 ? 0.85 : 0.55),
        speed:  Math.random() * 1.2 + 0.2,
        phase:  Math.random() * Math.PI * 2,
        hue:    [0, 210, 220, 40][Math.floor(Math.random() * 4)], // white/blue/cyan/warm
      });
    }
  }

  function spawnShooter() {
    const angle = (Math.PI / 5) + (Math.random() - 0.5) * 0.4;
    shooters.push({
      x:       Math.random() * canvas.width * 0.75,
      y:       Math.random() * canvas.height * 0.55,
      vx:      Math.cos(angle) * (7 + Math.random() * 5),
      vy:      Math.sin(angle) * (7 + Math.random() * 5),
      trail:   60 + Math.random() * 60,
      life:    1,
    });
  }

  const ROT_SPEED = 0.024; // radians per second — full rotation ~4.4 min

  function draw(ts) {
    const t   = ts / 1000;
    const cx  = VW / 2;
    const cy  = VH / 2;
    const rot = t * ROT_SPEED;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Deep-space background
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ── Rotating layer (nebulae + stars) ──────────────────────────────────────
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.translate(-cx, -cy);

    // Nebulae
    NEBULAE.forEach(n => {
      const [r, g, b] = n.color;
      const nx = n.rx * VW;
      const ny = n.ry * VH;
      const radius = n.r * Math.min(VW, VH);
      const grd = ctx.createRadialGradient(nx, ny, 0, nx, ny, radius);
      grd.addColorStop(0,   `rgba(${r},${g},${b},0.13)`);
      grd.addColorStop(0.5, `rgba(${r},${g},${b},0.05)`);
      grd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    // Stars
    stars.forEach(s => {
      const opacity = s.base * (0.55 + 0.45 * Math.sin(t * s.speed + s.phase));
      ctx.globalAlpha = opacity;
      if (s.size > 1.2) {
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 4);
        glow.addColorStop(0, `hsla(${s.hue},80%,95%,0.6)`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `hsl(${s.hue},60%,92%)`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.restore();
    // ── End rotating layer ────────────────────────────────────────────────────

    // Shooting stars (not rotated — they streak across the screen naturally)
    for (let i = shooters.length - 1; i >= 0; i--) {
      const s = shooters[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 1 / (s.trail / Math.hypot(s.vx, s.vy));
      if (s.life <= 0 || s.x > canvas.width + 100 || s.y > canvas.height + 100) {
        shooters.splice(i, 1); continue;
      }
      const tailLen = 18;
      const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * tailLen, s.y - s.vy * tailLen);
      grad.addColorStop(0,   `rgba(255,255,255,${s.life * 0.9})`);
      grad.addColorStop(0.4, `rgba(180,210,255,${s.life * 0.4})`);
      grad.addColorStop(1,   'rgba(180,210,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * tailLen, s.y - s.vy * tailLen);
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  buildStars();
  // Spawn a shooter every ~1.2s; occasionally fire 2 at once
  setInterval(() => {
    spawnShooter();
    if (Math.random() < 0.3) spawnShooter();
  }, 1200);
  requestAnimationFrame(draw);
})();
