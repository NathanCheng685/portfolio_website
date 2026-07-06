// Tweaks layer for the Neural Field portfolio. The page body is plain
// HTML — this React app writes CSS variables / body attributes to retint
// and re-densify everything (including the live neural canvas) on change.

const { useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "aurora",
  "accent": "#5be0bf",
  "synapse": "#7ec9ff",
  "type": "editorial",
  "density": "balanced",
  "motion": true,
  "field": true
}/*EDITMODE-END*/;

// dark palettes — each tunes the atmosphere + base inks
const PALETTES = {
  field: {
    label: "Field",
    bg: "#07070d",
    warm: "36,18,12", cool: "22,26,52",
    ink: "#f1ebdf", soft: "#b4adbe", faint: "#757081",
    rule: "rgba(241,235,223,0.10)",
    accent: "#ef8354", synapse: "#97a6ff",
  },
  aurora: {
    label: "Aurora",
    bg: "#05090c",
    warm: "10,40,42", cool: "16,40,60",
    ink: "#eaf3ee", soft: "#a6bcb6", faint: "#6c7d78",
    rule: "rgba(234,243,238,0.10)",
    accent: "#5be0bf", synapse: "#7ec9ff",
  },
  ember: {
    label: "Ember",
    bg: "#0c0705",
    warm: "60,22,10", cool: "40,18,28",
    ink: "#f6ece2", soft: "#c2afa3", faint: "#86736a",
    rule: "rgba(246,236,226,0.11)",
    accent: "#ff7a4d", synapse: "#ffb27a",
  },
  violet: {
    label: "Violet",
    bg: "#08060f",
    warm: "34,16,46", cool: "20,22,56",
    ink: "#efe9f7", soft: "#b6acc7", faint: "#766e8a",
    rule: "rgba(239,233,247,0.10)",
    accent: "#c98bff", synapse: "#8ea0ff",
  },
  ink: {
    label: "Ink",
    bg: "#080a0d",
    warm: "18,24,32", cool: "20,30,44",
    ink: "#eef2f6", soft: "#a7b0bc", faint: "#6a7480",
    rule: "rgba(238,242,246,0.10)",
    accent: "#e8e2d4", synapse: "#7e93c4",
  },
};

const TYPE_PAIRS = {
  editorial: {
    label: "Editorial",
    display: "'Newsreader', Georgia, serif",
    body: "'Geist', system-ui, sans-serif",
    mono: "'Geist Mono', ui-monospace, monospace",
    italic: true,
  },
  display: {
    label: "Display",
    display: "'Instrument Serif', Georgia, serif",
    body: "'Geist', system-ui, sans-serif",
    mono: "'Geist Mono', ui-monospace, monospace",
    italic: true,
  },
  modern: {
    label: "Modern",
    display: "'Newsreader', Georgia, serif",
    body: "'Inter Tight', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    italic: false,
  },
};

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return "151,166,255";
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
}

function applyTweaks(t) {
  const r = document.documentElement;
  const pal = PALETTES[t.palette] || PALETTES.field;
  const accent = t.accent || pal.accent;
  const synapse = t.synapse || pal.synapse;

  r.style.setProperty('--bg', pal.bg);
  r.style.setProperty('--bg-warm', pal.warm);
  r.style.setProperty('--bg-cool', pal.cool);
  r.style.setProperty('--ink', pal.ink);
  r.style.setProperty('--soft', pal.soft);
  r.style.setProperty('--faint-solid', pal.faint);
  r.style.setProperty('--rule', pal.rule);
  r.style.setProperty('--accent', accent);
  r.style.setProperty('--accent-2', synapse);
  r.style.setProperty('--epigraph-ink', pal.ink);

  // neural field channels
  const accentRgb = hexToRgb(accent);
  const synapseRgb = hexToRgb(synapse);
  r.style.setProperty('--nf-node', synapseRgb);
  r.style.setProperty('--nf-link', synapseRgb);
  r.style.setProperty('--nf-ember', accentRgb);
  r.style.setProperty('--nf-cursor', accentRgb);

  const tp = TYPE_PAIRS[t.type] || TYPE_PAIRS.editorial;
  r.style.setProperty('--font-display', tp.display);
  r.style.setProperty('--font-body', tp.body);
  r.style.setProperty('--font-mono', tp.mono);
  r.style.setProperty('--display-style', tp.italic ? 'italic' : 'normal');

  document.body.setAttribute('data-nf-density', t.density || 'balanced');
  document.body.setAttribute('data-nf-motion', t.motion === false ? 'off' : 'on');
  document.body.classList.toggle('no-field', t.field === false);

  if (typeof window.__neuralRefresh === 'function') window.__neuralRefresh();
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  useEffect(() => { applyTweaks(t); }, [t]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Palette">
        <TweakRadio
          label="Mood"
          value={t.palette}
          onChange={v => setTweak({ palette: v, accent: PALETTES[v].accent, synapse: PALETTES[v].synapse })}
          options={[
            { value: "field", label: "Field" },
            { value: "aurora", label: "Aurora" },
            { value: "ember", label: "Ember" },
            { value: "violet", label: "Violet" },
            { value: "ink", label: "Ink" },
          ]}
        />
        <TweakColor
          label="Accent"
          value={t.accent}
          onChange={v => setTweak('accent', v)}
          options={["#ef8354", "#5be0bf", "#ff7a4d", "#c98bff", "#e8e2d4"]}
        />
        <TweakColor
          label="Synapse"
          value={t.synapse}
          onChange={v => setTweak('synapse', v)}
          options={["#97a6ff", "#7ec9ff", "#ffb27a", "#8ea0ff", "#7e93c4"]}
        />
      </TweakSection>

      <TweakSection title="Typography">
        <TweakRadio
          label="Pairing"
          value={t.type}
          onChange={v => setTweak('type', v)}
          options={[
            { value: "editorial", label: "Editorial" },
            { value: "display", label: "Display" },
            { value: "modern", label: "Modern" },
          ]}
        />
      </TweakSection>

      <TweakSection title="Neural Field">
        <TweakRadio
          label="Density"
          value={t.density}
          onChange={v => setTweak('density', v)}
          options={[
            { value: "sparse", label: "Sparse" },
            { value: "balanced", label: "Balanced" },
            { value: "dense", label: "Dense" },
          ]}
        />
        <TweakToggle
          label="Living motion"
          value={t.motion !== false}
          onChange={v => setTweak('motion', v)}
        />
        <TweakToggle
          label="Show field"
          value={t.field !== false}
          onChange={v => setTweak('field', v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

applyTweaks(TWEAK_DEFAULTS);

const root = ReactDOM.createRoot(document.getElementById('tweaks-root'));
root.render(<App />);
