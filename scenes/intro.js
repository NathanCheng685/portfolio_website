import { F, motion } from "../sprite.js";

// A question mark built from blocks. The pointer pushes blocks aside; they spring home.
const SHAPE = [
  ".XXXXX.",
  "XX...XX",
  "XX...XX",
  "....XX.",
  "...XX..",
  "...XX..",
  ".......",
  "...XX..",
  "...XX..",
];

export default function intro(card) {
  const canvas = card.querySelector(".question-field canvas");
  const context = canvas.getContext("2d");
  const color = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#2b59c3";
  let blocks = [];
  let size = 0;
  let pointer = null;
  let frame = 0;
  let entered = false;

  let box = { width: 0, height: 0 };

  function layout() {
    box = { width: canvas.clientWidth, height: canvas.clientHeight };
    if (!box.width || !box.height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const cols = SHAPE[0].length;
    const rows = SHAPE.length;
    size = Math.floor(Math.min(box.width / (cols + 1), box.height / (rows + 1), 46));
    const offsetX = (box.width - cols * size) / 2;
    const offsetY = (box.height - rows * size) / 2;
    const previous = blocks;
    blocks = [];
    SHAPE.forEach((row, y) => [...row].forEach((cell, x) => {
      if (cell !== "X") return;
      const homeX = offsetX + x * size;
      const homeY = offsetY + y * size;
      const old = previous[blocks.length];
      blocks.push({ homeX, homeY, x: old ? homeX + (old.x - old.homeX) : homeX, y: old ? homeY + (old.y - old.homeY) : homeY, vx: 0, vy: 0, row: y, shown: old ? old.shown : !(!entered && !motion.reduced) });
    }));
    draw();
  }

  function draw() {
    context.clearRect(0, 0, box.width, box.height);
    context.fillStyle = color;
    const gap = Math.max(2, Math.round(size * 0.08));
    for (const block of blocks) {
      if (!block.shown) continue;
      context.fillRect(Math.round(block.x) + gap / 2, Math.round(block.y) + gap / 2, size - gap, size - gap);
    }
  }

  function step() {
    let energy = 0;
    const radius = size * 2.4;
    for (const block of blocks) {
      let targetX = block.homeX;
      let targetY = block.homeY;
      if (pointer) {
        const dx = block.homeX + size / 2 - pointer.x;
        const dy = block.homeY + size / 2 - pointer.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance < radius) {
          const push = (radius - distance) * 0.75;
          targetX += (dx / distance) * push;
          targetY += (dy / distance) * push;
        }
      }
      block.vx = (block.vx + (targetX - block.x) * 0.16) * 0.72;
      block.vy = (block.vy + (targetY - block.y) * 0.16) * 0.72;
      block.x += block.vx;
      block.y += block.vy;
      energy += Math.abs(block.vx) + Math.abs(block.vy) + Math.abs(targetX - block.x) * 0.05;
    }
    draw();
    frame = energy > 0.05 ? requestAnimationFrame(step) : 0;
  }

  function wake() {
    if (!frame && !motion.reduced) frame = requestAnimationFrame(step);
  }

  canvas.addEventListener("pointermove", event => {
    pointer = { x: event.offsetX, y: event.offsetY };
    wake();
  });
  canvas.addEventListener("pointerleave", () => { pointer = null; wake(); });
  canvas.addEventListener("click", () => {
    if (motion.reduced) return;
    for (const block of blocks) {
      block.vx += (Math.random() - 0.5) * size * 1.6;
      block.vy += (Math.random() - 0.5) * size * 1.6;
    }
    wake();
  });

  // Blocks arrive row by row, like frames of a stop-motion film.
  function assemble() {
    if (entered) return;
    entered = true;
    if (motion.reduced) {
      blocks.forEach(block => { block.shown = true; });
      draw();
      return;
    }
    let row = 0;
    const tick = () => {
      blocks.forEach(block => { if (block.row === row) block.shown = true; });
      draw();
      row += 1;
      if (row < SHAPE.length) setTimeout(tick, 70);
    };
    tick();
  }

  new ResizeObserver(layout).observe(canvas);

  return {
    pose: F.stand,
    enter(actor) {
      assemble();
      actor?.play([F.waveA, F.waveB], { fps: 5, times: 3, rest: F.stand });
    },
    relayout: layout,
  };
}
