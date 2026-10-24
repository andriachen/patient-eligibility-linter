"""P1: Fetch recruiting MA cancer trials from ClinicalTrials.gov v2.

Pages through the API following nextPageToken and writes each page to
data/raw/ctgov/page_{n}.json. Pages that already exist are skipped so reruns
are cheap. Pass --probe to print the structure of the first page and exit.

Usage:
    python -m pipeline.ingest.fetch_trials
    python -m pipeline.ingest.fetch_trials --probe
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import requests

API_URL = "https://clinicaltrials.gov/api/v2/studies"

FIELDS = [
    "NCTId",
    "BriefTitle",
    "Phase",
    "Condition",
    "LeadSponsorName",
    "EligibilityCriteria",
    "MinimumAge",
    "MaximumAge",
    "LocationFacility",
    "LocationCity",
    "LocationState",
    "LocationZip",
    "ReferencePMID",
]

BASE_PARAMS = {
    "query.locn": "Massachusetts",
    "query.cond": "cancer",
    "filter.overallStatus": "RECRUITING",
    "pageSize": 200,
    "fields": ",".join(FIELDS),
}

RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw" / "ctgov"

MAX_RETRIES = 4
BACKOFF_BASE = 2.0


def _request(params: dict) -> dict:
    """GET with simple exponential backoff."""
    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(API_URL, params=params, timeout=60)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as err:  # noqa: PERF203
            last_err = err
            wait = BACKOFF_BASE**attempt
            print(f"  request failed ({err}); retrying in {wait:.0f}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"request failed after {MAX_RETRIES} attempts: {last_err}")


def probe() -> None:
    """Fetch one study and pretty-print its structure to confirm field paths."""
    params = dict(BASE_PARAMS, pageSize=1)
    data = _request(params)
    study = data["studies"][0]
    print(json.dumps(study, indent=2)[:4000])
    print("\n--- keys in protocolSection ---")
    print(list(study.get("protocolSection", {}).keys()))


def fetch_all() -> int:
    """Fetch every page, writing data/raw/ctgov/page_{n}.json. Returns study count."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    page = 1
    token: str | None = None
    total = 0
    while True:
        out_path = RAW_DIR / f"page_{page}.json"
        if out_path.exists():
            # Resume: read token from the existing page so we can continue.
            existing = json.loads(out_path.read_text())
            count = len(existing.get("studies", []))
            total += count
            token = existing.get("nextPageToken")
            print(f"page {page}: exists ({count} studies), skipping")
            if not token:
                break
            page += 1
            continue

        params = dict(BASE_PARAMS)
        if token:
            params["pageToken"] = token
        data = _request(params)
        studies = data.get("studies", [])
        total += len(studies)
        out_path.write_text(json.dumps(data, indent=2))
        print(f"page {page}: fetched {len(studies)} studies -> {out_path.name}")

        token = data.get("nextPageToken")
        if not token:
            break
        page += 1
        time.sleep(0.5)  # be polite

    print(f"\nDone. {page} page(s), {total} studies total.")
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--probe",
        action="store_true",
        help="Print the structure of a single study and exit.",
    )
    args = parser.parse_args()
    if args.probe:
        probe()
    else:
        fetch_all()


if __name__ == "__main__":
    main()
