/* ───────────────────────────────────────────────
   site.js — quiet motion layer
   Name decode-on-load · scroll reveal · nav spy
   (All the engineering instrumentation is gone —
    the field carries the technology now.)
   ─────────────────────────────────────────────── */

(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Name decode-on-load ──────────────────────────── */
  function decode(el) {
    const finalText = el.getAttribute("data-decode");
    if (!finalText) return;
    if (prefersReduced) { el.textContent = finalText; return; }
    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@";
    const dur = 900;
    const start = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const lock = Math.floor(eased * finalText.length);
      let out = "";
      for (let i = 0; i < finalText.length; i++) {
        const ch = finalText[i];
        if (ch === " ") { out += " "; continue; }
        if (i < lock) out += ch;
        else out += glyphs[(Math.random() * glyphs.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = finalText;
    }
    requestAnimationFrame(frame);
  }
  document.querySelectorAll("[data-decode]").forEach((el, i) => {
    setTimeout(() => decode(el), 160 + i * 90);
  });

  /* ── Scroll reveal ────────────────────────────────── */
  if (!prefersReduced && "IntersectionObserver" in window) {
    const reveals = document.querySelectorAll("[data-reveal]");
    reveals.forEach((el) => el.classList.add("reveal-ready"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("reveal-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  }

  /* ── Nav spy — highlight the active section ───────── */
  const links = [...document.querySelectorAll(".topbar nav a[data-spy]")];
  const map = new Map();
  links.forEach((a) => {
    const id = a.getAttribute("href").replace("#", "");
    const sec = document.getElementById(id);
    if (sec) map.set(sec, a);
  });
  if (map.size && "IntersectionObserver" in window) {
    const io2 = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            links.forEach((l) => l.classList.remove("active"));
            const a = map.get(e.target);
            if (a) a.classList.add("active");
          }
        });
      },
      { threshold: 0.4, rootMargin: "-20% 0px -55% 0px" }
    );
    map.forEach((_a, sec) => io2.observe(sec));
  }
})();
