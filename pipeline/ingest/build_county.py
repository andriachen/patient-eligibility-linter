"""P1: Build county_metrics.csv (CDC PLACES) and county_ej.csv (MassGIS EJ).

PLACES
------
Pulls the CDC PLACES *county* release (dataset swc5-untb) for Massachusetts,
crude prevalence only, and maps the 5 contract measures:

    diabetes -> DIABETES, obesity -> OBESITY, smoking -> CSMOKING,
    mental_distress -> MHLTH, checkup -> CHECKUP

Override the endpoint with --places-url if the team provides a different SODA URL
("paste from the kit"). The mapping and output columns stay the same.

EJ
--
Fetches the MassGIS "2020 Environmental Justice Populations" block-group layer
live from its ArcGIS REST FeatureServer (paging past the 2000-record server cap),
so no manual zip download is needed. Every block group in that layer is already
EJ-designated (EJ = "Yes"), which matches the contract's "EJ areas only" note.

Rolls block groups up to county via MUNICIPALITY -> county (using
ma_town_county.csv) and computes population-weighted limited-English and minority
percentages. Source fields: MUNICIPALITY, TOTAL_POP, LIMENGHHPCT, PCT_MINORITY.

If the FeatureServer is unreachable, falls back to any CSV/TXT file placed under
data/raw/ej/. Column names can be overridden with --ej-muni / --ej-pop /
--ej-limeng / --ej-minority.

Usage:
    python -m pipeline.ingest.build_county
    python -m pipeline.ingest.build_county --places-url "<SODA URL from kit>"
    python -m pipeline.ingest.build_county --ej-local   # force the file fallback
"""

from __future__ import annotations

import argparse
import csv
import io
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
PROCESSED = ROOT / "data" / "processed"
EJ_DIR = ROOT / "data" / "raw" / "ej"
CROSSWALK = PROCESSED / "ma_town_county.csv"
METRICS_OUT = PROCESSED / "county_metrics.csv"
EJ_OUT = PROCESSED / "county_ej.csv"

DEFAULT_PLACES_URL = (
    "https://data.cdc.gov/resource/swc5-untb.json"
    "?stateabbr=MA&datavaluetypeid=CrdPrv&$limit=50000"
)

# MassGIS 2020 Environmental Justice Populations (block groups, all EJ-designated).
EJ_FEATURESERVER_URL = (
    "https://arcgisserver.digital.mass.gov/arcgisserver/rest/services/"
    "AGOL/EJ2020/FeatureServer/0/query"
)
EJ_PAGE_SIZE = 2000  # ArcGIS server-side max per request

# contract measure_key -> PLACES measureid
MEASURE_MAP = {
    "diabetes": "DIABETES",
    "obesity": "OBESITY",
    "smoking": "CSMOKING",
    "mental_distress": "MHLTH",
    "checkup": "CHECKUP",
}

METRICS_FIELDS = ["county", "county_fips", "measure_key", "pct", "low", "high", "population"]
EJ_FIELDS = [
    "county",
    "county_fips",
    "ej_block_groups",
    "ej_population",
    "ej_limited_english_pct",
    "ej_minority_pct",
]


# --------------------------------------------------------------------------- #
# PLACES                                                                       #
# --------------------------------------------------------------------------- #
def build_metrics(places_url: str) -> list[dict]:
    resp = requests.get(places_url, timeout=120)
    resp.raise_for_status()
    records = resp.json()

    id_to_key = {v: k for k, v in MEASURE_MAP.items()}
    rows: list[dict] = []
    for rec in records:
        mid = rec.get("measureid")
        key = id_to_key.get(mid)
        if key is None:
            continue
        rows.append(
            {
                "county": rec.get("locationname", ""),
                "county_fips": rec.get("locationid", ""),
                "measure_key": key,
                "pct": rec.get("data_value", ""),
                "low": rec.get("low_confidence_limit", ""),
                "high": rec.get("high_confidence_limit", ""),
                "population": rec.get("totalpopulation", ""),
            }
        )
    rows.sort(key=lambda r: (r["county"], r["measure_key"]))
    return rows


# --------------------------------------------------------------------------- #
# EJ                                                                           #
# --------------------------------------------------------------------------- #
def _load_crosswalk_muni() -> dict[str, tuple[str, str]]:
    mapping: dict[str, tuple[str, str]] = {}
    with CROSSWALK.open() as fh:
        for row in csv.DictReader(fh):
            mapping[row["town"].upper().strip()] = (row["county"], row["county_fips"])
    return mapping


