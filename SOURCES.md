# Sources and evidence boundaries

## Cognitive models card (SBI)

Source project: `sbi-cognitive-models` (private repository, UC Berkeley CCN Lab, with
Ti-Fen Pan and Anne Collins; builds on Ti-Fen Pan's DL4CM). Results as of October 2026.

- Task and model match the project's simulation (`sbiutils/config.py`, notebook 01,
  DL4CM `PRL` with deterministic feedback and no reversals): six stimuli, three
  actions, 12 blocks of 78 trials (each stimulus shown 13 times in a random order),
  936 trials per learner. RLF has four free parameters with the project's population
  ranges: learning rate α 0.2 to 0.8, inverse temperature β 4 to 16 (stored as β/20),
  forgetting φ 0 to 0.4, stickiness κ −1 to 1. `models.js` reimplements the update:
  decay toward 1/3 by φ, chosen and unchosen updates at α, softmax with κ added to the
  previous action.
- The four hidden learners (#280, #11, #336, #102) are real agents from the project's
  500-learner test set (`rand500_st11`), picked by their true parameters only. Their
  dashed curves are their actual accuracy by presentation (72 trials per point).
  "My network" values are the GRU's estimates for those same learners, trained on
  27,000 simulated learners (`ann_recovery_per_agent_27000a.csv`).
- Match: 100% means as close as the learner's true parameters get (that remaining gap
  is the learner's own sampling noise); it falls to 0% at 0.12 RMSE beyond that.
  "Your learner" averages 300 simulated blocks with a fixed seed.
- Test-set results in the note and caption: across the 500 test learners the network
  recovers α, β, φ, κ with Pearson r = .812, .790, .888, .979 (RMSE .105, .105, .033,
  .136); maximum likelihood on the same learners reaches .784, .714, .599, .972 and MAP
  .839, .785, .891, .983. RLF vs WM identification: 0.951 on 1,000 test learners with
  four features at 27,000 learners per model; the AIC/BIC likelihood benchmark is 0.961.
  The old site's "0.92 vs 0.975" predates the current runs.
- `data/sbi-learners.json` holds exactly these values; the build steps are scripted in
  this session's scratch folder and summarized here.

## ASD connectivity (fMRI card)

Li, Zuo, Cheng, Perkins, and Cao (2026), "Two clusters of brain regions with
distinct age-related profiles of functional connectivity in autism spectrum
disorder," PNAS 123(42), e2617358123. <https://doi.org/10.1073/pnas.2617358123>.

The chart plots the paper's own numbers: SI Appendix Table S8, the cluster-level
functional connectivity strength (FCS) difference between autistic and typically
developing participants (diagnosis effect t, with p) in 40 overlapping age windows:
2-year windows stepping by 0.5 years from 6 to 26, then 25 to 30, 30 to 40 and 40 to 64.
The rows were not hand-copied: they were parsed from the accepted revision text
kept in Nathan's vault (`NeuroLeaD Lab/ASD Brain Age研究计划/Paperwork/PNAS Revision 1`)
into `data/asd-trajectories.json`. Spot-check against the published SI before launch.

- Dots are the raw window values, filled when p < .05 uncorrected, which is how the
  paper reports these windows. No cluster-level window survives FDR correction.
- Lines are a centered five-window moving average over the dense windows; the three
  broad adult windows are drawn raw. The readout always shows the raw window.
- Age axis: 6 to 26 is linear over 80% of the width, 26 to 64 is log-compressed.
- Regions follow the Results text. Cluster 1 (persistent): posterior sensory and
  sensorimotor cortex, including visual and parieto-occipital regions; most frequent
  differences in the precuneus, postcentral gyrus, supramarginal gyrus, lateral occipital
  cortex and posterior cingulate. Cluster 2 (catches up): higher-order association
  cortex, particularly frontal and temporal, with anterior and medial prefrontal DMN.
  The brain icons are simplified drawings, not the paper's maps.
- Sample: 2,608 participants aged 5.2 to 64.0 (753 ASD and 1,020 TD; 311 ADHD and
  524 TD for the ADHD comparison). Each window is a different group of people.

Caption facts (dates January 2025 to January 2026, the lab's first HPC preprocessing
pipeline, about 3,200 subject records, drafted Methods subsections) come from
Nathan's recommender brief for Prof. Fan Cao.

## Thesis pilot (LLMs card)

Source project: `cot-human-likeness` (private repository; honors thesis, HKU
Machine-Augmented Cognition Lab, supervisor Prof. Jian-Qiao Zhu). Pilot 1 ran on
October 11, 2026 and was analyzed by task on October 18; the full run is deferred.
`scripts/export_gambles.py` writes `data/llm-gambles.json` from the repository's
`data/eml/peterson2021using/exp1/` (items, people's choices) and
`results/runs/items/<model>/<level>/` (scores and replies). Nothing is generated live.

- Task: the choices13k gamble pairs in Psych-101 (Peterson et al., 2021; Binz et al.,
  [Psych-101](https://huggingface.co/datasets/marcelbinz/Psych-101), recorded by the
  project as Apache-2.0). The pilot used 100 stratified pairs. Points are hypothetical.
- Models and settings: Qwen3 32B without and with thinking; GPT-OSS 20B at low, medium
  and high reasoning effort. Ten replies per pair per setting, options shuffled per
  reply, identical prompt at every setting; 4,998 of 5,000 replies were scored (two
  high-effort refusals dropped). One medium-effort reply gave no answer but the
  vendored CogGym parser scored it as a choice; it changes no displayed number.
  Token counts are gamble-only, so they differ from the vault's pooled pilot table
  (Qwen3 950, GPT-OSS 44, 184, 628 across both pilot tasks).
- Left column: share of replies (or of people, averaged over pairs) that took the
  option with the higher expected value: people 63%, Qwen3 63% without reasoning and
  97% with it, GPT-OSS 93%, 98%, 99%. Human-likeness is the share of people who chose
  the same option as a reply, averaged over replies. On the 74 pairs where most
  people took the higher expected value it rises from .565 (Qwen3 without reasoning)
  to .69 to .70 with reasoning; on the 25 where most people took the other option it
  falls from .483 to .40 to .43. One pair is an exact 50/50 split and is left out of
  both counts (the thesis analysis groups it with the 26 off-norm pairs). The thesis
  regression gives within-item slopes of +0.020 and −0.013. These are averages: per
  pair, Qwen3 with reasoning was more human on 54 of the 74 and unchanged on 20, and
  less human on 17 of the 25.
- The four gambles (c13k_0838, c13k_1583, c13k_1602, c13k_0347) were picked to be
  easy to read and to show a clear Qwen3 shift: two where most people take the higher
  expected value and two where they do not. c13k_1527 (82% of people avoid the higher
  average) was dropped because Qwen3 moved only from 7 to 8 of 10 replies there. People's shares are from `human_data_mean.json`: the no-feedback
  choices, five per participant (for example 65 choices by 13 people), so the card
  says "People 71%" and never "65 people". The shares are exported unrounded so the
  two options always add to 100%. Each model point is that setting's ten
  replies on that gamble at their mean reasoning-token count.
- Per-gamble sentence: only Qwen3 can switch reasoning off, so the verdict ("more
  human" or "less human" here) is about Qwen3; GPT-OSS is reported as a range over
  its effort levels.
- Quotes: for each gamble, the shortest GPT-OSS 20B low-effort reasoning that saw the
  options in their original order (so its A and B match the card), chose the higher
  expected value, and states both expected values. Words are verbatim; only spacing
  around operators, × for `*` and the minus sign were set.
- One gamble cannot establish a result, and the pilot is not the thesis result. The
  visitor's pick never leaves the browser.

## Products

- [SmartCited](https://smartcited.com/#/scan/sample): the café, its website, the
  review and the AI answers are fictional. The 62.7% of 630 answers figure is from the
  root site's description of the SmartCited study. The demo never publishes anything.
- [CookTree](https://cooktree-webmcp.vercel.app/): the two recipes and the ingredient
  tree are a local sketch of the concept. No Agent, WebMCP call, cart or purchase.
  Source: <https://github.com/aliccee/cooktree-webmcp>.
- "Also built" one-liners (PivotBridge.AI, Welldify, Everyone At Once, VStandby Studio)
  are shortened from the root site.

## Art direction

- [rauno.me](https://rauno.me/): the scroll mechanics (vertical scroll moving a
  horizontal strip, peeking neighbors, a pull-back between cards). Nothing is copied:
  layout, type, scrubber, ground line and character are original.
- [Rauno, Designing Depth](https://rauno.me/craft/depth): layers express relationships.
- [Emil Kowalski, You don't need animations](https://emilkowal.ski/ui/you-dont-need-animations):
  motion explains or responds; nothing loops while idle except a rare blink.
