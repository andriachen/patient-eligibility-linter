"""P2: Build pipeline/extract/sample_trials.json — 10 trials for the dev loop.

Prefers sampling from P1's data/processed/trials.csv (no API cost). Picks trials
with longer eligibility text so the sample exercises many categories. Falls back
to the ClinicalTrials.gov v2 API if trials.csv is absent.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRIALS_CSV = ROOT / "data" / "processed" / "trials.csv"
OUT = Path(__file__).resolve().parent / "sample_trials.json"
N = 10

API_URL = "https://clinicaltrials.gov/api/v2/studies"


def _from_csv() -> list[dict]:
    rows = []
    with TRIALS_CSV.open(newline="") as fh:
        for r in csv.DictReader(fh):
            text = (r.get("eligibility_text") or "").strip()
            if text:
                rows.append({"nct_id": r["nct_id"], "eligibility_text": text})
    # longer text tends to cover more categories -> better prompt exercise
    rows.sort(key=lambda x: len(x["eligibility_text"]), reverse=True)
    return rows[:N]


def _from_api() -> list[dict]:
    import requests

    params = {
        "query.locn": "Massachusetts",
        "query.cond": "cancer",
        "filter.overallStatus": "RECRUITING",
        "pageSize": N,
        "fields": "NCTId,EligibilityCriteria",
    }
    resp = requests.get(API_URL, params=params, timeout=60)
    resp.raise_for_status()
    out = []
    for s in resp.json().get("studies", []):
        ps = s.get("protocolSection", {})
        nct = ps.get("identificationModule", {}).get("nctId", "")
        text = ps.get("eligibilityModule", {}).get("eligibilityCriteria", "")
        if nct and text.strip():
            out.append({"nct_id": nct, "eligibility_text": text.strip()})
    return out[:N]


def main() -> None:
    if TRIALS_CSV.exists():
        sample = _from_csv()
        src = "trials.csv"
    else:
        sample = _from_api()
        src = "ClinicalTrials.gov API"
    if not sample:
        print("No trials available to sample.", file=sys.stderr)
        raise SystemExit(1)
    OUT.write_text(json.dumps(sample, indent=2))
    print(f"Wrote {len(sample)} trials from {src} -> {OUT.name}")
    for t in sample:
        print(f"  {t['nct_id']}  ({len(t['eligibility_text'])} chars)")


if __name__ == "__main__":
    main()
