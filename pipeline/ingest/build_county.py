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
Reads an environmental-justice block-group file from data/raw/ej/ (download the
zip from the MassGIS/EJ portal first — the live query caps at 100 rows). Rolls
block groups up to county via MUNICIPALITY -> county (using ma_town_county.csv),
and computes population-weighted limited-English and minority percentages over
EJ block groups only.

The EJ source column names vary; override with --ej-muni / --ej-pop /
--ej-limeng / --ej-minority if the downloaded file differs.

Usage:
    python -m pipeline.ingest.build_county
    python -m pipeline.ingest.build_county --places-url "<SODA URL from kit>"
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


def _find_ej_file() -> Path | None:
    if not EJ_DIR.exists():
        return None
    candidates = [
        p
        for p in EJ_DIR.rglob("*")
        if p.suffix.lower() in {".csv", ".txt", ".dbf"} and p.is_file()
    ]
    # Prefer CSV/TXT we can parse directly.
    for p in candidates:
        if p.suffix.lower() in {".csv", ".txt"}:
            return p
    return candidates[0] if candidates else None


def build_ej(cols: dict[str, str]) -> list[dict]:
    ej_file = _find_ej_file()
    if ej_file is None:
        print(
            f"NOTE: no EJ file found under {EJ_DIR}. "
            "Download the EJ block-group zip from the portal and unzip it there. "
            "Writing an empty county_ej.csv for now."
        )
        return []

    xwalk = _load_crosswalk_muni()
    text = ej_file.read_text(errors="replace")
    # sniff delimiter
    delim = "\t" if "\t" in text.splitlines()[0] else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delim)

    # case-insensitive header lookup
    header_map = {h.lower(): h for h in (reader.fieldnames or [])}

    def col(name_key: str) -> str | None:
        want = cols[name_key].lower()
        return header_map.get(want)

    muni_col = col("muni")
    pop_col = col("pop")
    limeng_col = col("limeng")
    minority_col = col("minority")
    missing = [
        cols[k]
        for k, c in {
            "muni": muni_col,
            "pop": pop_col,
            "limeng": limeng_col,
            "minority": minority_col,
        }.items()
        if c is None
    ]
    if missing:
        print(
            f"WARNING: EJ file {ej_file.name} missing expected columns {missing}. "
            f"Available: {reader.fieldnames}. Override with --ej-* flags."
        )
        return []

    # accumulate population-weighted sums per county
    agg: dict[str, dict] = {}
    for rec in reader:
        muni = (rec.get(muni_col) or "").upper().strip()
        resolved = xwalk.get(muni)
        if resolved is None:
            continue
        county, fips = resolved
        try:
            pop = float(rec.get(pop_col) or 0)
            limeng = float(rec.get(limeng_col) or 0)
            minority = float(rec.get(minority_col) or 0)
        except ValueError:
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


# --------------------------------------------------------------------------- #
def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--places-url", default=DEFAULT_PLACES_URL)
    parser.add_argument("--ej-muni", default="MUNICIPALITY")
    parser.add_argument("--ej-pop", default="POPULATION")
    parser.add_argument("--ej-limeng", default="LIMENGHHPCT")
    parser.add_argument("--ej-minority", default="PCT_MINORITY")
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
        }
    )
    with EJ_OUT.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=EJ_FIELDS)
        w.writeheader()
        w.writerows(ej_rows)
    print(f"county_ej.csv: {len(ej_rows)} counties -> {EJ_OUT.name}")


if __name__ == "__main__":
    main()
