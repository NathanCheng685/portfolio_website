"""Export the LLMs card data from the thesis repository (cot-human-likeness).

Four gambles from the pilot (choices13k, 100 pairs) with people's choices, each
model setting's choices and reasoning length, one short reasoning quote, and the
pilot summary over all 100 pairs. Run: python scripts/export_gambles.py <repo>
"""
import argparse
import csv
import json
import re
import statistics
from collections import defaultdict
from pathlib import Path

EXPERIMENT = "peterson2021using"
# Shown in this order; short names are how the takeaway refers to each option.
GAMBLES = {
    "c13k_0838": ["the sure 13", "the gamble"],
    "c13k_1583": ["the sure 26", "the gamble"],
    "c13k_1602": ["the sure 3", "the gamble"],
    "c13k_0347": ["the likelier win", "the long shot"],
}
SETTINGS = [("qwen3-32b", "none"), ("qwen3-32b", "thinking"),
            ("gpt-oss-20b", "low"), ("gpt-oss-20b", "medium"), ("gpt-oss-20b", "high")]
OUTCOME = re.compile(r"(-?[\d.]+) points with ([\d.]+)% (?:chance|probability)")


def outcomes(text):
    found = [(float(v), float(p) / 100) for v, p in OUTCOME.findall(text)]
    kept = [{"value": v, "p": p} for v, p in found if p > 0]
    assert abs(sum(o["p"] for o in kept) - 1) < 1e-6, text
    return sorted(kept, key=lambda o: -o["p"])


def people_count(choices):
    assert choices % 5 == 0, choices
    return choices // 5


def number(x):
    return f"{x:g}" if abs(x - round(x, 2)) < 1e-9 else f"{x:.2f}"


# Layout only: spacing around operators and a typographic minus. The words are the model's.
def tidy(text):
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s*\*\s*", " × ", text)
    text = re.sub(r"\s*([=+>])\s*", r" \1 ", text)
    text = re.sub(r"(?<=[\d)])\s*-\s*(?=[\d(])", " − ", text)
    text = re.sub(r"(?<![\w.])-(?=\d)", "−", text)
    return re.sub(r" {2,}", " ", text)


def export(source, destination):
    base = source / "data/eml" / EXPERIMENT / "exp1"
    trials = {t["id"]: t for t in map(json.loads, (base / "trial.jsonl").read_text().splitlines())}
    human = json.loads((base / "human_data_mean.json").read_text())
    scores = []
    for path in sorted((source / "results/runs/items").glob("*/*/scores_s0of1.csv")):
        with path.open() as handle:
            scores += [r for r in csv.DictReader(handle) if r["experiment"] == EXPERIMENT]
    valid = [r for r in scores if r["parse_error"] == "False"]
    by_item = defaultdict(list)
    for r in valid:
        by_item[(r["trial_id"], r["model"], r["level"])].append(r)

    # People's share choosing the higher expected value, per pair.
    people_higher = {}
    for trial_id, trial in trials.items():
        if trial_id not in {r["trial_id"] for r in valid}:
            continue
        shares = list(human[trial_id]["choice"].values())
        people_higher[trial_id] = shares[trial["metadata"]["normative_index"]]
    # Pairs where most people took the higher expected value, and where most took the
    # lower one; an exact 50/50 split belongs to neither.
    on_norm = {t for t, share in people_higher.items() if share > 0.5}
    off_norm = {t for t, share in people_higher.items() if share < 0.5}

    summary = []
    for model, level in SETTINGS:
        rows = [r for r in valid if r["model"] == model and r["level"] == level]
        like = lambda rs: round(statistics.mean(float(r["human_prob_of_choice"]) for r in rs), 4)
        summary.append({
            "model": model, "level": level, "replies": len(rows),
            "higher": round(statistics.mean(float(r["normative"]) for r in rows), 4),
            "like": like(rows),
            "likeOn": like([r for r in rows if r["trial_id"] in on_norm]),
            "likeOff": like([r for r in rows if r["trial_id"] in off_norm]),
            "medianTokens": statistics.median(int(r["reasoning_tokens"]) for r in rows),
        })

    replies = {}
    for line in (source / "results/runs/items/gpt-oss-20b/low/replies_s0of1.jsonl").read_text().splitlines():
        reply = json.loads(line)
        if reply["trial_id"] in GAMBLES:
            replies[(reply["trial_id"], reply["rep"])] = reply

    gambles = []
    for trial_id, short in GAMBLES.items():
        trial = trials[trial_id]
        meta = trial["metadata"]
        texts = trial["queries"][0]["option"]
        higher = meta["normative_index"]
        settings = []
        for model, level in SETTINGS:
            rows = by_item[(trial_id, model, level)]
            picks = [int(float(r["choice_index"])) for r in rows]
            settings.append({
                "model": model, "level": level, "n": len(rows),
                "shares": [round(picks.count(i) / len(picks), 3) for i in range(2)],
                "tokens": int(statistics.mean(int(r["reasoning_tokens"]) for r in rows) + 0.5),
            })
        # Shortest low-effort reasoning that kept the options in their original order,
        # chose the higher expected value, and states both expected values correctly.
        evs = [number(v) for v in meta["ev"]]
        candidates = []
        for r in by_item[(trial_id, "gpt-oss-20b", "low")]:
            reply = replies[(trial_id, int(r["rep"]))]
            text = reply["reasoning"]
            if reply["perm"] == [0, 1] and r["normative"] == "1.0" and all(re.search(rf"(?<![\d.]){re.escape(ev)}(?![\d])", text) for ev in evs):
                candidates.append((len(text), int(r["reasoning_tokens"]), text))
        assert candidates, trial_id
        _, quote_tokens, quote = min(candidates)
        gambles.append({
            "id": trial_id,
            "options": [{"text": t, "short": s, "ev": ev, "outcomes": outcomes(t)} for t, s, ev in zip(texts, short, meta["ev"])],
            "higher": higher,
            # n_human counts choices: each participant without feedback chose the pair five times.
            "people": {"choices": meta["n_human"], "people": people_count(meta["n_human"]),
                       "shares": [round(v, 6) for v in human[trial_id]["choice"].values()]},
            "settings": settings,
            "quote": {"model": "gpt-oss-20b", "level": "low", "tokens": quote_tokens, "text": tidy(quote)},
        })

    payload = {
        "source": "cot-human-likeness pilot (run 2026-10-11, analyzed 2026-10-18), choices13k pairs from Psych-101",
        "summary": {
            "gambles": len(people_higher), "onNorm": len(on_norm), "offNorm": len(off_norm),
            "tied": len(people_higher) - len(on_norm) - len(off_norm),
            "peopleHigher": round(statistics.mean(people_higher.values()), 4),
            "settings": summary,
        },
        "gambles": gambles,
    }
    destination.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n")
    print(f"Wrote {len(gambles)} gambles and the {len(people_higher)}-pair summary to {destination}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "data/llm-gambles.json")
    arguments = parser.parse_args()
    export(arguments.source, arguments.output)
