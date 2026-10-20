import { Actor, F, art, motion } from "./sprite.js";
import intro from "./scenes/intro.js";
import asd from "./scenes/asd.js";
import sbi from "./scenes/sbi.js";
import llm from "./scenes/llm.js";
import smartcited from "./scenes/smartcited.js";
import cooktree from "./scenes/cooktree.js";
import hello from "./scenes/hello.js";

const MODULES = { intro, asd, sbi, llm, smartcited, cooktree, hello };
const DWELL = 0.24; // share of each scene's scroll during which its card holds still
const SEGMENT = 0.72; // viewport heights of scrolling per scene
const COMMIT = 0.06; // how far into a transition a stop must be before it carries on

const root = document.documentElement;
const track = document.getElementById("track");
const cards = [...document.querySelectorAll(".card")];
const links = [...document.querySelectorAll(".scrubber a")];
const mark = document.querySelector(".scrubber-mark");
const groundLine = document.querySelector(".ground-line");
const walkerElement = document.querySelector(".walker");
const walker = new Actor(walkerElement);
const trackQuery = window.matchMedia("(min-width: 900px) and (min-height: 620px)");
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

// The illustrated Nathan ships; the pixel one is a backup reachable with ?art=pixel.
function applyArt() {
  const name = new URLSearchParams(window.location.search).get("art") === "pixel" ? "pixel" : "illustrated";
  art.current = name;
  root.dataset.art = name;
}
applyArt();


let isTrack = false;
let active = -1;
let position = 0;
let segment = 1;
let cardStep = 1;
let trackTop = 0;
let walked = 0;
let stopTimer = 0;
let centers = [];
let observer = null;
let lastScrollY = 0;
let direction = 0;
let glideTimer = 0;
let glideFrame = 0;
let gliding = false;

const scenes = cards.map((card, index) => {
  const scene = { card, index, cardActor: new Actor(card.querySelector(".card-actor")), api: {} };
  scene.api = MODULES[card.dataset.scene](card, { actor: () => actorFor(scene) }) || {};
  scene.cardActor.idle(scene.api.pose ?? F.stand);
  return scene;
});

function actorFor(scene) {
  if (scene.api.ownsActor) return null;
  if (isTrack) return active === scene.index ? walker : null;
  return scene.cardActor;
}

function applyMotion() {
  motion.reduced = motionQuery.matches;
  root.dataset.motion = motion.reduced ? "reduce" : "full";
}

