"""P2: Build-time trial tagger — cancer type + normalized age range per trial.

Why: trials carry 2,392 distinct, mostly one-off condition labels. Keyword matching
can't cover that tail. We tag each trial ONCE with the LLM into a FIXED cancer-type
vocabulary (+ baskets) and a clean integer age range, cache it, and bake it into the
matcher index. Search then becomes a deterministic lookup (no inference, Vercel-safe).

Cache: data/cache/tags/{nct_id}.json, with prompt_version (stale -> re-tag).
Output: data/processed/trial_tags.json  { nct_id: {cancer_types, age_min, age_max} }

Usage:
    python -m pipeline.extract.tag_trials --limit 10   # sample (eyeball first)
    python -m pipeline.extract.tag_trials               # full run
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from . import llm
from .tag_prompts import CANCER_TYPES, SYSTEM_PROMPT, TAG_TOOL

ROOT = Path(__file__).resolve().parents[2]
TRIALS_CSV = ROOT / "data" / "processed" / "trials.csv"
CACHE_DIR = ROOT / "data" / "cache" / "tags"
OUT = ROOT / "data" / "processed" / "trial_tags.json"
PROMPT_VERSION = "tags-v1-2026-10-24"
MAX_WORKERS = 12
_VALID = set(CANCER_TYPES)


def _load_trials() -> list[dict]:
    with TRIALS_CSV.open(newline="", encoding="utf-8") as fh:
        return [
            {
                "nct_id": r["nct_id"],
                "title": r.get("title", ""),
                "conditions": r.get("conditions", ""),
                "min_age": r.get("min_age", ""),
                "max_age": r.get("max_age", ""),
            }
            for r in csv.DictReader(fh)
        ]


def _cache_path(nct_id: str) -> Path:
    return CACHE_DIR / f"{nct_id}.json"


def _user_text(t: dict) -> str:
    conds = "; ".join(c for c in t["conditions"].split(";") if c)
    return (
        f"Title: {t['title']}\n"
        f"Condition labels: {conds}\n"
        f"Eligibility age fields: min={t['min_age'] or 'n/a'}, max={t['max_age'] or 'n/a'}"
    )


def _sanitize(raw: dict, fallback_min: str, fallback_max: str) -> dict:
    """Clamp model output to the fixed vocabulary + sane age ints."""
    types = [c for c in (raw.get("cancer_types") or []) if c in _VALID]
    if not types:
        types = ["unknown"]  # tag failure -> "ask", never a match for everyone

    # Age: the tagger only sees the registry min/max (not criteria text), so prefer
    # the REGISTRY values and don't let the model drop a real cap. We keep the
    # registry number verbatim (it may be fractional, e.g. 0.25y = babies) and only
    # use "130 years" style placeholders as "no cap".
    def _num(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    rmin = _num(fallback_min)
    rmax = _num(fallback_max)
    amin = rmin if rmin is not None else 0
    # Treat a >=130y "max" as a placeholder for no cap; keep real caps (incl. <1y).
    amax = None if (rmax is None or rmax >= 130) else rmax
    if amin < 0 or amin > 130:
        amin = 0
    return {"cancer_types": types, "age_min": amin, "age_max": amax}


def tag_one(t: dict) -> dict:
    nct = t["nct_id"]
    path = _cache_path(nct)
    if path.exists():
        cached = json.loads(path.read_text())
        if cached.get("prompt_version") == PROMPT_VERSION:
            return {"nct_id": nct, **cached["tag"], "cached": True}
    raw = llm.call_tool(SYSTEM_PROMPT, TAG_TOOL, _user_text(t))
    tag = _sanitize(raw, t["min_age"], t["max_age"])
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"nct_id": nct, "prompt_version": PROMPT_VERSION, "tag": tag}, indent=2))
    return {"nct_id": nct, **tag, "cached": False}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--limit", type=int, default=0, help="tag only the first N (sample).")
    args = ap.parse_args()

    trials = _load_trials()
    if args.limit:
        trials = trials[: args.limit]
    print(f"Tagging {len(trials)} trials...")

    results: dict[str, dict] = {}
    hits = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futs = {pool.submit(tag_one, t): t["nct_id"] for t in trials}
        done = 0
        for fut in as_completed(futs):
            nct = futs[fut]
            try:
                r = fut.result()
                hits += 1 if r.pop("cached") else 0
                results[r["nct_id"]] = {"cancer_types": r["cancer_types"], "age_min": r["age_min"], "age_max": r["age_max"]}
            except Exception as err:  # noqa: BLE001
                print(f"  ERROR {nct}: {err}", file=sys.stderr)
            done += 1
            if done % 100 == 0 or done == len(trials):
                print(f"  ...{done}/{len(trials)}")

    # On a sample run, merge into any existing output so we don't clobber the full set.
    if args.limit and OUT.exists():
        existing = json.loads(OUT.read_text())
        existing.update(results)
        results = existing
    OUT.write_text(json.dumps(results, indent=2) + "\n")

    import collections
    dist = collections.Counter(c for v in results.values() for c in v["cancer_types"])
    print(f"\n{len(results)} tagged | {hits} cache hits -> {OUT.name}")
    print("cancer_type distribution:")
    for c, n in dist.most_common():
        print(f"  {c:20s} {n}")


if __name__ == "__main__":
    main()
