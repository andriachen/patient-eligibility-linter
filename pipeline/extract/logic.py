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


# Boilerplate the model mis-reads as an upper age cap. These sentences explain
# why CHILDREN are excluded ("no data in patients < 18"); they are NOT a real age
# restriction on the adult cohort, so they must be dropped like a bare floor.
_AGE_CHILD_BOILERPLATE = re.compile(
    r"(because|since).{0,80}(not|no).{0,40}(available|data).{0,80}(patients?|children)"
    r".{0,40}(<|less than|under)\s*18",
    re.I,
)
_AGE_CHILD_EXCLUDED = re.compile(
    r"(children|pediatric|patients?\s*(<|less than|under)\s*18).{0,60}(excluded|not eligible)",
    re.I,
)


def is_bare_adult_floor(source_text: str) -> bool:
    """True if an age quote is really just "adults only" (>=18 floor or child-exclusion
    boilerplate), not a genuine age restriction on the enrolled cohort.

    Keeps real caps/ranges (<55, 40-80, <=75) and minimums strictly above 18.
    """
    text = normalize(source_text)
    if not text:
        return False
    # Child-exclusion boilerplate: "because no data in patients < 18 ... children
    # are excluded". The "< 18" looks like an upper cap but isn't a cohort limit.
    if _AGE_CHILD_BOILERPLATE.search(text) or _AGE_CHILD_EXCLUDED.search(text):
        return True
    # If the quote signals any upper/range bound, it is a real restriction — keep.
    if _AGE_UPPER_HINT.search(text):
        return False
    nums = [int(n) for n in _AGE_NUM.findall(text) if n.isdigit()]
    age_nums = [n for n in nums if 0 < n <= 120]
    if not age_nums:
        return False
    # Bare floor only when the only plausible age cutoff present is <= 18.
    return max(age_nums) <= 18


# Each category's quote must contain at least one of these (normalized, casefolded)
# keywords, mirroring the prompt's per-category triggers. A quote that lacks them
# is about something else and the model mis-filed it. Conservative on purpose.
_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "diabetes": ("diabet", "hba1c", "a1c", "glycemic", "glycaemic", "glucose", "insulin"),
    "bmi": ("bmi", "body mass", "kg/m", "body weight", "weight >", "weight <", "lbs", "kg)"),
    "smoking": ("smok", "tobacco", "nicotine", "cigarette", "vap"),
    "renal": ("kidney", "renal", "creatinine", "crcl", "egfr", "gfr", "dialysis", "nephr"),
    "hepatic": ("liver", "hepat", "bilirubin", "ast", "alt", "sgot", "sgpt", "inr",
                "cirrhosis", "child-pugh", "transaminase"),
    "cardiac": ("cardiac", "heart", "nyha", "myocardial", "mi ", "lvef", "ef ",
                "ejection fraction", "qtc", "qt interval", "arrhythmi", "chf",
                "congestive", "cardiovascular", "angina", "stroke"),
    "hiv": ("hiv", "human immunodeficiency", "aids", "cd4", "antiretroviral",
            "anti-retroviral"),
    "brain_mets": ("cns", "central nervous", "brain", "leptomening", "metasta",
                   "intracranial", "cerebral"),
    "prior_malignancy": ("malignan", "cancer", "carcinoma", "tumor", "tumour",
                         "neoplasm"),
    "performance_status": ("ecog", "karnofsky", "lansky", "performance status",
                           "performance score"),
    "language": ("english", "spanish", "language", "speak", "read", "fluent",
                 "interpreter", "literacy"),
    "pregnancy": ("pregnan", "breastfeed", "breast-feed", "lactat", "nursing"),
    # age uses the numeric logic above, not a keyword list
}


def quote_matches_category(category: str, source_text: str) -> bool:
    """True if the quote contains a keyword consistent with its category.

    Age is exempt (handled numerically). HIV additionally requires that it isn't
    only about hepatitis B/C — but since hepatitis quotes lack an hiv keyword,
    the keyword check already rejects them.
    """
    if category == "age":
        return True  # numeric logic handles age
    keys = _CATEGORY_KEYWORDS.get(category)
    if not keys:
        return True  # unknown category handled elsewhere
    text = normalize(source_text)
    return any(k in text for k in keys)


def drop_noise(records: list[dict]) -> list[dict]:
    """Remove records the model should not have emitted (deterministic guards).

    1. `age` records that are really "adults only" (>=18 floor or child boilerplate).
    2. Any record whose quote lacks its category's required keyword (mis-filed —
       e.g. an `hiv` row quoting only hepatitis B/C, a `smoking` row quoting warfarin).
    """
    out = []
    for r in records:
        cat = r.get("category")
        quote = r.get("source_text", "")
        if cat == "age" and is_bare_adult_floor(quote):
            continue
        if not quote_matches_category(cat, quote):
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
