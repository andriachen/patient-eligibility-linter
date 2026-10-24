"""P4 / Phase 2: precision / recall / F1 of the extractor vs. human gold labels.

Compares data/processed/exclusions.csv (the LLM extractor's output) against
eval/gold_labels.csv (human-labeled ground truth, independent of the extractor).

Comparison unit = (nct_id, category). The eval is scoped to the TRIALS that appear
in the gold file (including trials labeled only with a `none` row, which means
"human reviewed it, found nothing"). A category counts as:
  - TP: present in both gold and extraction for that trial
  - FP: present in extraction but not gold  (extractor over-flagged)
  - FN: present in gold but not extraction  (extractor missed)

Writes a per-category + overall table to eval/results.md.

Usage:
    python eval/run_eval.py
"""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GOLD = ROOT / "eval" / "gold_labels.csv"
EXCLUSIONS = ROOT / "data" / "processed" / "exclusions.csv"
RESULTS = ROOT / "eval" / "results.md"
META = ROOT / "eval" / "gold_ids_meta.csv"

# subsets of the gold set, by pick_method in gold_ids_meta.csv
SUBSETS = [
    ("random sample (original 30)", lambda m: m.startswith("random")),
    ("targeted (picked for a category)", lambda m: m.startswith("targeted")),
    ("held-out (prompt never tuned on these)", lambda m: m == "holdout"),
]

# the 13 fixed categories (plus the sentinel "none" used by gold labeling)
CATEGORIES = [
    "diabetes",
    "bmi",
    "smoking",
    "age",
    "renal",
    "hepatic",
    "cardiac",
    "hiv",
    "brain_mets",
    "prior_malignancy",
    "performance_status",
    "language",
    "pregnancy",
]


def _load_pairs(path: Path, category_col: str = "category") -> dict[str, set[str]]:
    """Return {nct_id: {categories...}} from a csv, dropping the `none` sentinel."""
    out: dict[str, set[str]] = defaultdict(set)
    with path.open(newline="") as fh:
        for row in csv.DictReader(fh):
            nct = row["nct_id"].strip()
            cat = (row.get(category_col) or "").strip()
            # register the trial even if its only row is `none`
            out.setdefault(nct, set())
            if cat and cat != "none":
                out[nct].add(cat)
    return out


def _pick_methods() -> dict[str, str]:
    """Return {nct_id: pick_method} from gold_ids_meta.csv."""
    with META.open(newline="") as fh:
        return {row["nct_id"]: row["pick_method"] for row in csv.DictReader(fh)}


def evaluate(only: set[str] | None = None) -> dict:
    gold = _load_pairs(GOLD)
    pred_all = _load_pairs(EXCLUSIONS)

    # scope strictly to labeled trials (optionally narrowed to a subset)
    labeled = set(gold.keys())
    if only is not None:
        labeled &= only
    # trials in gold but never extracted still count (their pred set is empty)
    pred = {nct: pred_all.get(nct, set()) for nct in labeled}

    # per-category tallies
    tp = defaultdict(int)
    fp = defaultdict(int)
    fn = defaultdict(int)
    for nct in labeled:
        g = gold[nct]
        p = pred[nct]
        for cat in CATEGORIES:
            in_g = cat in g
            in_p = cat in p
            if in_g and in_p:
                tp[cat] += 1
            elif in_p and not in_g:
                fp[cat] += 1
            elif in_g and not in_p:
                fn[cat] += 1

    def prf(t: int, f_p: int, f_n: int) -> tuple[float, float, float]:
        prec = t / (t + f_p) if (t + f_p) else float("nan")
        rec = t / (t + f_n) if (t + f_n) else float("nan")
        f1 = (
            2 * prec * rec / (prec + rec)
            if prec == prec and rec == rec and (prec + rec)
            else float("nan")
        )
        return prec, rec, f1

    rows = []
    for cat in CATEGORIES:
        support = tp[cat] + fn[cat]  # gold positives for this category
        prec, rec, f1 = prf(tp[cat], fp[cat], fn[cat])
        rows.append(
            {
                "category": cat,
                "tp": tp[cat],
                "fp": fp[cat],
                "fn": fn[cat],
                "support": support,
                "precision": prec,
                "recall": rec,
                "f1": f1,
            }
        )

    TP = sum(tp.values())
    FP = sum(fp.values())
    FN = sum(fn.values())
    micro = prf(TP, FP, FN)

    # Per-trial (tp, fp, fn) totals, for a bootstrap CI on overall micro F1.
    # Sort trial ids so the list order (and thus the seeded bootstrap) is stable.
    per_trial = []
    for nct in sorted(labeled):
        g, p = gold[nct], pred[nct]
        per_trial.append((len(g & p), len(p - g), len(g - p)))
    ci_lo, ci_hi = _bootstrap_f1_ci(per_trial, prf)

    return {
        "n_trials": len(labeled),
        "rows": rows,
        "micro": {"tp": TP, "fp": FP, "fn": FN, "precision": micro[0], "recall": micro[1], "f1": micro[2]},
        "f1_ci": (ci_lo, ci_hi),
    }


def _bootstrap_f1_ci(per_trial, prf, n_boot: int = 2000, seed: int = 0) -> tuple[float, float]:
    """95% bootstrap CI on overall micro F1 by resampling trials with replacement."""
    import random

    if not per_trial:
        return (float("nan"), float("nan"))
    rng = random.Random(seed)
    n = len(per_trial)
    f1s = []
    for _ in range(n_boot):
        bt = bfp = bfn = 0
        for _ in range(n):
            t, fp_, fn_ = per_trial[rng.randrange(n)]
            bt += t
            bfp += fp_
            bfn += fn_
        _, _, f1 = prf(bt, bfp, bfn)
        if f1 == f1:  # not NaN
            f1s.append(f1)
    if not f1s:
        return (float("nan"), float("nan"))
    f1s.sort()
    return (f1s[int(0.025 * len(f1s))], f1s[int(0.975 * len(f1s))])


