import { F, motion } from "../sprite.js";

// Four gambles from the thesis pilot (data/llm-gambles.json): people's choices, and
// each model setting's choices against how long it reasoned. Nothing runs live.
// People are black; Qwen3 is blue and GPT-OSS purple, each darker with more reasoning.
const SETTINGS = [
  ["qwen3-32b", "none", "Qwen3, no reasoning", "#94ade4"],
  ["qwen3-32b", "thinking", "Qwen3, reasoning", "#2346a6"],
  ["gpt-oss-20b", "low", "GPT-OSS, low", "#c3a6ea"],
  ["gpt-oss-20b", "medium", "GPT-OSS, medium", "#8655cf"],
  ["gpt-oss-20b", "high", "GPT-OSS, high", "#532694"],
];
const PEOPLE = "#1b1c1a";
const SERIES = [["qwen", "qwen3-32b", "Qwen3 32B"], ["gpt", "gpt-oss-20b", "GPT-OSS 20B"]];
const color = (model, level) => SETTINGS.find(([m, l]) => m === model && l === level)[3];
const LEVEL = { none: "no reasoning", thinking: "reasoning on", low: "low effort", medium: "medium effort", high: "high effort" };
const X_MAX = 3000; // reasoning tokens at the right edge (log scale from 10)
const GAP = 36; // room between zero reasoning and the log axis
const REVEAL_MS = 650;
const NS = "http://www.w3.org/2000/svg";

const pct = v => `${Math.round(v * 100)}%`;
const num = v => (v < 0 ? `−${Math.abs(v)}` : String(v));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function el(name, attrs, parent) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  parent.append(node);
  return node;
}

function outcomeLines(outcomes) {
  const points = v => `${Math.abs(v)} point${Math.abs(v) === 1 ? "" : "s"}`;
  if (outcomes.length === 1) {
    const [{ value }] = outcomes;
    return [value < 0 ? `Lose ${points(value)} for sure` : `Win ${points(value)} for sure`];
  }
  return outcomes.map(({ value, p }) => {
    const chance = `${Math.round(p * 100)}% chance`;
    if (value === 0) return `${chance} of nothing`;
    return value < 0 ? `${chance} to lose ${points(value)}` : `${chance} to win ${points(value)}`;
  });
}

