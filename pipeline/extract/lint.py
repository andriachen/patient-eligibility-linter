"""P2: Live single-text linter used by the app's Linter tab.

lint_criteria(text) runs the same extraction as the batch engine, applies the
per-category dedupe, and returns dicts matching the exclusions.csv fields (minus
nct_id) plus suggestion / suggestion_source, filled from suggest.py (template,
grounded in FDA/ASCO guidance). No nct_id, no cache. If the API key is missing,
returns a small mock so the app still renders.
"""

from __future__ import annotations

from . import llm
from .logic import dedupe, drop_noise, is_valid
from .suggest import suggest_for_category


def _shape(rec: dict) -> dict:
    category = rec.get("category")
    suggestion, suggestion_source = suggest_for_category(category)
    return {
        "category": category,
        "threshold": rec.get("threshold"),
        "absolute": bool(rec.get("absolute")),
        "section": rec.get("section"),
        "source_text": rec.get("source_text", ""),
        "suggestion": suggestion,
        "suggestion_source": suggestion_source,
    }


def _mock(text: str) -> list[dict]:
    """Deterministic stand-in when no API key is configured."""
    out: list[dict] = []
    low = text.lower()
    if "ecog" in low:
        out.append(
            _shape(
                {
                    "category": "performance_status",
                    "threshold": "ECOG mentioned",
                    "absolute": True,
                    "section": "inclusion",
                    "source_text": "ECOG",
                }
            )
        )
    if "hiv" in low:
        out.append(
            _shape(
                {
                    "category": "hiv",
                    "threshold": None,
                    "absolute": True,
                    "section": "exclusion",
                    "source_text": "HIV",
                }
            )
        )
    return out


def lint_criteria(text: str) -> list[dict]:
    """Extract + dedupe restrictions from arbitrary pasted criteria text."""
    if not text or not text.strip():
        return []
    try:
        raw = llm.extract_raw(text)
    except llm.MissingKeyError:
        return _mock(text)
    # keep only records with a verifiable quote, then dedupe per category
    valid = drop_noise([r for r in raw if is_valid(r.get("source_text", ""), text)])
    return [_shape(r) for r in dedupe(valid)]
