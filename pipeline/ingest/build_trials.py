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


def _age_number(age_str: str | None) -> str:
    """'18 Years' -> '18'; None -> ''."""
    if not age_str:
        return ""
    return age_str.split()[0]


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
