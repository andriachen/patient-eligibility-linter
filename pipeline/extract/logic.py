"""P2: Pure helpers — substring validation and per-category dedupe.

No SDK / network imports here so these are trivially unit-testable.
"""

from __future__ import annotations

import html
import re

_WS = re.compile(r"\s+")
# ClinicalTrials.gov escapes markdown-ish punctuation in the criteria text
# (e.g. "\[C1D1\]", "\>75", "\*"). The model quotes the clean form, so strip the
# backslash before ASCII punctuation before comparing.
_ESCAPED_PUNCT = re.compile(r"\\([\[\]<>*_()#.+\-^`!~={}|])")


def normalize(s: str) -> str:
    """Normalize for lenient substring matching.

    Decodes HTML entities (source sometimes has "&lt;"/"&gt;"), strips CT.gov
    backslash-escapes before punctuation, collapses whitespace, strips, and
    casefolds — so a verbatim model quote still matches source text that carries
    escape/entity artifacts.
    """
    text = html.unescape(s or "")
    text = _ESCAPED_PUNCT.sub(r"\1", text)
    return _WS.sub(" ", text).strip().casefold()


def is_valid(source_text: str, eligibility_text: str) -> bool:
    """True if source_text appears in eligibility_text after normalization.

    The model reflows newlines, so a raw-exact check would produce false
    failures. We require a whitespace-normalized substring match instead.
    """
    needle = normalize(source_text)
    if not needle:
        return False
    return needle in normalize(eligibility_text)


def validate_records(records: list[dict], eligibility_text: str) -> list[dict]:
    """Return the records whose source_text fails the substring check."""
    return [r for r in records if not is_valid(r.get("source_text", ""), eligibility_text)]


# Any integer age mentioned in the quote. Used to decide if an `age` record is
# just the standard adult floor (>=18, no upper bound) rather than a real cap.
_AGE_NUM = re.compile(r"(\d{1,3})\s*(?:years?|yrs?|yo\b|y/o\b|years? old)?", re.I)
# Words that indicate an UPPER bound / real age restriction in the quote.
_AGE_UPPER_HINT = re.compile(
    r"(<|≤|=<|under|up to|maximum|younger than|no older|between|-\s*\d|to\s+\d)", re.I
)


def is_bare_adult_floor(source_text: str) -> bool:
    """True if an age quote is just a standard adult minimum (>=18, no cap).

    Haiku keeps emitting "Age >= 18 years" as an age restriction even though a
    plain 18 floor is not one. We drop those deterministically. We DO keep quotes
    that carry an upper bound (<55, 40-80, <=75) or a minimum strictly above 18.
    """
    text = normalize(source_text)
    if not text:
        return False
    # If the quote signals any upper/range bound, it is a real restriction — keep.
    if _AGE_UPPER_HINT.search(text):
        return False
    nums = [int(n) for n in _AGE_NUM.findall(text) if n.isdigit()]
    age_nums = [n for n in nums if 0 < n <= 120]
    if not age_nums:
        return False
    # Bare floor only when the only plausible age cutoff present is <= 18.
    return max(age_nums) <= 18


def drop_noise(records: list[dict]) -> list[dict]:
    """Remove records the model should not have emitted (deterministic guards).

    Currently: `age` records that are just a standard adult floor (>=18, no cap).
    """
    out = []
    for r in records:
        if r.get("category") == "age" and is_bare_adult_floor(r.get("source_text", "")):
            continue
        out.append(r)
    return out


def dedupe(records: list[dict]) -> list[dict]:
    """One row per category; a hard (absolute) restriction beats a conditional one.

    Within a category, if any record is absolute=true, choose among those;
    otherwise choose among all. Keep the first in document order among candidates,
    preserving its own threshold / section / source_text. Category output order
    follows first appearance in the input.
    """
    order: list[str] = []
    groups: dict[str, list[dict]] = {}
    for r in records:
        cat = r.get("category")
        if cat is None:
            continue
        if cat not in groups:
            groups[cat] = []
            order.append(cat)
        groups[cat].append(r)

    out: list[dict] = []
    for cat in order:
        group = groups[cat]
        absolutes = [r for r in group if r.get("absolute") is True]
        candidates = absolutes if absolutes else group
        chosen = candidates[0]
        out.append(
            {
                "category": chosen.get("category"),
                "threshold": chosen.get("threshold"),
                "absolute": bool(chosen.get("absolute")),
                "section": chosen.get("section"),
                "source_text": chosen.get("source_text", ""),
            }
        )
    return out