def _fmt(x: float) -> str:
    return "-" if x != x else f"{x:.2f}"  # NaN -> "-"


def evaluate_subsets() -> list[tuple[str, dict]]:
    methods = _pick_methods()
    out = []
    for name, match in SUBSETS:
        ids = {nct for nct, m in methods.items() if match(m)}
        res = evaluate(only=ids)
        if res["n_trials"]:
            out.append((name, res))
    return out


def write_results(res: dict, subsets: list[tuple[str, dict]]) -> None:
    lines = [
        "# Evaluation Results (P4, Phase 2)",
        "",
        f"Extractor (`data/processed/exclusions.csv`) vs. human gold labels "
        f"(`eval/gold_labels.csv`), scored at the (trial, category) level over "
        f"**{res['n_trials']} labeled trials**.",
        "",
        "| category | precision | recall | F1 | TP | FP | FN | gold support |",
        "|----------|-----------|--------|----|----|----|----|--------------|",
    ]
    for r in res["rows"]:
        lines.append(
            f"| {r['category']} | {_fmt(r['precision'])} | {_fmt(r['recall'])} | "
            f"{_fmt(r['f1'])} | {r['tp']} | {r['fp']} | {r['fn']} | {r['support']} |"
        )
    m = res["micro"]
    lo, hi = res["f1_ci"]
    lines += [
        f"| **overall (micro)** | **{_fmt(m['precision'])}** | **{_fmt(m['recall'])}** "
        f"| **{_fmt(m['f1'])}** | {m['tp']} | {m['fp']} | {m['fn']} | "
        f"{m['tp'] + m['fn']} |",
        "",
        f"Overall micro F1 **{_fmt(m['f1'])}**, bootstrap 95% CI "
        f"[{_fmt(lo)}, {_fmt(hi)}] (2000 resamples over {res['n_trials']} trials).",
        "",
        "## By subset (overall micro)",
        "",
        "| subset | trials | precision | recall | F1 | F1 95% CI | TP | FP | FN |",
        "|--------|--------|-----------|--------|----|-----------|----|----|----|",
    ]
    for name, s in subsets:
        sm = s["micro"]
        slo, shi = s["f1_ci"]
        lines.append(
            f"| {name} | {s['n_trials']} | {_fmt(sm['precision'])} | {_fmt(sm['recall'])} "
            f"| {_fmt(sm['f1'])} | [{_fmt(slo)}, {_fmt(shi)}] | {sm['tp']} | {sm['fp']} | {sm['fn']} |"
        )
    lines += [
        "",
        "Quote the held-out row as the headline accuracy: the extraction prompt was tuned "
        "while looking at errors on the original set, so those scores are optimistic. "
        "The held-out interval is wide because it is only 10 trials.",
        "",
        "- **Precision** = of the categories the extractor flagged, how many the human agreed with.",
        "- **Recall** = of the categories the human labeled, how many the extractor caught.",
        "- `-` means no instances (no gold positives and no predictions for that category).",
        "- Gold labels are human-made, independent of the extractor model (`claude-haiku-5-5`).",
        "",
        "## Known weak spots (not yet fixed)",
        "",
        "`prior_malignancy` has the lowest recall and accounts for most of the misses "
        "(the model simply never emits the category on those trials). Fixing it needs a "
        "**prompt change**, deliberately not done here: tuning against the held-out errors "
        "would spend the held-out set. If pursued, label a fresh 10 held-out trials first "
        "and quote the new held-out number, not the current one.",
        "",
        "**7 long trials return zero records**, and for 5 the model fails identically every "
        "time (retry does not help), despite a clear restriction in the text — e.g. "
        "NCT07166406 'ECOG 0-2', NCT07297979 'Karnofsky >= 70%', NCT04628767 'must not be "
        "pregnant or breast-feeding'. These are undercounted in the app. A real fix needs a "
        "larger model or splitting inclusion/exclusion into separate calls.",
        "",
        "## Reproduce",
        "",
        "```bash",
        "python eval/run_eval.py   # regenerates this file from exclusions.csv + gold_labels.csv",
        "```",
        "The bootstrap CI uses a fixed seed (0), so these numbers are stable across runs.",
    ]
    RESULTS.write_text("\n".join(lines) + "\n")


def main() -> None:
    res = evaluate()
    subsets = evaluate_subsets()
    write_results(res, subsets)
    # console summary
    print(f"Evaluated {res['n_trials']} gold-labeled trials.\n")
    print(f"{'category':20s} {'prec':>6s} {'rec':>6s} {'f1':>6s} {'sup':>4s}")
    for r in res["rows"]:
        print(
            f"{r['category']:20s} {_fmt(r['precision']):>6s} {_fmt(r['recall']):>6s} "
            f"{_fmt(r['f1']):>6s} {r['support']:>4d}"
        )
    m = res["micro"]
    print(
        f"\n{'OVERALL (micro)':20s} {_fmt(m['precision']):>6s} {_fmt(m['recall']):>6s} "
        f"{_fmt(m['f1']):>6s}   (TP={m['tp']} FP={m['fp']} FN={m['fn']})"
    )
    print()
    for name, s in subsets:
        sm = s["micro"]
        print(
            f"{name:42s} n={s['n_trials']:<3d} prec {_fmt(sm['precision'])}  "
            f"rec {_fmt(sm['recall'])}  f1 {_fmt(sm['f1'])}"
        )
    print(f"\n-> wrote {RESULTS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