function markCurrent(index) {
  links.forEach((link, i) => {
    if (i === index) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
}

function enter(index) {
  if (active === index) return;
  leave();
  active = index;
  const scene = scenes[index];
  markCurrent(index);
  walkerElement.classList.toggle("is-away", isTrack && Boolean(scene.api.ownsActor));
  const actor = scene.api.ownsActor ? null : isTrack ? walker : scene.cardActor;
  actor?.idle(scene.api.pose ?? F.stand);
  scene.api.enter?.(actor);
}

function leave() {
  if (active < 0) return;
  scenes[active].api.leave?.();
  active = -1;
  walkerElement.classList.remove("is-away");
}

// Vertical scroll -> continuous scene position, with a still zone around each scene.
function positionAt(scrollY) {
  const raw = Math.min(cards.length - 1, Math.max(0, (scrollY - trackTop) / segment));
  const nearest = Math.round(raw);
  const offset = raw - nearest;
  const distance = Math.abs(offset);
  const half = DWELL / 2;
  if (distance <= half) return nearest;
  // Ease-in-out sine across each transition: gentle start, gentle arrival.
  const t = (distance - half) / (0.5 - half);
  return nearest + Math.sign(offset) * 0.5 * (1 - Math.cos(t * Math.PI / 2));
}

function render() {
  const p = position;
  const between = p - Math.floor(p);
  const zoom = motion.reduced ? 1 : 1 - 0.12 * Math.sin(Math.PI * between);
  cards.forEach((card, i) => {
    const d = i - p;
    const far = Math.abs(d) > 2.4;
    card.style.visibility = far ? "hidden" : "";
    card.classList.toggle("is-off", Math.abs(d) >= 0.5);
    if (far) return;
    const turn = motion.reduced ? 0 : Math.max(-1, Math.min(1, d)) * -9;
    card.style.transform = `translate3d(${(d * cardStep * zoom).toFixed(1)}px,0,0) perspective(1600px) rotateY(${turn.toFixed(2)}deg) scale(${zoom.toFixed(4)})`;
    card.style.setProperty("--caption-o", Math.max(0, 1 - Math.abs(d) * 4).toFixed(3));
  });
  markCurrent(Math.round(p));
  const low = Math.floor(p);
  const high = Math.min(links.length - 1, low + 1);
  mark.style.setProperty("--mark-x", `${(centers[low] + (centers[high] - centers[low]) * (p - low)).toFixed(1)}px`);
  groundLine.style.setProperty("--tick-x", `${((-p * cardStep) % 28).toFixed(1)}px`);
}

// Scroll events already arrive once per frame, so the track updates right here.
function onScroll() {
  if (!isTrack) return;
  if (window.scrollY !== lastScrollY) direction = Math.sign(window.scrollY - lastScrollY);
  lastScrollY = window.scrollY;
  if (!("onscrollend" in window)) {
    clearTimeout(glideTimer);
    glideTimer = setTimeout(glide, 180);
  }
  const next = positionAt(window.scrollY);
  const delta = next - position;
  position = next;
  render();
  if (delta === 0) return;
  if (active >= 0 && Math.abs(next - active) > 0.002) leave();
  if (!motion.reduced) {
    walked += Math.abs(delta) * cardStep;
    walker.stop();
    walker.face(delta);
    walker.set(F.walk[Math.floor(walked / F.stride) % F.walk.length]);
  }
  clearTimeout(stopTimer);
  stopTimer = setTimeout(settle, 140);
}

// When scrolling stops between two cards: carry on in the direction it was going
// if the move was deliberate, otherwise ease back to the card it came from.
function glide() {
  if (!isTrack || gliding) return;
  const p = positionAt(window.scrollY);
  if (p === Math.round(p)) return;
  const base = Math.floor(p);
  const into = p - base;
  let target = Math.round(p);
  if (direction > 0) target = into >= COMMIT ? base + 1 : base;
  if (direction < 0) target = 1 - into >= COMMIT ? base : base + 1;
  goTo(Math.max(0, Math.min(cards.length - 1, target)));
}

// A slower, eased glide than the browser's own smooth scroll. Any input takes over.
function animateTo(y) {
  cancelGlide();
  const start = window.scrollY;
  const distance = y - start;
  if (Math.abs(distance) < 1) return;
  const duration = Math.min(900, Math.max(500, 380 + Math.abs(distance) * 0.8));
  const began = performance.now();
  gliding = true;
  const step = now => {
    const t = Math.min(1, (now - began) / duration);
    window.scrollTo(0, Math.round(start + distance * (0.5 - Math.cos(Math.PI * t) / 2)));
    if (t < 1) glideFrame = requestAnimationFrame(step);
    else gliding = false;
  };
  glideFrame = requestAnimationFrame(step);
}

function cancelGlide() {
  cancelAnimationFrame(glideFrame);
  gliding = false;
}

function settle() {
  const nearest = Math.round(position);
  if (Math.abs(position - nearest) < 0.002) enter(nearest);
  else walker.idle(F.stand);
}

function goTo(index, smooth = !motion.reduced) {
  if (!isTrack) {
    cards[index].scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    return;
  }
  const top = trackTop + index * segment;
  if (smooth) animateTo(top);
  else {
    cancelGlide();
    window.scrollTo(0, top);
  }
}

function observeStack() {
  observer?.disconnect();
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) enter(cards.indexOf(entry.target));
  }, { rootMargin: "-45% 0px -45% 0px" });
  cards.forEach(card => observer.observe(card));
}

