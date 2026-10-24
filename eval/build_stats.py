"""Build data/processed/stats.json for the app's Landscape tab.

Share of trials with at least one restriction per category, from exclusions.csv
over all trials in trials.csv. Also writes the headline the Landscape page shows.

Usage (from repo root):
    python eval/build_stats.py
"""
import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"

LABELS = {
    "diabetes": "Diabetes", "bmi": "BMI", "smoking": "Smoking", "age": "Age",
    "renal": "Renal", "hepatic": "Hepatic", "cardiac": "Cardiac", "hiv": "HIV",
    "brain_mets": "Brain metastases", "prior_malignancy": "Prior malignancy",
    "performance_status": "Performance status", "language": "Language",
    "pregnancy": "Pregnancy",
}

HEADLINE_CATEGORY = "hiv"


def read_csv(name: str) -> list[dict]:
    with open(PROCESSED / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    trial_ids = {r["nct_id"] for r in read_csv("trials.csv")}
    any_rows, absolute_rows = defaultdict(set), defaultdict(set)
    for r in read_csv("exclusions.csv"):
        if r["nct_id"] not in trial_ids:
            continue
        any_rows[r["category"]].add(r["nct_id"])
        if r["absolute"].strip().lower() == "true":
            absolute_rows[r["category"]].add(r["nct_id"])

    total = len(trial_ids)
    pct = lambda ids: round(100 * len(ids) / total, 1)
    categories = [
        {"category": c, "label": label, "pctExcluded": pct(any_rows[c]),
         "trialCount": len(any_rows[c]), "pctAbsolute": pct(absolute_rows[c])}
        for c, label in LABELS.items()
    ]

    head = next(c for c in categories if c["category"] == HEADLINE_CATEGORY)
    stats = {
        "totalTrials": total,
        "defaultCategory": HEADLINE_CATEGORY,
        "headline": f"{head['pctExcluded']}% of recruiting MA cancer trials restrict "
                    f"people with HIV, despite FDA guidance to include them",
        "headlineNote": f"{head['pctAbsolute']}% exclude outright; the rest set conditions "
                        f"(e.g. CD4 count, viral load). Sources: ClinicalTrials.gov; "
                        f"FDA 2020 guidance on HIV, HBV and HCV in cancer trials.",
        "categories": categories,
    }
    out = PROCESSED / "stats.json"
    out.write_text(json.dumps(stats, indent=2) + "\n")
    print(f"Wrote {out.relative_to(ROOT)}: {total} trials")
    print(f"  {stats['headline']}")
    for c in sorted(categories, key=lambda c: -c["pctExcluded"]):
        print(f"  {c['category']:<20}{c['pctExcluded']:>6}%  ({c['trialCount']})")


if __name__ == "__main__":
    main()
