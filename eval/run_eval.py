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


def evaluate() -> dict:
    gold = _load_pairs(GOLD)
    pred_all = _load_pairs(EXCLUSIONS)

    # scope strictly to labeled trials
    labeled = set(gold.keys())
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

    return {
        "n_trials": len(labeled),
        "rows": rows,
        "micro": {"tp": TP, "fp": FP, "fn": FN, "precision": micro[0], "recall": micro[1], "f1": micro[2]},
    }


def _fmt(x: float) -> str:
    return "-" if x != x else f"{x:.2f}"  # NaN -> "-"


def write_results(res: dict) -> None:
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
    lines += [
        f"| **overall (micro)** | **{_fmt(m['precision'])}** | **{_fmt(m['recall'])}** "
        f"| **{_fmt(m['f1'])}** | {m['tp']} | {m['fp']} | {m['fn']} | "
        f"{m['tp'] + m['fn']} |",
        "",
        "- **Precision** = of the categories the extractor flagged, how many the human agreed with.",
        "- **Recall** = of the categories the human labeled, how many the extractor caught.",
        "- `-` means no instances (no gold positives and no predictions for that category).",
        "- Gold labels are human-made, independent of the extractor model (`claude-haiku-5-5`).",
    ]
    RESULTS.write_text("\n".join(lines) + "\n")


def main() -> None:
    res = evaluate()
    write_results(res)
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
    print(f"\n-> wrote {RESULTS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
