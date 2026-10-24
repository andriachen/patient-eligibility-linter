"""Shared helpers for the P1 per-site RECRUITING filter tests.

Parses the P1 contract CSVs with csv.DictReader (NOT wc -l) because
trials.csv eligibility_text contains embedded newlines, so a line count
does not equal a row count.
"""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
TRIALS_CSV = PROCESSED / "trials.csv"
SITES_CSV = PROCESSED / "trial_sites.csv"
RAW_DIR = ROOT / "data" / "raw" / "ctgov"

SITES_CONTRACT = ["nct_id", "facility", "city", "zip", "county", "county_fips"]


def read_rows(path: Path) -> list[dict]:
    with path.open(newline="") as fh:
        return list(csv.DictReader(fh))


def distinct_nct_ids(rows: list[dict]) -> set[str]:
    return {r["nct_id"] for r in rows if r.get("nct_id")}
