"""P1: Flatten raw ctgov pages into trials.csv and trial_sites.csv.

Reads data/raw/ctgov/page_*.json (written by fetch_trials.py), flattens the
nested protocolSection into the two P1 contract CSVs, keeps only Massachusetts
sites, and joins each site city to a county via ma_town_county.csv (with the
MANUAL_OVERRIDES from build_crosswalk.py).

Prints every MA site city that failed to match so the override dict can be
extended. "Done" per the plan = unmatched-city list is empty.

Usage:
    python -m pipeline.ingest.build_trials
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

from pipeline.ingest.build_crosswalk import MANUAL_OVERRIDES

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw" / "ctgov"
PROCESSED = ROOT / "data" / "processed"
CROSSWALK = PROCESSED / "ma_town_county.csv"
TRIALS_OUT = PROCESSED / "trials.csv"
SITES_OUT = PROCESSED / "trial_sites.csv"

TRIALS_FIELDS = [
    "nct_id",
    "title",
    "phase",
    "conditions",
    "lead_sponsor",
    "eligibility_text",
    "min_age",
    "max_age",
    "reference_pmids",
]
SITES_FIELDS = ["nct_id", "facility", "city", "zip", "county", "county_fips"]


def _norm(city: str) -> str:
    return city.upper().strip()


def load_crosswalk() -> dict[str, tuple[str, str]]:
    """UPPERCASE town -> (county, county_fips)."""
    if not CROSSWALK.exists():
        raise SystemExit(
            f"{CROSSWALK} missing. Run build_crosswalk first:\n"
            "    python -m pipeline.ingest.build_crosswalk"
        )
    mapping: dict[str, tuple[str, str]] = {}
    with CROSSWALK.open() as fh:
        for row in csv.DictReader(fh):
            mapping[_norm(row["town"])] = (row["county"], row["county_fips"])
    return mapping


def resolve_county(city: str, xwalk: dict[str, tuple[str, str]]) -> tuple[str, str] | None:
    key = _norm(city)
    if key in xwalk:
        return xwalk[key]
    if key in MANUAL_OVERRIDES:
        return xwalk.get(_norm(MANUAL_OVERRIDES[key]))
    return None


# ClinicalTrials.gov age units -> years. Covers singular/plural forms seen in the
# data (Years/Year, Months/Month, Days/Day, Minutes). Everything is normalized to
# YEARS so the age column has a consistent unit; sub-year ages become fractions.
_AGE_UNIT_TO_YEARS = {
    "year": 1.0,
    "years": 1.0,
    "month": 1.0 / 12,
    "months": 1.0 / 12,
    "week": 1.0 / 52,
    "weeks": 1.0 / 52,
    "day": 1.0 / 365,
    "days": 1.0 / 365,
    "hour": 1.0 / (365 * 24),
    "hours": 1.0 / (365 * 24),
    "minute": 1.0 / (365 * 24 * 60),
    "minutes": 1.0 / (365 * 24 * 60),
}


def _age_number(age_str: str | None) -> str:
    """Normalize a ClinicalTrials.gov age to YEARS as a string.

    '18 Years' -> '18', '6 Months' -> '0.5', '29 Days' -> '0.08', None/'' -> ''.
    Whole years render without a decimal; sub-year values round to 2 places.
    """
    if not age_str or not age_str.strip():
        return ""
    parts = age_str.split()
    try:
        value = float(parts[0])
    except ValueError:
        return ""
    unit = parts[1].lower() if len(parts) > 1 else "years"
    factor = _AGE_UNIT_TO_YEARS.get(unit)
    if factor is None:
        return ""  # unknown unit — safer to emit nothing than a wrong number
    years = value * factor
    if years == int(years):
        return str(int(years))
    return str(round(years, 2))


def iter_studies():
    pages = sorted(RAW_DIR.glob("page_*.json"), key=lambda p: int(p.stem.split("_")[1]))
    if not pages:
        raise SystemExit(
            f"No pages in {RAW_DIR}. Run fetch_trials first:\n"
            "    python -m pipeline.ingest.fetch_trials"
        )
    for page in pages:
        data = json.loads(page.read_text())
        yield from data.get("studies", [])


def build() -> tuple[list[dict], list[dict], set[str]]:
    xwalk = load_crosswalk()
    trials: list[dict] = []
    sites: list[dict] = []
    unmatched: set[str] = set()
    seen_trials: set[str] = set()

    for study in iter_studies():
        ps = study.get("protocolSection", {})
        ident = ps.get("identificationModule", {})
        nct_id = ident.get("nctId", "")
        if not nct_id or nct_id in seen_trials:
            continue
        seen_trials.add(nct_id)

        elig = ps.get("eligibilityModule", {})
        conditions = ps.get("conditionsModule", {}).get("conditions", []) or []
        phases = ps.get("designModule", {}).get("phases", []) or []
        sponsor = (
            ps.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name", "")
        )
        refs = ps.get("referencesModule", {}).get("references", []) or []
        pmids = [r.get("pmid", "") for r in refs if r.get("pmid")]

        trials.append(
            {
                "nct_id": nct_id,
                "title": ident.get("briefTitle", ""),
                "phase": ";".join(phases),
                "conditions": ";".join(conditions),
                "lead_sponsor": sponsor,
                "eligibility_text": elig.get("eligibilityCriteria", ""),
                "min_age": _age_number(elig.get("minimumAge")),
                "max_age": _age_number(elig.get("maximumAge")),
                "reference_pmids": ";".join(pmids),
            }
        )

        locations = ps.get("contactsLocationsModule", {}).get("locations", []) or []
        for loc in locations:
            if (loc.get("state") or "").strip() != "Massachusetts":
                continue
            # overallStatus=RECRUITING is trial-level; individual MA sites can be
            # NOT_YET_RECRUITING / WITHDRAWN / TERMINATED / COMPLETED. Keep only
            # sites that are themselves actively recruiting.
            if (loc.get("status") or "").strip().upper() != "RECRUITING":
                continue
            city = (loc.get("city") or "").strip()
            resolved = resolve_county(city, xwalk)
            if resolved is None:
                unmatched.add(city)
                county, fips = "", ""
            else:
                county, fips = resolved
            sites.append(
                {
                    "nct_id": nct_id,
                    "facility": (loc.get("facility") or "").strip(),
                    "city": city,
                    "zip": (loc.get("zip") or "").strip(),
                    "county": county,
                    "county_fips": fips,
                }
            )

    # Option A: scope trials.csv to trials that have at least one recruiting MA
    # site, so trials and sites share the same set of NCT ids.
    ma_trial_ids = {s["nct_id"] for s in sites}
    trials = [t for t in trials if t["nct_id"] in ma_trial_ids]

    return trials, sites, unmatched


def main() -> None:
    trials, sites, unmatched = build()
    PROCESSED.mkdir(parents=True, exist_ok=True)

    with TRIALS_OUT.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=TRIALS_FIELDS)
        w.writeheader()
        w.writerows(trials)

    with SITES_OUT.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=SITES_FIELDS)
        w.writeheader()
        w.writerows(sites)

    ma_trials = {s["nct_id"] for s in sites}
    print(f"trials:        {len(trials)}")
    print(f"MA sites:      {len(sites)}")
    print(f"trials w/ MA site: {len(ma_trials)}")
    print(f"-> {TRIALS_OUT.name}, {SITES_OUT.name}")

    if unmatched:
        print(f"\nUNMATCHED CITIES ({len(unmatched)}) — add to MANUAL_OVERRIDES:")
        for city in sorted(unmatched):
            print(f"  {city!r}")
    else:
        print("\nAll MA site cities matched a county.")


if __name__ == "__main__":
    main()