export default function llm(card, ctx) {
  const $ = selector => card.querySelector(selector);
  const plot = $("#gamble-plot");
  const svg = plot.querySelector("svg");
  const options = $(".gamble-options");
  const panel = $("#gamble-panel");
  let data = null;
  let index = 0;
  let pick = null;
  let size = { w: 0, h: 0 };
  let top = 30;
  let revealTimer = 0;
  let revealEnd = 0;
  let revealStart = -Infinity; // when the first-pick reveal began
  let revealRect = null;

  const gamble = () => data.gambles[index];
  const setting = (g, model, level) => g.settings.find(s => s.model === model && s.level === level);
  // The legend wraps on narrow screens, so the plot starts below its real height.
  const box = () => ({ left: 8, right: 40, top, bottom: 22 });
  const x = tokens => {
    const b = box();
    const x0 = b.left;
    if (tokens <= 0) return x0;
    const share = (Math.log10(Math.max(10, tokens)) - 1) / (Math.log10(X_MAX) - 1);
    return x0 + GAP + share * (size.w - b.right - x0 - GAP);
  };
  const y = share => {
    const b = box();
    return b.top + (1 - share) * (size.h - b.top - b.bottom);
  };
  // The reveal lives in time, not in the clip rect, so a redraw mid-animation keeps it.
  const revealed = () => {
    if (motion.reduced) return 1;
    const k = Math.min(1, Math.max(0, (performance.now() - revealStart) / REVEAL_MS));
    return 1 - (1 - k) ** 3;
  };

  function renderPilot() {
    const { summary } = data;
    const rows = [["People", summary.peopleHigher, PEOPLE, "people"]]
      .concat(SETTINGS.map(([model, level, label, c]) => [label, summary.settings.find(s => s.model === model && s.level === level).higher, c, ""]));
    $("#pilot-rows").innerHTML = rows.map(([label, v, c, cls]) => `<div class="pilot-row ${cls}"><span>${label}</span><i style="--w:${(v * 100).toFixed(1)}%;--c:${c}"></i><b>${pct(v)}</b></div>`).join("");
    $("#pilot-line").textContent = "Reasoning picks the higher average. That looks human only where most people pick it too.";
  }

  function renderOptions() {
    const g = gamble();
    $("#gamble-count").textContent = `${index + 1} of ${data.gambles.length}`;
    options.innerHTML = g.options.map((option, i) => `
      <button type="button" class="gamble-option" data-option="${i}" aria-pressed="false">
        <span class="opt-letter">${"AB"[i]}</span>
        <span class="opt-lines">${outcomeLines(option.outcomes).map(line => `<span>${escape(line)}</span>`).join("")}</span>
        <span class="opt-foot">Average ${num(option.ev)} · People ${pct(g.people.shares[i])}</span>
      </button>`).join("");
  }

  function draw() {
    size = { w: plot.clientWidth, h: plot.clientHeight };
    if (!size.w || !size.h || !data) return;
    top = plot.querySelector(".gamble-legend").offsetHeight + 14;
    svg.setAttribute("viewBox", `0 0 ${size.w} ${size.h}`);
    svg.replaceChildren();
    plot.querySelectorAll(".axis-label, .people-tag").forEach(node => node.remove());
    const b = box();
    const grid = el("g", { class: "gamble-grid" }, svg);
    for (const [v, text] of [[1, "100%"], [0.5, "50%"], [0, "0%"]]) {
      el("line", { x1: b.left, x2: size.w - b.right, y1: y(v), y2: y(v) }, grid);
      label("y", text, { top: `${y(v)}px` });
    }
    for (const [t, text] of [[0, "0"], [10, "10"], [100, "100"], [1000, "1,000 tokens"]]) {
      label("x", text, { left: `${x(t)}px` }, t === 0 ? "first" : "");
    }
    el("path", { class: "axis-break", d: `M${b.left + GAP / 2 - 5} ${size.h - b.bottom - 4}l4 8m3 -8l4 8` }, svg);
    if (pick === null) return;

    const g = gamble();
    const people = g.people.shares[pick];
    el("line", { class: "people-line", x1: b.left, x2: size.w - b.right, y1: y(people), y2: y(people) }, svg);
    const tag = document.createElement("span");
    tag.className = "people-tag";
    tag.textContent = `People ${pct(people)}`;
    tag.style.top = `${y(people)}px`;
    tag.classList.toggle("below", people > 0.86);
    tag.setAttribute("aria-hidden", "true");
    plot.append(tag);

    const clipId = "gamble-reveal";
    const defs = el("defs", {}, svg);
    const clip = el("clipPath", { id: clipId }, defs);
    revealRect = el("rect", { x: 0, y: 0, height: size.h, width: size.w * revealed() }, clip);
    const shown = el("g", { "clip-path": `url(#${clipId})` }, svg);
    for (const [cls, model, name] of SERIES) {
      const points = g.settings.filter(s => s.model === model).map(s => ({ s, px: x(s.tokens), py: y(s.shares[pick]) }));
      // The line shades from its least to its most reasoning setting.
      const shade = el("linearGradient", { id: `shade-${cls}`, gradientUnits: "userSpaceOnUse", x1: points[0].px, x2: points.at(-1).px, y1: 0, y2: 0 }, defs);
      el("stop", { offset: 0, "stop-color": color(model, points[0].s.level) }, shade);
      el("stop", { offset: 1, "stop-color": color(model, points.at(-1).s.level) }, shade);
      el("path", { class: `series ${cls}`, stroke: `url(#shade-${cls})`, d: points.map((p, i) => `${i ? "L" : "M"}${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join("") }, shown);
      for (const { s, px, py } of points) {
        const dot = el("circle", { class: `series-dot ${cls}`, fill: color(model, s.level), cx: px, cy: py, r: 3.8 }, shown);
        el("title", {}, dot).textContent = `${name}, ${LEVEL[s.level]}: ${pct(s.shares[pick])} took ${g.options[pick].short}, ${s.tokens} reasoning tokens on average`;
      }
    }
  }

  function label(axis, text, style, extra = "") {
    const node = document.createElement("span");
    node.className = `axis-label ${axis} ${extra}`.trim();
    node.setAttribute("aria-hidden", "true");
    node.textContent = text;
    Object.assign(node.style, style);
    plot.append(node);
  }

  // Frames drive the wipe; a timer finishes it even where frames are throttled.
  function startReveal() {
    stopReveal();
    revealStart = performance.now();
    const step = () => {
      const share = revealed();
      revealRect?.setAttribute("width", String(size.w * share));
      if (share < 1) revealTimer = requestAnimationFrame(step);
    };
    step();
    revealEnd = setTimeout(step, REVEAL_MS + 30);
  }

  function stopReveal() {
    cancelAnimationFrame(revealTimer);
    clearTimeout(revealEnd);
  }

  function takeText() {
    const g = gamble();
    // Only Qwen3 can switch reasoning off, so the per-gamble verdict is about Qwen3;
    // GPT-OSS always reasons and is reported as a range over its effort levels.
    const h = g.higher;
    const most = g.people.shares[0] >= g.people.shares[1] ? 0 : 1;
    const qwen = level => pct(setting(g, "qwen3-32b", level).shares[h]);
    const gpt = g.settings.filter(s => s.model === "gpt-oss-20b").map(s => Math.round(s.shares[h] * 100));
    const lo = Math.min(...gpt);
    const hi = Math.max(...gpt);
    const gptText = lo === hi ? (lo === 100 ? "every time" : `${lo}% of the time`) : `${lo} to ${hi}% of the time`;
    const verdict = most === h
      ? `Most people also took ${g.options[h].short}, so here reasoning made Qwen3 more human.`
      : `Most people took ${g.options[most].short}, so here reasoning made Qwen3 less human.`;
    return { short: verdict, long: `Reasoning moved Qwen3 from ${qwen("none")} to ${qwen("thinking")} on ${g.options[h].short}, the higher average; GPT-OSS took it ${gptText}. ${verdict}` };
  }

  // The panel depends on the gamble, not on the pick, so it is written once per gamble.
  function renderPanel() {
    if (pick === null) {
      panel.innerHTML = "";
      return;
    }
    const q = gamble().quote;
    panel.innerHTML = `<p class="panel-take">${escape(takeText().short)}</p>
      <details class="panel-quote"><summary>How GPT-OSS reasoned</summary><p>${q.tokens} tokens, ${LEVEL[q.level]}: “${escape(q.text)}”</p></details>`;
  }

  // The one live region: the numbers on every pick, the takeaway on the first.
  function describe(withTake = false) {
    const g = gamble();
    const desc = $("#gamble-desc");
    if (pick === null) {
      desc.textContent = "";
      return;
    }
    const share = (model, level) => pct(setting(g, model, level).shares[pick]);
    desc.textContent = `You took ${g.options[pick].short}. So did ${pct(g.people.shares[pick])} of ${g.people.choices} choices by ${g.people.people} people, five each. Qwen3 32B: ${share("qwen3-32b", "none")} without reasoning, ${share("qwen3-32b", "thinking")} with it. GPT-OSS 20B: ${share("gpt-oss-20b", "low")}, ${share("gpt-oss-20b", "medium")} and ${share("gpt-oss-20b", "high")} at low, medium and high effort.${withTake ? ` ${takeText().long}` : ""}`;
  }

  function choose(i) {
    if (i === pick) return;
    const first = pick === null;
    pick = i;
    card.classList.add("has-pick");
    options.querySelectorAll(".gamble-option").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.option) === i)));
    $("#gamble-key-title").textContent = `Took ${gamble().options[i].short}:`;
    if (first) revealStart = performance.now();
    draw();
    if (first) {
      startReveal();
      renderPanel();
    }
    describe(first);
    ctx.actor()?.idle(F.thumbs);
  }

  function load(i, announce = false) {
    index = i % data.gambles.length;
    pick = null;
    stopReveal();
    revealStart = -Infinity;
    card.classList.remove("has-pick");
    renderOptions();
    draw();
    renderPanel();
    describe();
    if (announce) {
      const g = gamble();
      $("#gamble-desc").textContent = `Gamble ${index + 1} of ${data.gambles.length}. ${g.options.map((o, k) => `${"AB"[k]}: ${outcomeLines(o.outcomes).join(", ")}`).join(". ")}.`;
    }
  }

  options.addEventListener("click", event => {
    const button = event.target.closest(".gamble-option");
    if (button) choose(Number(button.dataset.option));
  });
  $("#gamble-next").addEventListener("click", () => {
    if (!data) return;
    load(index + 1, true);
    ctx.actor()?.idle(F.think);
  });

  new ResizeObserver(() => draw()).observe(plot);
  fetch(new URL("../data/llm-gambles.json", import.meta.url))
    .then(response => response.json())
    .then(json => {
      data = json;
      renderPilot();
      load(0);
      $("#gamble-next").disabled = false;
    })
    .catch(() => {
      $(".gamble-empty").textContent = "The pilot data could not load. Reload the page to try again.";
    });

  return {
    pose: F.think,
    enter(actor) {
      actor?.idle(pick === null ? F.think : F.thumbs);
    },
  };
}