function layout() {
  cancelGlide();
  const keep = active >= 0 ? active : Math.round(position);
  isTrack = trackQuery.matches;
  root.classList.toggle("is-track", isTrack);
  if ("scrollRestoration" in history) history.scrollRestoration = isTrack ? "manual" : "auto";
  leave();
  if (!isTrack) {
    track.style.height = "";
    cards.forEach(card => { card.style.transform = ""; card.style.visibility = ""; card.classList.remove("is-off"); });
    observeStack();
    return;
  }
  observer?.disconnect();
  const viewport = window.innerHeight;
  segment = Math.round(Math.max(380, viewport * SEGMENT));
  cardStep = cards[0].offsetWidth + Math.max(40, Math.min(80, window.innerWidth * 0.045));
  track.style.height = `${(cards.length - 1) * segment + viewport}px`;
  trackTop = track.offsetTop;
  centers = links.map(link => link.offsetLeft + link.offsetWidth / 2 - 3);
  window.scrollTo(0, trackTop + keep * segment);
  lastScrollY = window.scrollY;
  position = keep;
  render();
  walker.idle(F.stand);
  settle();
}

// Navigation: scrubber, in-page links, clicking a neighboring card, arrow keys, focus.
document.addEventListener("click", event => {
  const link = event.target.closest('a[href^="#"]');
  if (link) {
    const index = cards.findIndex(card => `#${card.id}` === link.hash);
    if (index >= 0 && isTrack) {
      event.preventDefault();
      goTo(index);
      history.replaceState(null, "", link.hash);
    }
    return;
  }
  const card = event.target.closest(".card.is-off");
  if (card && isTrack) {
    event.preventDefault();
    goTo(cards.indexOf(card));
  }
});
document.addEventListener("keydown", event => {
  if (!isTrack || event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
  if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;
  const current = Math.round(position);
  const forward = event.key === "ArrowRight" || event.key === "PageDown" || (event.key === " " && !event.shiftKey);
  const back = event.key === "ArrowLeft" || event.key === "PageUp" || (event.key === " " && event.shiftKey);
  if (event.key === " " && event.target.closest?.("button, a")) return;
  if (forward) { event.preventDefault(); goTo(Math.min(cards.length - 1, current + 1)); }
  if (back) { event.preventDefault(); goTo(Math.max(0, current - 1)); }
});
document.addEventListener("focusin", event => {
  if (!isTrack) return;
  const card = event.target.closest?.(".card");
  const index = cards.indexOf(card);
  // Wait for the browser's own scroll-into-view, then put the track right.
  if (index >= 0) setTimeout(() => {
    if (index !== Math.round(positionAt(window.scrollY)) || window.scrollY !== trackTop + index * segment) goTo(index, false);
  }, 0);
});

// Phone toolbars resize the window on every scroll; in the stack only a width or mode
// change needs a new layout, otherwise each card's entry would replay.
let resizeFrame = 0;
let layoutWidth = window.innerWidth;
window.addEventListener("resize", () => {
  if (!isTrack && !trackQuery.matches && window.innerWidth === layoutWidth) return;
  layoutWidth = window.innerWidth;
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(layout);
});
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("scrollend", () => { if (isTrack) glide(); });
for (const type of ["wheel", "touchstart", "pointerdown"]) window.addEventListener(type, cancelGlide, { passive: true });
document.addEventListener("keydown", cancelGlide, true);
motionQuery.addEventListener("change", () => { applyMotion(); if (isTrack) render(); });

// The browser's own jump to a #fragment does not know about the track, so re-apply it.
function sceneFromHash() {
  return cards.findIndex(card => `#${card.id}` === window.location.hash);
}
function followHash() {
  const index = sceneFromHash();
  if (index >= 0 && isTrack) goTo(index, false);
}
window.addEventListener("hashchange", followHash);
window.addEventListener("load", () => requestAnimationFrame(followHash));

applyMotion();
position = Math.max(0, sceneFromHash());
layout();
