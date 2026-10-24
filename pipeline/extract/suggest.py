"""P2 / Phase 3: Rewording pass — propose a less-restrictive wording per category.

Template-based on purpose. Each of the 13 categories maps to ONE vetted
suggestion plus a citation, grounded in the FDA 2020 "Cancer Clinical Trial
Eligibility Criteria" guidances and the ASCO-Friends of Cancer Research
recommendations (see docs/sources.md). In a medical context the recommendations
must be fixed and reviewable, not improvised by a model at request time.

Honesty rule (from docs/sources.md): every citation names its strength. Diabetes,
bmi and smoking have only general guidance (FDA 2020, Enhancing Diversity), and
pregnancy cites ICH E21, which is a draft; the source strings say so.

Consumed by lint.py and extract.py to fill the `suggestion` and
`suggestion_source` fields of each flagged criterion.
"""

from __future__ import annotations

# category -> (suggestion, suggestion_source)
_SUGGESTIONS: dict[str, tuple[str, str]] = {
    "brain_mets": (
        "Allow patients with treated, stable, or asymptomatic brain metastases "
        "instead of excluding all brain metastases; define what counts as active "
        "or stable.",
        "FDA 2020 (Brain Metastases, final); ASCO–Friends 2017",
    ),
    "hiv": (
        "Allow people with HIV whose disease is controlled on antiretroviral "
        "therapy instead of a blanket HIV exclusion.",
        "FDA 2020 (HIV, Hepatitis B, Hepatitis C, final); ASCO–Friends 2017",
    ),
    "renal": (
        "Set kidney thresholds to what the drug's safety actually requires, allow "
        "calculated creatinine clearance, and avoid cutoffs stricter than needed.",
        "FDA 2026 (Laboratory Values, final); FDA 2020 (Organ Dysfunction, final); "
        "ASCO–Friends 2021",
    ),
    "hepatic": (
        "Set liver thresholds (bilirubin, AST/ALT) to what the drug's safety "
        "requires, and allow for liver metastases or Gilbert's syndrome.",
        "FDA 2026 (Laboratory Values, final); FDA 2020 (Organ Dysfunction, final); "
        "ASCO–Friends 2021",
    ),
    "cardiac": (
        "Use objective, drug-specific heart criteria (NYHA class, ejection "
        "fraction, recent-MI window) instead of broad 'significant cardiac "
        "disease' exclusions.",
        "FDA 2020 (Organ Dysfunction, final); FDA 2020 (Enhancing Diversity, "
        "final); ASCO–Friends 2017",
    ),
    "prior_malignancy": (
        "Exclude a prior cancer only when it could affect safety or efficacy "
        "results; otherwise allow it, instead of a blanket 'cancer within X "
        "years' rule.",
        "FDA 2020 (Prior or Concurrent Malignancies, final); ASCO–Friends 2017",
    ),
    "age": (
        "Avoid upper age caps unless a specific safety or drug-handling concern "
        "requires one; older adults carry much of the cancer burden.",
        "FDA 2022 (Inclusion of Older Adults in Cancer Clinical Trials, final)",
    ),
    "performance_status": (
        "Consider including ECOG 2 (or equivalent) patients who are otherwise "
        "clinically stable, instead of restricting to ECOG 0–1.",
        "FDA 2026 (Performance Status, final); ASCO–Friends 2021",
    ),
    "language": (
        "Offer translated consent forms, translated patient materials, and "
        "interpreters instead of an English-only requirement.",
        "FDA 2020 (Enhancing the Diversity of Clinical Trial Populations, final)",
    ),
    # --- draft guidance only ---
    "pregnancy": (
        "Where the drug's safety profile allows, use contraception requirements "
        "and planned data collection instead of excluding everyone who could "
        "become pregnant.",
        "ICH E21 (draft, 2025)",
    ),
    # --- general guidance only: no category-specific FDA/ASCO guidance ---
    "diabetes": (
        "Consider allowing controlled diabetes with a documented HbA1c ceiling "
        "instead of a blanket exclusion, unless the drug affects blood sugar.",
        "FDA 2020 (Enhancing Diversity, final), general guidance only",
    ),
    "bmi": (
        "Check whether the BMI or weight cap is required (for example, a scanner "
        "table limit) or could be relaxed.",
        "FDA 2020 (Enhancing Diversity, final), general guidance only",
    ),
    "smoking": (
        "Exclude only active use within a defined window if needed, not all "
        "current or former smokers.",
        "FDA 2020 (Enhancing Diversity, final), general guidance only",
    ),
}

_FALLBACK = (
    "Review whether this exclusion is scientifically necessary or could be relaxed.",
    "",
)


def suggest_for_category(category: str) -> tuple[str, str]:
    """Return (suggestion, suggestion_source) for a category. Never raises."""
    return _SUGGESTIONS.get(category, _FALLBACK)


def suggest_rewording(text: str, category: str) -> str:
    """Back-compat: return just the suggestion string for a flagged criterion.

    `text` (the source quote) is accepted for interface stability but the
    template version keys only on category.
    """
    return suggest_for_category(category)[0]
