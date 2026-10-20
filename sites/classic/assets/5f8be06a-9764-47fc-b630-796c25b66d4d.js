/* ───────────────────────────────────────────────────────────
   neural.js — the living field
   A slow, breathing constellation of nodes and synapses.
   Nodes drift on their own currents; edges form and dissolve
   by proximity; signals occasionally fire and propagate across
   the network like a thought crossing a mind. The cursor is a
   warm body the nearest neurons reach toward.

   Reads CSS custom properties so the Tweaks panel can retint /
   redensify the whole field live:
     --nf-node   node + glow color
     --nf-ember  warm accent node color
     --nf-link   synapse line color (rgb triplet, no alpha)
     --nf-cursor cursor-reach line color (rgb triplet)
   and data attributes on <body>:
     data-nf-density   sparse | balanced | dense
     data-nf-motion    on | off   (off => static field)
   ─────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  const canvas = document.getElementById("neural");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  let W = 0, H = 0, DPR = 1;
  let nodes = [];
  let signals = [];
  let raf = null;
  let lastFire = 0;

  // ─── tunables, re-read from the DOM ───────────────────────
  const cfg = {
    nodeColor: "157,168,255",
    emberColor: "239,131,84",
    linkColor: "150,168,255",
    cursorColor: "239,131,84",
    densityKey: "balanced",
    motion: !prefersReduced,
    linkDist: 132,
    cursorDist: 200,
    emberRatio: 0.10,
  };

  function readVars() {
    const cs = getComputedStyle(document.documentElement);
    const grab = (name, fallback) => {
      const v = cs.getPropertyValue(name).trim();
      return v || fallback;
    };
    cfg.nodeColor   = grab("--nf-node",   cfg.nodeColor);
    cfg.emberColor  = grab("--nf-ember",  cfg.emberColor);
    cfg.linkColor   = grab("--nf-link",   cfg.linkColor);
    cfg.cursorColor = grab("--nf-cursor", cfg.cursorColor);
    const d = document.body.getAttribute("data-nf-density") || "balanced";
    cfg.densityKey = d;
    const m = document.body.getAttribute("data-nf-motion");
    cfg.motion = m === "off" ? false : !prefersReduced;
  }

  // density → target node count per ~megapixel
  const DENSITY = { sparse: 70, balanced: 115, dense: 175 };

  // ─── pointer ──────────────────────────────────────────────
  const pointer = { x: -9999, y: -9999, active: false, vx: 0, vy: 0 };
  // a gentle drift target so the field has subtle global parallax
  const flow = { x: 0, y: 0 };

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function build() {
    const target = Math.round((W * H) / 1e6 * (DENSITY[cfg.densityKey] || 115));
    const n = Math.max(28, Math.min(320, target));
    nodes = [];
    for (let i = 0; i < n; i++) {
      const ember = Math.random() < cfg.emberRatio;
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: rand(-0.14, 0.14),
        vy: rand(-0.14, 0.14),
        r: ember ? rand(1.6, 3.0) : rand(0.7, 2.0),
        ember,
        // each node breathes on its own phase
        ph: Math.random() * Math.PI * 2,
        ps: rand(0.6, 1.6),
        wake: 0, // 0..1 how "lit" by the cursor
      });
    }
    signals = [];
  }

  // find a neighbor of a node within link distance (for propagation)
  function neighbor(node, exclude) {
    let best = null, bestD = cfg.linkDist * cfg.linkDist;
    for (let i = 0; i < nodes.length; i++) {
      const o = nodes[i];
      if (o === node || o === exclude) continue;
      const dx = o.x - node.x, dy = o.y - node.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  function fire() {
    if (!nodes.length) return;
    const from = nodes[(Math.random() * nodes.length) | 0];
    const to = neighbor(from, null);
    if (!to) return;
    signals.push({ from, to, t: 0, speed: rand(0.012, 0.022), hops: 0, ember: Math.random() < 0.45 });
  }

  // ─── draw ─────────────────────────────────────────────────
  function frame(now) {
    raf = requestAnimationFrame(frame);
    ctx.clearRect(0, 0, W, H);

    const moving = cfg.motion;

    // global slow flow (very subtle)
    flow.x = Math.sin(now * 0.00004) * 0.06;
    flow.y = Math.cos(now * 0.00005) * 0.06;

    // update nodes
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i];
      if (moving) {
        p.x += p.vx + flow.x;
        p.y += p.vy + flow.y;
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
      }
      // cursor wake
      if (pointer.active) {
        const dx = p.x - pointer.x, dy = p.y - pointer.y;
        const d = Math.hypot(dx, dy);
        const target = d < cfg.cursorDist ? 1 - d / cfg.cursorDist : 0;
        p.wake += (target - p.wake) * 0.12;
        // gentle attraction toward the cursor
        if (moving && d < cfg.cursorDist && d > 1) {
          const pull = (target * target) * 0.18;
          p.x -= (dx / d) * pull;
          p.y -= (dy / d) * pull;
        }
      } else {
        p.wake += (0 - p.wake) * 0.08;
      }
    }

    // edges (synapses)
    const maxD = cfg.linkDist;
    const maxD2 = maxD * maxD;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > maxD2) continue;
        const d = Math.sqrt(d2);
        let alpha = (1 - d / maxD) * 0.42;
        const wake = Math.max(a.wake, b.wake);
        alpha += wake * 0.45;
        if (alpha <= 0.01) continue;
        ctx.strokeStyle = `rgba(${cfg.linkColor},${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.6 + wake * 0.9;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // cursor reach — brighter warm lines to the nearest neurons
    if (pointer.active) {
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        if (p.wake < 0.06) continue;
        ctx.strokeStyle = `rgba(${cfg.cursorColor},${(p.wake * 0.5).toFixed(3)})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(pointer.x, pointer.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }

    // nodes (soft glow + core)
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i];
      const breathe = 0.5 + 0.5 * Math.sin(now * 0.001 * p.ps + p.ph);
      const col = p.ember ? cfg.emberColor : cfg.nodeColor;
      const glowR = (p.r + 2) * (1.6 + breathe * 0.8 + p.wake * 2.2);
      const coreA = 0.45 + breathe * 0.25 + p.wake * 0.4;

      // bloom
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
      g.addColorStop(0, `rgba(${col},${(0.30 + p.wake * 0.4).toFixed(3)})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // core
      ctx.fillStyle = `rgba(${col},${Math.min(1, coreA).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // signals firing across synapses
    if (moving) {
      if (now - lastFire > rand(1400, 3200) && signals.length < 6) {
        lastFire = now;
        fire();
      }
      for (let i = signals.length - 1; i >= 0; i--) {
        const s = signals[i];
        s.t += s.speed;
        const ease = s.t;
        const x = s.from.x + (s.to.x - s.from.x) * ease;
        const y = s.from.y + (s.to.y - s.from.y) * ease;
        const col = s.ember ? cfg.emberColor : cfg.nodeColor;

        // bright trailing line on the active synapse
        ctx.strokeStyle = `rgba(${col},${(0.5 * (1 - s.t)).toFixed(3)})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(s.from.x, s.from.y);
        ctx.lineTo(x, y);
        ctx.stroke();

        // travelling pulse
        const pr = 2.4;
        const pg = ctx.createRadialGradient(x, y, 0, x, y, pr * 4);
        pg.addColorStop(0, `rgba(${col},0.95)`);
        pg.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(x, y, pr * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,0.9)`;
        ctx.beginPath();
        ctx.arc(x, y, pr * 0.6, 0, Math.PI * 2);
        ctx.fill();

        if (s.t >= 1) {
          // arrival flash on target
          s.to.wake = Math.min(1, s.to.wake + 0.9);
          // propagate sometimes — a thought travels on
          if (s.hops < 3 && Math.random() < 0.62) {
            const nxt = neighbor(s.to, s.from);
            if (nxt) {
              signals.push({ from: s.to, to: nxt, t: 0, speed: s.speed, hops: s.hops + 1, ember: s.ember });
            }
          }
          signals.splice(i, 1);
        }
      }
    }

    if (!moving) {
      // static: draw one calm frame then stop
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  // ─── events ───────────────────────────────────────────────
  if (finePointer) {
    window.addEventListener("mousemove", (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      kick();
    });
    window.addEventListener("mouseleave", () => { pointer.active = false; });
    // a soft click sends a thought from the cursor's nearest node
    window.addEventListener("click", () => {
      if (!nodes.length || !cfg.motion) return;
      let best = null, bestD = Infinity;
      for (const p of nodes) {
        const d = Math.hypot(p.x - pointer.x, p.y - pointer.y);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (best && bestD < cfg.cursorDist) {
        const to = neighbor(best, null);
        if (to) signals.push({ from: best, to, t: 0, speed: 0.02, hops: 0, ember: true });
      }
    });
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  // pause when tab hidden (battery / perf); resume robustly on return.
  // We always paint one frame synchronously so a static field shows even
  // while rAF is throttled (e.g. the canvas mounted off-screen / hidden).
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    } else {
      restart();
    }
  });
  window.addEventListener("pageshow", restart);
  window.addEventListener("focus", restart);

  function kick() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // Cancel any (possibly deferred / stranded) callback, then paint one
  // frame directly. frame() re-arms rAF at its top when motion is on, so
  // the loop resumes; in static mode it draws once and stops.
  function restart() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    frame(performance.now());
  }

  // Public hook so the tweaks layer can refresh after changing vars/attrs
  window.__neuralRefresh = function () {
    readVars();
    build();
    restart();
  };

  // ─── boot ─────────────────────────────────────────────────
  readVars();
  resize();
  restart();
})();
