"""P2: Batch extraction engine + CLI.

Reads trials from a JSON sample or from data/processed/trials.csv, extracts
exclusions via the LLM (cached per trial, lossless), validates source quotes, and
— in CSV mode — writes the deduped data/processed/exclusions.csv.

Usage:
    python -m pipeline.extract.extract --input pipeline/extract/sample_trials.json
    python -m pipeline.extract.extract --input data/processed/trials.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from . import llm
from .logic import dedupe, drop_noise, is_valid, validate_records
from .prompts import PROMPT_VERSION

ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = ROOT / "data" / "cache"
EXCLUSIONS_OUT = ROOT / "data" / "processed" / "exclusions.csv"

EXCLUSIONS_FIELDS = ["nct_id", "category", "threshold", "absolute", "section", "source_text"]
MAX_WORKERS = 12


# --------------------------------------------------------------------------- #
# input loading                                                               #
# --------------------------------------------------------------------------- #
def load_trials(input_path: Path) -> list[dict]:
    """Return [{nct_id, eligibility_text}, ...] from a .json sample or trials.csv."""
    if input_path.suffix == ".json":
        data = json.loads(input_path.read_text())
        return [
            {"nct_id": t["nct_id"], "eligibility_text": t.get("eligibility_text", "")}
            for t in data
        ]
    rows = []
    with input_path.open(newline="") as fh:
        for r in csv.DictReader(fh):
            rows.append(
                {
                    "nct_id": r["nct_id"],
                    "eligibility_text": (r.get("eligibility_text") or ""),
                }
            )
    return rows


# --------------------------------------------------------------------------- #
# per-trial extraction (cached)                                               #
# --------------------------------------------------------------------------- #
def _cache_path(nct_id: str) -> Path:
    return CACHE_DIR / f"{nct_id}.json"


def extract_one(trial: dict) -> dict:
    """Return the cache record for one trial, calling the model only on a miss.

    Cache record (lossless): {nct_id, model, prompt_version, exclusions:[...raw...]}.
    A cache file whose prompt_version != the current PROMPT_VERSION is treated as
    a MISS and re-extracted, so a prompt change never silently serves stale data.
    Returns a small status dict for the run summary.
    """
    nct_id = trial["nct_id"]
    text = trial["eligibility_text"]
    path = _cache_path(nct_id)

    if path.exists():
        cached = json.loads(path.read_text())
        if cached.get("prompt_version") == PROMPT_VERSION:
            records = cached.get("exclusions", [])
            return {"nct_id": nct_id, "cached": True, "records": records, "text": text}
        # else: stale prompt version -> fall through and re-extract

    records = llm.extract_raw(text)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "nct_id": nct_id,
                "model": llm.model_name(),
                "prompt_version": PROMPT_VERSION,
                "exclusions": records,
            },
            indent=2,
        )
    )
    return {"nct_id": nct_id, "cached": False, "records": records, "text": text}


def run(trials: list[dict]) -> list[dict]:
    """Extract all trials with bounded concurrency. Returns per-trial results."""
    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(extract_one, t): t["nct_id"] for t in trials}
        done = 0
        for fut in as_completed(futures):
            nct_id = futures[fut]
            try:
                results.append(fut.result())
            except Exception as err:  # noqa: BLE001 - record + continue
                print(f"  ERROR {nct_id}: {err}", file=sys.stderr)
            done += 1
            if done % 50 == 0 or done == len(trials):
                print(f"  ...{done}/{len(trials)}")
    return results


# --------------------------------------------------------------------------- #
# reporting + CSV                                                             #
# --------------------------------------------------------------------------- #
def report(results: list[dict]) -> int:
    """Print the run summary. Returns the number of substring failures."""
    hits = sum(1 for r in results if r["cached"])
    raw_total = sum(len(r["records"]) for r in results)
    failures = 0
    for r in results:
        bad = validate_records(r["records"], r["text"])
        for b in bad:
            failures += 1
            print(
                f"  SUBSTRING FAIL {r['nct_id']}: {b.get('source_text', '')[:100]!r}",
                file=sys.stderr,
            )
    deduped_total = sum(len(dedupe(r["records"])) for r in results)
    print(
        f"\ntrials: {len(results)} | cache hits: {hits} | raw records: {raw_total} "
        f"| after dedupe: {deduped_total} | substring failures: {failures}"
    )
    return failures


def write_exclusions(results: list[dict]) -> None:
    rows: list[dict] = []
    # Track WHY records are dropped, separately — the two causes are very different:
    #   - unverifiable: source_text didn't match the trial text (model paraphrase /
    #     empty quote / garble). These are quote-quality failures.
    #   - guard: a VALID quote the deterministic guard removed as a known model
    #     error (bare adult-age floor, or quote lacking its category's keyword).
    dropped_unverifiable = 0
    dropped_guard = 0
    for r in results:
        verified = [rec for rec in r["records"] if is_valid(rec.get("source_text", ""), r["text"])]
        dropped_unverifiable += len(r["records"]) - len(verified)
        kept = drop_noise(verified)
        dropped_guard += len(verified) - len(kept)
        for rec in dedupe(kept):
            rows.append(
                {
                    "nct_id": r["nct_id"],
                    "category": rec["category"],
                    "threshold": "" if rec["threshold"] is None else rec["threshold"],
                    "absolute": str(bool(rec["absolute"])).lower(),
                    "section": rec["section"],
                    "source_text": rec["source_text"],
                }
            )
    rows.sort(key=lambda x: (x["nct_id"], x["category"]))
    EXCLUSIONS_OUT.parent.mkdir(parents=True, exist_ok=True)
    with EXCLUSIONS_OUT.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=EXCLUSIONS_FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(
        f"exclusions.csv: {len(rows)} rows -> {EXCLUSIONS_OUT}\n"
        f"  dropped {dropped_unverifiable} unverifiable-quote records "
        f"(model paraphrase / empty / garble)\n"
        f"  dropped {dropped_guard} guard records "
        f"(bare adult-age floor or category-keyword mismatch — intended)"
    )
    _rebuild_derived()


def _rebuild_derived() -> None:
    """Rebuild app-facing artifacts derived from exclusions.csv so they can't go stale:
      - stats.json          (Landscape headline / per-category bars)
      - trials_enriched.json (the matcher's runtime index, Sub-Aim 2)

    Each runs as a subprocess (no pipeline->eval import dependency). Best-effort:
    a failure is logged, not fatal (exclusions.csv is already written).
    """
    import subprocess
    import sys

    for script_name, label in (
        ("build_stats.py", "stats.json"),
        ("build_trials_enriched.py", "trials_enriched.json"),
    ):
        script = ROOT / "eval" / script_name
        if not script.exists():
            continue
        try:
            subprocess.run([sys.executable, str(script)], check=True, cwd=str(ROOT),
                           capture_output=True, text=True, timeout=120)
            print(f"{label} rebuilt from exclusions.csv")
        except Exception as err:  # noqa: BLE001 - non-fatal
            print(f"  WARNING: {label} rebuild failed ({err}); run eval/{script_name} manually",
                  file=sys.stderr)


# --------------------------------------------------------------------------- #
def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="sample .json or trials.csv")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.is_absolute():
        input_path = (Path.cwd() / input_path).resolve()
    if not input_path.exists():
        raise SystemExit(f"input not found: {input_path}")

    trials = load_trials(input_path)
    print(f"Extracting {len(trials)} trials from {input_path.name} ...")
    results = run(trials)
    failures = report(results)

    # CSV mode: write exclusions.csv when the input is the full trials table.
    if input_path.suffix == ".csv":
        write_exclusions(results)

    if failures:
        print(
            f"\nNOTE: {failures} source_text substring failure(s) — review the prompt.",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
