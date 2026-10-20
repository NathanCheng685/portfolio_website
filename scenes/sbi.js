import { simulateLearning } from "../models.js";
import { F } from "../sprite.js";

// Four real test learners from the project (data/sbi-learners.json): their actual
// accuracy curves, true parameters, and the trained network's estimates.
const DIALS = [
  { key: "alpha", label: "α", digits: 2 },
  { key: "beta", label: "β", digits: 1 },
  { key: "phi", label: "φ", digits: 2 },
  { key: "kappa", label: "κ", digits: 2 },
];
const Y_TOP = 1;
const Y_BOTTOM = 0.25;
const CHANCE = 1 / 3;
const MATCH_SCALE = 0.12; // RMSE above the best achievable fit that drops the match to 0%
const NS = "http://www.w3.org/2000/svg";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rmse = (a, b) => Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0) / a.length);
const show = (key, v) => {
  const digits = DIALS.find(d => d.key === key).digits;
  return v < 0 ? `−${Math.abs(v).toFixed(digits)}` : v.toFixed(digits);
};

function el(name, attrs, parent) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  parent.append(node);
  return node;
}

export default function sbi(card, ctx) {
  const $ = selector => card.querySelector(selector);
  const plot = $("#sbi-plot");
  const svg = plot.querySelector("svg");
  const inputs = Object.fromEntries(DIALS.map(d => [d.key, $(`#${d.key}`)]));
  const matchLabel = $("#sbi-match");
  const panel = $("#sbi-reveal-panel");
  const table = panel.querySelector("table");
  const hint = panel.querySelector(".reveal-hint");
  const revealButton = $("#sbi-reveal");
  let learners = [];
  let index = 0;
  let revealed = false;
  let matched = false;
  let yours = null;
  let size = { w: 0, h: 0 };
  const parts = {};

  const values = () => Object.fromEntries(DIALS.map(d => [d.key, Number(inputs[d.key].value)]));
  // Ticks and the table use the slider's own step, so setting a dial to the number
  // in the table puts the thumb exactly on its tick.
  const snap = (key, v) => {
    const input = inputs[key];
    const step = Number(input.step);
    const min = Number(input.min);
    return clamp(min + Math.round((v - min) / step) * step, min, Number(input.max));
  };
  const learner = () => learners[index];
  const fitOf = curve => Math.round(100 * clamp(1 - Math.max(0, rmse(curve, learner().curve) - learner().floor) / MATCH_SCALE, 0, 1));
  const x = i => 6 + i / 12 * (size.w - 52);
  // The legend wraps on narrow plots, so the chart starts below its real height.
  let top = 22;
  const y = v => top + (Y_TOP - v) / (Y_TOP - Y_BOTTOM) * (size.h - top - 26);
  const pathOf = curve => curve.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");

  // The best fit any dial setting can reach is the true parameters' own curve:
  // the gap that remains is the learner's sampling noise (72 trials per point).
  function prepare(l) {
    if (l.floor !== undefined) return;
    l.floor = rmse(simulateLearning(l.true), l.curve);
    l.networkCurve = simulateLearning(l.network);
  }

  function paintFill(input) {
    const share = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
    input.style.setProperty("--fill", `${share * 100}%`);
  }

  function draw() {
    size = { w: plot.clientWidth, h: plot.clientHeight };
    if (!size.w || !size.h || !learners.length) return;
    top = Math.max(22, plot.querySelector(".sbi-legend").offsetHeight + 10);
    svg.setAttribute("viewBox", `0 0 ${size.w} ${size.h}`);
    svg.querySelectorAll("g").forEach(node => node.remove());
    plot.querySelectorAll(".axis-label").forEach(node => node.remove());
    const grid = el("g", { class: "sbi-grid" }, svg);
    for (const [v, text, cls] of [[1, "100%", ""], [0.5, "50%", ""], [CHANCE, "chance", "chance"]]) {
      el("line", { x1: x(0), x2: x(12), y1: y(v), y2: y(v), class: cls }, grid);
      const label = document.createElement("span");
      label.className = "axis-label y";
      label.textContent = text;
      label.style.top = `${y(v)}px`;
      plot.append(label);
    }
    for (const n of [1, 4, 7, 10, 13]) {
      const label = document.createElement("span");
      label.className = "axis-label x";
      label.textContent = n === 13 ? "13th time seen" : String(n);
      label.style.left = `${x(n - 1)}px`;
      if (n === 13) label.classList.add("last");
      plot.append(label);
    }
    const lines = el("g", {}, svg);
    parts.target = el("path", { class: "sbi-target" }, lines);
    parts.targetDots = el("g", { class: "sbi-target-dots" }, lines);
    parts.network = el("path", { class: "sbi-network" }, lines);
    parts.yours = el("path", { class: "sbi-yours" }, lines);
    paintTarget();
    if (yours) parts.yours.setAttribute("d", pathOf(yours));
    paintNetwork();
  }

  function paintTarget() {
    if (!parts.target) return;
    const l = learner();
    parts.target.setAttribute("d", pathOf(l.curve));
    parts.targetDots.innerHTML = "";
    l.curve.forEach((v, i) => el("circle", { cx: x(i), cy: y(v), r: 2.6 }, parts.targetDots));
    $("#sbi-key-target").textContent = `Test learner #${l.id}`;
  }

  function paintNetwork() {
    if (!parts.network) return;
    parts.network.setAttribute("d", revealed ? pathOf(learner().networkCurve) : "");
    $(".key-network").hidden = !revealed;
  }

  // Input events already arrive at most once per frame; one simulation is ~20 ms.
  function update() {
    if (!learners.length) return;
    yours = simulateLearning(values());
    if (parts.yours) parts.yours.setAttribute("d", pathOf(yours));
    const fit = fitOf(yours);
    const isMatch = fit >= 90;
    matchLabel.textContent = isMatch ? `Match ${fit}%. Got it.` : `Match ${fit}%`;
    matchLabel.classList.toggle("is-match", isMatch);
    if (isMatch && !matched) ctx.actor()?.play([F.thumbs], { fps: 0.8, rest: F.lookA });
    matched = isMatch;
    $("#sbi-chart-desc").textContent = `Test learner ${learner().id} ends at ${Math.round(learner().curve.at(-1) * 100)}% correct; your learner ends at ${Math.round(yours.at(-1) * 100)}%.`;
    if (revealed) fillTable();
  }

  function fillTable() {
    const l = learner();
    const row = (name, cls, params, fit) => `<tr class="${cls}"><th scope="row">${name}</th>${DIALS.map(d => `<td>${show(d.key, snap(d.key, params[d.key]))}</td>`).join("")}<td>${fit}%</td></tr>`;
    table.tBodies[0].innerHTML = row("True", "is-true", l.true, 100)
      + row("My network", "is-network", l.network, fitOf(l.networkCurve))
      + row("You", "is-you", values(), yours ? fitOf(yours) : 0);
  }

  function clearTicks() {
    card.querySelectorAll(".dial-tick").forEach(tick => tick.remove());
  }

  function placeTicks() {
    clearTicks();
    const l = learner();
    for (const d of DIALS) {
      const input = inputs[d.key];
      const share = v => clamp((v - Number(input.min)) / (Number(input.max) - Number(input.min)), 0, 1);
      for (const [kind, v] of [["true", l.true[d.key]], ["network", l.network[d.key]]]) {
        const tick = document.createElement("span");
        tick.className = `dial-tick ${kind}`;
        tick.style.left = `calc(var(--thumb) / 2 + (100% - var(--thumb)) * ${share(snap(d.key, v))})`;
        input.insertAdjacentElement("afterend", tick);
      }
    }
  }

  function reveal() {
    if (revealed || !learners.length) return;
    revealed = true;
    hint.hidden = true;
    table.hidden = false;
    fillTable();
    placeTicks();
    draw();
    revealButton.textContent = "Revealed";
    ctx.actor()?.play([F.lookA, F.lookB, F.lookA, F.thumbs], { fps: 4, rest: F.lookA });
  }

  function load(i) {
    index = i % learners.length;
    prepare(learner());
    revealed = false;
    matched = false;
    hint.hidden = false;
    table.hidden = true;
    clearTicks();
    revealButton.textContent = "Reveal the parameters";
    draw();
    update();
  }

  for (const d of DIALS) {
    const input = inputs[d.key];
    paintFill(input);
    input.addEventListener("input", () => {
      paintFill(input);
      $(`#${d.key}-out`).textContent = show(d.key, Number(input.value));
      update();
    });
  }
  revealButton.addEventListener("click", reveal);
  $("#sbi-new").addEventListener("click", () => {
    load(index + 1);
    ctx.actor()?.play([F.lookB, F.lookA], { fps: 4, rest: F.lookA });
  });

  new ResizeObserver(draw).observe(plot);
  fetch(new URL("../data/sbi-learners.json", import.meta.url))
    .then(response => response.json())
    .then(data => {
      learners = data.learners;
      load(0);
      draw();
    })
    .catch(() => {
      hint.textContent = "The learner data could not load. Reload the page to try again.";
    });

  return {
    pose: F.lookA,
    enter(actor) {
      actor?.play([F.lookA, F.lookB, F.lookA, F.lookB], { fps: 3, rest: F.lookA });
    },
  };
}
