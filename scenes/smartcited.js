import { F } from "../sprite.js";

// A fictional café. Fixing the café's own page changes what the AI can say.
const SOURCES = {
  1: {
    kind: "01 · The café's own website",
    url: "juniper.example",
    before: { quote: "“Find a quiet corner upstairs.”", status: "Missing hours, Wi-Fi", ok: false, note: "This is the page the AI leans on most, but it skips what people actually ask about." },
    after: { quote: "“Quiet upstairs room. Free Wi-Fi. Open 7 am to 9 pm daily.”", status: "Complete", ok: true, note: "Clear facts on the café's own page give the AI something concrete to cite." },
  },
  2: {
    kind: "02 · Customer review",
    url: "reviews.example / juniper-coffee",
    before: { quote: "“Plenty of outlets by the window. Great for laptops.”", status: "Fine as is", ok: true, note: "Reviews are harder to change. SmartCited starts with what the business controls." },
  },
};

export default function smartcited(card, ctx) {
  const $ = selector => card.querySelector(selector);
  const fixButton = $("#smart-fix");
  let fixed = false;
  let active = 1;

  function answerHTML() {
    const cite = n => `<button type="button" class="cite" data-cite="${n}" aria-pressed="${n === active}" aria-label="Source ${n}">${n}</button>`;
    return fixed
      ? `Try <strong>Juniper Coffee</strong>. There's a <mark class="changed">quiet upstairs room with free Wi-Fi, open until 9 pm</mark>${cite(1)} and <mark>plenty of outlets</mark>${cite(2)}.`
      : `Try <strong>Juniper Coffee</strong>. There's a <mark>quiet upstairs room</mark>${cite(1)} and <mark>plenty of outlets</mark>${cite(2)}. I couldn't find its hours, so check before you go.`;
  }

  function render() {
    $("#smart-answer").innerHTML = answerHTML();
    const source = SOURCES[active];
    const state = active === 1 && fixed ? source.after : source.before;
    $("#smart-source-kind").textContent = source.kind;
    $("#smart-source-url").textContent = source.url;
    $("#smart-source-quote").textContent = state.quote;
    $("#smart-source-note").textContent = state.note;
    const status = $("#smart-source-status");
    status.textContent = state.status;
    status.classList.toggle("ok", state.ok);
    fixButton.hidden = active !== 1;
    fixButton.textContent = fixed ? "Show the original page" : "Add hours and Wi-Fi to the website";
  }

  $("#smart-answer").addEventListener("click", event => {
    const button = event.target.closest(".cite");
    if (!button) return;
    active = Number(button.dataset.cite);
    render();
    card.querySelector(`.cite[data-cite="${active}"]`)?.focus({ preventScroll: true });
    ctx.actor()?.play([F.phoneB, F.phoneA], { fps: 5, rest: F.phoneA });
  });
  fixButton.addEventListener("click", () => {
    fixed = !fixed;
    render();
    if (fixed) ctx.actor()?.play([F.phoneB, F.phoneA, F.thumbs], { fps: 3, rest: F.phoneA });
  });

  render();

  return {
    pose: F.phoneA,
    enter(actor) {
      actor?.play([F.phoneA, F.phoneB], { fps: 4, times: 3, rest: F.phoneA });
    },
  };
}
