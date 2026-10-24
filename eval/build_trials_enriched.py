"""Sub-Aim 2: build data/processed/trials_enriched.json — the matcher's runtime index.

One record per trial, joining on nct_id:
  trials.csv       -> title, phase, lead_sponsor, min_age, max_age, conditions
  exclusions.csv   -> the barriers to test a patient against
  trial_sites.csv  -> MA sites (facility, city, zip, county, county_fips)

The matcher (Aim 1, TypeScript, Vercel-native) reads THIS single file at query time —
no CSV parsing, no LLM, no network. `eligibility_text` is intentionally omitted (it is
~18k chars/trial; the app shows each flag's `source_text` instead).

Keep in sync with exclusions.csv — rebuilt automatically at the end of
pipeline.extract.extract.write_exclusions(), same pattern as stats.json.

Usage (from repo root):
    python eval/build_trials_enriched.py
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
OUT = PROCESSED / "trials_enriched.json"


def _read(name: str) -> list[dict]:
    with (PROCESSED / name).open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def _num(s: str):
    """'18' -> 18, '0.5' -> 0.5, '' -> None."""
    s = (s or "").strip()
    if not s:
        return None
    try:
        f = float(s)
        return int(f) if f == int(f) else f
    except ValueError:
        return None


def _load_tags() -> dict:
    """Load trial_tags.json (cancer_types + normalized age) if present."""
    p = PROCESSED / "trial_tags.json"
    if not p.exists():
        return {}
    return json.loads(p.read_text())


def build() -> list[dict]:
    trials = _read("trials.csv")
    tags = _load_tags()

    # group exclusions + sites by nct_id
    excl_by: dict[str, list[dict]] = defaultdict(list)
    for r in _read("exclusions.csv"):
        excl_by[r["nct_id"]].append(
            {
                "category": r["category"],
                "threshold": r["threshold"] or None,
                "absolute": r["absolute"].strip().lower() == "true",
                "section": r["section"],
                "source_text": r["source_text"],
            }
        )

    sites_by: dict[str, list[dict]] = defaultdict(list)
    for r in _read("trial_sites.csv"):
        sites_by[r["nct_id"]].append(
            {
                "facility": r["facility"],
                "city": r["city"],
                "zip": r["zip"],
                "county": r["county"],
                "county_fips": r["county_fips"],
            }
        )

    records = []
    for t in trials:
        nct = t["nct_id"]
        exclusions = excl_by.get(nct, [])
        tag = tags.get(nct, {})
        # LLM-tagged cancer types + age range (tag_trials.py). Prefer tagged age
        # (normalizes compound rules); fall back to the raw trials.csv age.
        records.append(
            {
                "nct_id": nct,
                "title": t.get("title", ""),
                "phase": t.get("phase", ""),
                "lead_sponsor": t.get("lead_sponsor", ""),
                "conditions": [c for c in (t.get("conditions") or "").split(";") if c],
                "cancer_types": tag.get("cancer_types", ["any_cancer"]),
                "min_age": tag.get("age_min", _num(t.get("min_age"))),
                "max_age": tag.get("age_max", _num(t.get("max_age"))),
                "exclusions": exclusions,
                "exclusion_categories": sorted({e["category"] for e in exclusions}),
                "sites": sites_by.get(nct, []),
                "counties": sorted({s["county"] for s in sites_by.get(nct, []) if s["county"]}),
            }
        )
    return records


def main() -> None:
    records = build()
    OUT.write_text(json.dumps(records, indent=2) + "\n")

    n_excl = sum(len(r["exclusions"]) for r in records)
    n_sites = sum(len(r["sites"]) for r in records)
    with_site = sum(1 for r in records if r["sites"])
    size_kb = OUT.stat().st_size // 1024
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(records)} trials, {size_kb} KB")
    print(f"  {n_excl} exclusion rows embedded, {n_sites} site rows, {with_site} trials with >=1 MA site")


if __name__ == "__main__":
    main()
