"""Guards the pitch's funnel number against the current matcher data.

`docs/pitch.md` quotes the Hampden preset's funnel sequence (24 → 20 → 20 → 16, and
24 → 20 → 20 → 18 with "outright only" ticked). The preset lives in
`app/project-starter/components/TurnedAwayPanel.tsx` and the step logic in
`app/project-starter/lib/turnedAway.ts`; this test re-implements the few lines of
step logic in Python and asserts the sequence that pitch.md quotes still falls out
of `data/processed/trials_enriched.json`. If someone changes the HIV semantics or
the Hampden pool, this fails loudly instead of letting the pitch drift again.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENRICHED = ROOT / "data" / "processed" / "trials_enriched.json"
PITCH = ROOT / "docs" / "pitch.md"

HAMPDEN_FIPS = "25013"
# Must match the preset in TurnedAwayPanel.tsx: PITCH_PATIENT.
PRESET_AGE = 58
PRESET_TRAITS = ["hiv", "language"]
# Must match TRAITS in TurnedAwayPanel.tsx: HIV is treated as "outright" because the
# patient is "controlled on treatment" and conditional rules admit her.
TRAIT_OUTRIGHT = {"hiv": True, "language": False}


def _trials() -> list[dict]:
    return json.loads(ENRICHED.read_text())


def _restrictions(exclusions: list[dict]) -> dict[str, str]:
    r: dict[str, str] = {}
    for e in exclusions:
        cat = e.get("category")
        if not cat:
            continue
        if e.get("absolute"):
            r[cat] = "a"
        elif cat not in r:
            r[cat] = "c"
    return r


def _hampden(trials: list[dict]) -> list[dict]:
    return [
        t
        for t in trials
        if HAMPDEN_FIPS in {s.get("county_fips", "") for s in t.get("sites", []) if s.get("county_fips")}
    ]


def _after_age(pool: list[dict], age: int) -> list[dict]:
    keep: list[dict] = []
    for t in pool:
        lo, hi = t.get("min_age"), t.get("max_age")
        if lo is not None and lo > age:
            continue
        if hi is not None and hi < age:
            continue
        keep.append(t)
    return keep


def _after_trait(pool: list[dict], trait: str, outright_only: bool) -> list[dict]:
    out: list[dict] = []
    outright_mode = outright_only or TRAIT_OUTRIGHT[trait]
    for t in pool:
        r = _restrictions(t.get("exclusions", []))
        rule = r.get(trait)
        removed = rule == "a" if outright_mode else rule is not None
        if not removed:
            out.append(t)
    return out


def _sequence(outright_only: bool) -> tuple[int, int, int, int]:
    trials = _trials()
    pool = _hampden(trials)
    s0 = len(pool)
    pool = _after_age(pool, PRESET_AGE)
    s1 = len(pool)
    pool = _after_trait(pool, PRESET_TRAITS[0], outright_only)
    s2 = len(pool)
    pool = _after_trait(pool, PRESET_TRAITS[1], outright_only)
    s3 = len(pool)
    return s0, s1, s2, s3


def _pitch_sequences() -> dict[str, tuple[int, int, int, int]]:
    text = PITCH.read_text(encoding="utf-8")
    # Grab the two arrow sequences the pitch quotes. The arrows are U+2192; counts
    # are whole numbers. Not every sequence in the file is funnel-related, so we
    # read the two the funnel paragraph quotes explicitly.
    pattern = re.compile(r"(\d+)\s*→\s*(\d+)\s*→\s*(\d+)\s*→\s*(\d+)")
    matches = pattern.findall(text)
    assert len(matches) >= 2, f"pitch.md should quote the funnel sequence twice, got {matches!r}"
    default = tuple(int(x) for x in matches[0])  # type: ignore[assignment]
    outright = tuple(int(x) for x in matches[1])  # type: ignore[assignment]
    return {"default": default, "outright_only": outright}


def test_funnel_default_sequence_matches_pitch():
    assert _sequence(outright_only=False) == _pitch_sequences()["default"]


def test_funnel_outright_only_sequence_matches_pitch():
    assert _sequence(outright_only=True) == _pitch_sequences()["outright_only"]
