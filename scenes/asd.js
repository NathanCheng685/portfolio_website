import { Actor, F, motion } from "../sprite.js";

// Age axis: the paper's windows are 2 years wide from 6 to 26, then three broad
// windows to 64. Ages 6 to 26 get 80% of the width; 26 to 64 is log-compressed.
const MIN_AGE = 6;
const MAX_AGE = 64;
const DENSE_END = 26;
const SPLIT = 0.8;
const T_TOP = 1.2;
const T_BOTTOM = -3.4;
const T_CRITICAL = -1.97;
const STAGES = [["Childhood", 6, 12, "Child"], ["Adolescence", 12, 18, "Teen"], ["Early adulthood", 18, 26, "Young adult"], ["Adulthood", 26, 64, "Adult"]];
const TICKS = [6, 10, 14, 18, 22, 26, 64];
const SMOOTH = 2; // the line averages each 2-year window with two neighbors on each side
const CLUSTERS = [["persistent", "steady"], ["catchup", "fading"]];
const NS = "http://www.w3.org/2000/svg";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const shareOf = age => (age <= DENSE_END
  ? SPLIT * (age - MIN_AGE) / (DENSE_END - MIN_AGE)
  : SPLIT + (1 - SPLIT) * Math.log(age / DENSE_END) / Math.log(MAX_AGE / DENSE_END));
const ageOf = share => (share <= SPLIT
  ? MIN_AGE + share / SPLIT * (DENSE_END - MIN_AGE)
  : DENSE_END * Math.exp((share - SPLIT) / (1 - SPLIT) * Math.log(MAX_AGE / DENSE_END)));
const years = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const signed = t => (t < 0 ? `−${Math.abs(t).toFixed(2)}` : t.toFixed(2));

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  parent?.append(node);
  return node;
}