def _fetch_ej_features(cols: dict[str, str]) -> list[dict]:
    """Page through the ArcGIS FeatureServer, returning attribute dicts.

    Keys in the returned dicts match the requested field names in `cols`.
    Raises on network/HTTP error so the caller can fall back to a local file.
    """
    out_fields = ",".join([cols["muni"], cols["pop"], cols["limeng"], cols["minority"]])
    records: list[dict] = []
    offset = 0
    while True:
        params = {
            "where": "1=1",
            "outFields": out_fields,
            "returnGeometry": "false",
            "resultOffset": offset,
            "resultRecordCount": EJ_PAGE_SIZE,
            "f": "json",
        }
        resp = requests.get(EJ_FEATURESERVER_URL, params=params, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise RuntimeError(f"ArcGIS error: {data['error']}")
        feats = data.get("features", [])
        records.extend(f.get("attributes", {}) for f in feats)
        if not data.get("exceededTransferLimit") and len(feats) < EJ_PAGE_SIZE:
            break
        if not feats:
            break
        offset += len(feats)
    return records


def _find_ej_file() -> Path | None:
    if not EJ_DIR.exists():
        return None
    candidates = [
        p
        for p in EJ_DIR.rglob("*")
        if p.suffix.lower() in {".csv", ".txt", ".dbf"} and p.is_file()
    ]
    for p in candidates:
        if p.suffix.lower() in {".csv", ".txt"}:
            return p
    return candidates[0] if candidates else None


def _read_ej_file(ej_file: Path, cols: dict[str, str]) -> list[dict]:
    """Parse a local EJ CSV/TXT into attribute dicts keyed by the `cols` names."""
    text = ej_file.read_text(errors="replace")
    delim = "\t" if "\t" in text.splitlines()[0] else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delim)
    header_map = {h.lower(): h for h in (reader.fieldnames or [])}

    resolved_cols = {k: header_map.get(v.lower()) for k, v in cols.items()}
    missing = [cols[k] for k, c in resolved_cols.items() if c is None]
    if missing:
        print(
            f"WARNING: EJ file {ej_file.name} missing columns {missing}. "
            f"Available: {reader.fieldnames}. Override with --ej-* flags."
        )
        return []

    records: list[dict] = []
    for rec in reader:
        records.append({cols[k]: rec.get(resolved_cols[k]) for k in cols})
    return records


def _aggregate_ej(records: list[dict], cols: dict[str, str]) -> list[dict]:
    """Population-weight limited-English and minority % per county."""
    xwalk = _load_crosswalk_muni()
    agg: dict[str, dict] = {}
    for rec in records:
        muni = (str(rec.get(cols["muni"]) or "")).upper().strip()
        resolved = xwalk.get(muni)
        if resolved is None:
            continue
        county, fips = resolved
        try:
            pop = float(rec.get(cols["pop"]) or 0)
            limeng = float(rec.get(cols["limeng"]) or 0)
            minority = float(rec.get(cols["minority"]) or 0)
        except (ValueError, TypeError):
            continue
        a = agg.setdefault(
            county,
            {"fips": fips, "bg": 0, "pop": 0.0, "limeng_w": 0.0, "minority_w": 0.0},
        )
        a["bg"] += 1
        a["pop"] += pop
        a["limeng_w"] += limeng * pop
        a["minority_w"] += minority * pop

    rows: list[dict] = []
    for county, a in sorted(agg.items()):
        pop = a["pop"] or 1.0
        rows.append(
            {
                "county": county,
                "county_fips": a["fips"],
                "ej_block_groups": a["bg"],
                "ej_population": int(a["pop"]),
                "ej_limited_english_pct": round(a["limeng_w"] / pop, 2),
                "ej_minority_pct": round(a["minority_w"] / pop, 2),
            }
        )
    return rows


def build_ej(cols: dict[str, str], local_only: bool = False) -> list[dict]:
    records: list[dict] = []
    if not local_only:
        try:
            records = _fetch_ej_features(cols)
            print(f"EJ: fetched {len(records)} block groups from MassGIS FeatureServer")
        except Exception as err:  # noqa: BLE001 - fall back to local file
            print(f"EJ: live fetch failed ({err}); trying local file in {EJ_DIR}")

    if not records:
        ej_file = _find_ej_file()
        if ej_file is None:
            print(
                f"NOTE: no EJ data (live fetch empty/failed and no file in {EJ_DIR}). "
                "Writing an empty county_ej.csv."
            )
            return []
        print(f"EJ: reading local file {ej_file.name}")
        records = _read_ej_file(ej_file, cols)

    return _aggregate_ej(records, cols)


# --------------------------------------------------------------------------- #
def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--places-url", default=DEFAULT_PLACES_URL)
    parser.add_argument("--ej-muni", default="MUNICIPALITY")
    parser.add_argument("--ej-pop", default="TOTAL_POP")
    parser.add_argument("--ej-limeng", default="LIMENGHHPCT")
    parser.add_argument("--ej-minority", default="PCT_MINORITY")
    parser.add_argument(
        "--ej-local",
        action="store_true",
        help="Skip the live FeatureServer and read from data/raw/ej/ instead.",
    )
    args = parser.parse_args()

    PROCESSED.mkdir(parents=True, exist_ok=True)

    metrics = build_metrics(args.places_url)
    with METRICS_OUT.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=METRICS_FIELDS)
        w.writeheader()
        w.writerows(metrics)
    counties = {r["county"] for r in metrics}
    print(f"county_metrics.csv: {len(metrics)} rows, {len(counties)} counties -> {METRICS_OUT.name}")

    ej_rows = build_ej(
        {
            "muni": args.ej_muni,
            "pop": args.ej_pop,
            "limeng": args.ej_limeng,
            "minority": args.ej_minority,
        },
        local_only=args.ej_local,
    )
    with EJ_OUT.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=EJ_FIELDS)
        w.writeheader()
        w.writerows(ej_rows)
    print(f"county_ej.csv: {len(ej_rows)} counties -> {EJ_OUT.name}")


if __name__ == "__main__":
    main()
