"""P1: Build data/processed/ma_town_county.csv for all 351 MA municipalities.

Pulls the Census 2020 county-subdivision codes for Massachusetts (authoritative,
pipe-delimited) rather than hand-typing 351 towns. Normalizes the subdivision
names (drops the trailing "town"/"city"/"Town city" qualifier) and attaches the
county + county FIPS from the README contract.

Also writes the MANUAL_OVERRIDES used by build_trials.py for ClinicalTrials.gov
site cities that aren't formal municipality names (Boston neighborhoods, villages).

Usage:
    python -m pipeline.ingest.build_crosswalk
"""

from __future__ import annotations

import csv
import io
from pathlib import Path

import requests

CENSUS_URL = (
    "https://www2.census.gov/geo/docs/reference/codes2020/cousub/"
    "st25_ma_cousub2020.txt"
)

OUT_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "processed" / "ma_town_county.csv"
)

# County name -> 5-digit FIPS (from README contract).
COUNTY_FIPS = {
    "Barnstable": "25001",
    "Berkshire": "25003",
    "Bristol": "25005",
    "Dukes": "25007",
    "Essex": "25009",
    "Franklin": "25011",
    "Hampden": "25013",
    "Hampshire": "25015",
    "Middlesex": "25017",
    "Nantucket": "25019",
    "Norfolk": "25021",
    "Plymouth": "25023",
    "Suffolk": "25025",
    "Worcester": "25027",
}

# ClinicalTrials.gov site cities that are not formal municipality names.
# Keys are UPPERCASE, stripped. Values are the canonical municipality name whose
# county should be used. build_trials.py consults the crosswalk first, then these.
MANUAL_OVERRIDES = {
    # Boston neighborhoods -> Suffolk (via Boston)
    "BRIGHTON": "Boston",
    "JAMAICA PLAIN": "Boston",
    "DORCHESTER": "Boston",
    "CHARLESTOWN": "Boston",
    "ROXBURY": "Boston",
    "WEST ROXBURY": "Boston",
    "ROSLINDALE": "Boston",
    "HYDE PARK": "Boston",
    "MATTAPAN": "Boston",
    "ALLSTON": "Boston",
    "EAST BOSTON": "Boston",
    "SOUTH BOSTON": "Boston",
    # Chestnut Hill straddles towns; map to Newton (Middlesex) per README note.
    "CHESTNUT HILL": "Newton",
    # Common village / section names -> parent municipality
    "FEEDING HILLS": "Agawam",
    "BALDWINVILLE": "Templeton",
    "SOUTH WEYMOUTH": "Weymouth",
    "NORTH DARTMOUTH": "Dartmouth",
    "SOUTH DARTMOUTH": "Dartmouth",
    "PITTSFIELD": "Pittsfield",
    "WORCESTER": "Worcester",
    # villages / typos seen in ClinicalTrials.gov site cities
    "HYANNIS": "Barnstable",  # Hyannis is a village of Barnstable
    "NORTH WORCESTER": "Worcester",
    "WELLESLEY HILLS": "Wellesley",  # village of Wellesley (Norfolk)
    "WORESTER": "Worcester",  # misspelling of Worcester
}


def _strip_qualifier(cousub_name: str) -> str:
    """'Barnstable Town city' -> 'Barnstable', 'Boston city' -> 'Boston'."""
    name = cousub_name.strip()
    for suffix in (" Town city", " town", " city", " Town"):
        if name.endswith(suffix):
            name = name[: -len(suffix)]
            break
    return name.strip()


def _county_from_countyname(county_name: str) -> str:
    """'Barnstable County' -> 'Barnstable'."""
    return county_name.replace(" County", "").strip()


def build() -> list[dict]:
    resp = requests.get(CENSUS_URL, timeout=60)
    resp.raise_for_status()
    reader = csv.DictReader(io.StringIO(resp.text), delimiter="|")

    rows: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for rec in reader:
        cousub = rec["COUSUBNAME"]
        if cousub.startswith("County subdivisions not defined"):
            continue
        town = _strip_qualifier(cousub)
        county = _county_from_countyname(rec["COUNTYNAME"])
        fips = COUNTY_FIPS.get(county)
        if fips is None:
            continue  # shouldn't happen for MA
        key = (town.upper(), county)
        if key in seen:
            continue
        seen.add(key)
        rows.append({"town": town, "county": county, "county_fips": fips})

    rows.sort(key=lambda r: (r["county"], r["town"]))
    return rows


def main() -> None:
    rows = build()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["town", "county", "county_fips"])
        writer.writeheader()
        writer.writerows(rows)

    counties = {r["county"] for r in rows}
    print(f"Wrote {len(rows)} municipalities across {len(counties)} counties.")
    print(f"-> {OUT_PATH}")
    if len(counties) != 14:
        print(f"WARNING: expected 14 counties, got {len(counties)}: {sorted(counties)}")


if __name__ == "__main__":
    main()