// Real cluster trajectories from the PNAS paper (SI Table S8). The pixel Nathan holds
// the age cursor; dragging him moves age and reveals both lines up to that age.
export default function asd(card) {
  const $ = selector => card.querySelector(selector);
  const plot = $("#asd-plot");
  const svg = plot.querySelector("svg");
  const input = $("#asd-age");
  const rail = $(".age-rail");
  const stats = $("#asd-stats");
  const actor = new Actor($(".rail-actor"));
  let windows = [];
  let smooth = {};
  let share = Number(input.value) / 1000;
  let lastShare = share;
  let travelled = 0;
  let dragging = false;
  let sweepTimer = 0;
  let swept = false;
  let size = { w: 0, h: 0 };
  const parts = {};

  const x = age => shareOf(age) * size.w;
  const y = t => 18 + (T_TOP - t) / (T_TOP - T_BOTTOM) * (size.h - 26);

  // Overlapping windows share most of their people, so raw t values zigzag. The
  // line is a centered moving average over the dense 2-year windows; the three
  // broad adult windows stay raw. Dots always show the raw window values.
  function smoothed(key) {
    const dense = windows.filter(w => w.to - w.from <= 2);
    return windows.map((w, i) => {
      if (w.to - w.from > 2) return w[key].t;
      const near = dense.slice(Math.max(0, i - SMOOTH), Math.min(dense.length, i + SMOOTH + 1));
      return near.reduce((sum, n) => sum + n[key].t, 0) / near.length;
    });
  }

  function valueAt(key, s) {
    if (!windows.length) return 0;
    const points = windows.map((w, i) => [shareOf(w.center), smooth[key][i]]);
    if (s <= points[0][0]) return points[0][1];
    if (s >= points.at(-1)[0]) return points.at(-1)[1];
    const i = points.findIndex(([ps]) => ps >= s);
    const [s0, t0] = points[i - 1];
    const [s1, t1] = points[i];
    return t0 + (t1 - t0) * (s - s0) / (s1 - s0);
  }

  function nearestWindow(s) {
    return windows.reduce((best, w) => (Math.abs(shareOf(w.center) - s) < Math.abs(shareOf(best.center) - s) ? w : best), windows[0]);
  }

  function ticks() {
    const holder = $(".rail-ticks");
    const roomy = rail.clientWidth >= 520;
    holder.innerHTML = TICKS.map((age, i) => {
      const left = shareOf(age) * 100;
      const cls = i === 0 ? "first" : i === TICKS.length - 1 ? "last" : "";
      return `<span class="rail-tick ${cls}" style="left:${left}%">${age}${i === TICKS.length - 1 && roomy ? " years" : ""}</span>`;
    }).join("");
    $(".rail-break").style.left = `${SPLIT * 100}%`;
  }

  function draw() {
    size = { w: plot.clientWidth, h: plot.clientHeight };
    if (!size.w || !size.h || !windows.length) return;
    svg.setAttribute("viewBox", `0 0 ${size.w} ${size.h}`);
    svg.querySelectorAll("g, defs, line").forEach(node => node.remove());
    plot.querySelectorAll(".stage-label, .plot-label").forEach(node => node.remove());

    const defs = el("defs", {}, svg);
    const clip = el("clipPath", { id: "asd-reveal" }, defs);
    parts.reveal = el("rect", { x: 0, y: 0, height: size.h, width: 0 }, clip);

    const bands = el("g", { class: "stage-bands" }, svg);
    STAGES.forEach(([name, from, to, short], i) => {
      if (i % 2 === 0) el("rect", { x: x(from), y: 0, width: x(to) - x(from), height: size.h }, bands);
      const label = document.createElement("span");
      label.className = "stage-label";
      label.textContent = name;
      label.style.left = `${(x(from) + x(to)) / 2}px`;
      plot.append(label);
      const room = x(to) - x(from) - 6;
      if (label.offsetWidth > room) label.textContent = short;
      if (label.offsetWidth > room) label.hidden = true;
    });
    ticks();

    el("line", { class: "zero-line", x1: 0, x2: size.w, y1: y(0), y2: y(0) }, svg);
    el("line", { class: "critical-line", x1: 0, x2: size.w, y1: y(T_CRITICAL), y2: y(T_CRITICAL) }, svg);
    for (const [text, t, cls] of [["typical", 0, "zero"], ["p = .05", T_CRITICAL, "critical"]]) {
      const label = document.createElement("span");
      label.className = `plot-label ${cls}`;
      label.textContent = text;
      label.style.top = `${y(t)}px`;
      plot.append(label);
    }

    const ghost = el("g", { class: "ghost" }, svg);
    const shown = el("g", { "clip-path": "url(#asd-reveal)" }, svg);
    for (const [key, cls] of CLUSTERS) {
      const d = windows.map((w, i) => `${i ? "L" : "M"}${x(w.center).toFixed(1)} ${y(smooth[key][i]).toFixed(1)}`).join("");
      el("path", { d }, ghost);
      el("path", { d, class: `curve ${cls}` }, shown);
      const dots = el("g", { class: `window-dots ${cls}` }, shown);
      for (const w of windows) {
        el("circle", { cx: x(w.center), cy: y(w[key].t), r: 2.6, class: w[key].p < 0.05 ? "sig" : "" }, dots);
      }
    }
    const cursor = el("g", {}, svg);
    parts.cursor = el("line", { class: "cursor", y1: 0, y2: size.h }, cursor);
    parts.dots = CLUSTERS.map(([, cls]) => el("circle", { class: `dot ${cls}`, r: 5 }, cursor));
    render(share);
  }

  function render(s) {
    const age = ageOf(s);
    const cx = s * size.w;
    rail.style.setProperty("--age-x", `${s * 100}%`);
    rail.classList.toggle("readout-left", s > 0.8);
    $("#asd-age-out").textContent = String(Math.round(age));
    input.setAttribute("aria-valuetext", `${Math.round(age)} years`);
    if (!windows.length || !parts.cursor) return;
    parts.reveal.setAttribute("width", String(cx));
    parts.cursor.setAttribute("x1", String(cx));
    parts.cursor.setAttribute("x2", String(cx));
    CLUSTERS.forEach(([key], i) => {
      parts.dots[i].setAttribute("cx", String(cx));
      parts.dots[i].setAttribute("cy", String(y(valueAt(key, s))));
    });
    const w = nearestWindow(s);
    const line = (key, cls) => {
      const { t, p } = w[key];
      const verdict = p < 0.05 ? (t < 0 ? "Lower in autism" : "Higher in autism") : t <= -1 ? "Lower, not significant" : "About typical";
      return `<span class="stat"><i class="swatch ${cls}"></i>${verdict} <b>t = ${signed(t)}</b></span>`;
    };
    stats.innerHTML = `<span class="stat-window">Ages ${years(w.from)} to ${years(w.to)}</span>${line("persistent", "steady")}${line("catchup", "fading")}`;
  }

  // Walk frames advance with distance, so the stride matches the drag.
  function stepTo(s) {
    const delta = s - lastShare;
    if (delta !== 0) {
      travelled += Math.abs(delta) * 100;
      if (!motion.reduced) {
        actor.stop();
        actor.face(delta);
        actor.set(Math.floor(travelled / 2.4) % 2 ? F.gripStepA : F.gripStepB);
      }
    }
    lastShare = s;
    share = s;
    render(s);
  }

  function rest() {
    actor.idle(F.grip);
  }

  function shareFromPointer(event) {
    const box = rail.getBoundingClientRect();
    return clamp((event.clientX - box.left) / box.width, 0, 1);
  }

  rail.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    clearTimeout(sweepTimer);
    dragging = true;
    try {
      rail.setPointerCapture(event.pointerId);
    } catch {
      // capture can fail on some touch browsers; the drag still follows pointermove
    }
    const s = shareFromPointer(event);
    input.value = String(Math.round(s * 1000));
    stepTo(s);
    input.focus({ preventScroll: true });
  });
  rail.addEventListener("pointermove", event => {
    if (!dragging) return;
    const s = shareFromPointer(event);
    input.value = String(Math.round(s * 1000));
    stepTo(s);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    rail.addEventListener(type, () => {
      if (!dragging) return;
      dragging = false;
      rest();
    });
  }
  input.addEventListener("input", () => {
    clearTimeout(sweepTimer);
    stepTo(Number(input.value) / 1000);
    clearTimeout(input.restTimer);
    input.restTimer = setTimeout(rest, 220);
  });

  // First visit: walk from age 6 to 20 so the lines grow once.
  function sweep() {
    if (swept || motion.reduced) return;
    swept = true;
    let s = 0;
    lastShare = s;
    share = s;
    input.value = "0";
    render(s);
    const end = shareOf(20);
    const tick = () => {
      s = Math.min(end, s + 0.02);
      input.value = String(Math.round(s * 1000));
      stepTo(s);
      if (s < end) sweepTimer = setTimeout(tick, 50);
      else sweepTimer = setTimeout(rest, 120);
    };
    sweepTimer = setTimeout(tick, 250);
  }

  ticks();
  render(share);
  rest();
  new ResizeObserver(draw).observe(plot);
  fetch(new URL("../data/asd-trajectories.json", import.meta.url))
    .then(response => response.json())
    .then(data => {
      windows = data.windows;
      smooth = Object.fromEntries(CLUSTERS.map(([key]) => [key, smoothed(key)]));
      draw();
    })
    .catch(() => {
      stats.textContent = "The data could not load. Serve this folder over HTTP to see the chart.";
    });

  return {
    pose: F.grip,
    ownsActor: true,
    enter() {
      card.classList.add("is-settled");
      sweep();
    },
    leave() {
      card.classList.remove("is-settled");
    },
  };
}
