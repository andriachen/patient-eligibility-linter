"""P2 / Phase 3: Rewording pass — propose a less-restrictive wording per category.

Template-based on purpose. Each of the 13 categories maps to ONE vetted
suggestion plus a citation, grounded in the FDA 2020 "Cancer Clinical Trial
Eligibility Criteria" guidances and the ASCO-Friends of Cancer Research
recommendations (see docs/sources.md). In a medical context the recommendations
must be fixed and reviewable, not improvised by a model at request time.

Honesty rule (from docs/sources.md): FDA / ASCO-Friends guidance does NOT cover
diabetes, bmi, smoking, language, or pregnancy. Those get a neutral "no specific
guidance — review whether the exclusion is scientifically necessary" suggestion
and NO fabricated citation.

Consumed by lint.py and extract.py to fill the `suggestion` and
`suggestion_source` fields of each flagged criterion.
"""

from __future__ import annotations

# category -> (suggestion, suggestion_source)
# suggestion_source is "" when no formal guidance covers the category.
_SUGGESTIONS: dict[str, tuple[str, str]] = {
    "brain_mets": (
        "Allow patients with treated/stable or asymptomatic CNS metastases rather "
        "than excluding all brain metastases; define activity and stability criteria.",
        "FDA 2020 (Brain Metastases); ASCO-Friends 2017",
    ),
    "hiv": (
        "Allow HIV-positive patients on effective antiretroviral therapy with "
        "adequate CD4 count instead of a blanket HIV exclusion.",
        "FDA 2020 (HIV/HBV/HCV); ASCO-Friends 2017",
    ),
    "renal": (
        "Set renal thresholds to the level actually required for drug safety and "
        "allow calculated creatinine clearance; avoid cutoffs stricter than needed.",
        "FDA 2020 (Organ Dysfunction) & Laboratory Values; ASCO-Friends 2017/2021",
    ),
    "hepatic": (
        "Set hepatic thresholds (bilirubin, AST/ALT) to what drug safety requires "
        "and allow for liver metastases or Gilbert's; avoid overly strict caps.",
        "FDA 2020 (Organ Dysfunction) & Laboratory Values; ASCO-Friends 2017/2021",
    ),
    "cardiac": (
        "Use objective, drug-specific cardiac criteria (e.g. LVEF, recent-MI window) "
        "rather than broad 'clinically significant cardiac disease' exclusions.",
        "FDA 2020 (Organ Dysfunction); ASCO-Friends 2017",
    ),
    "prior_malignancy": (
        "Exclude a prior malignancy only when it could confound safety/efficacy; "
        "otherwise allow it, rather than a blanket 'cancer within X years' rule.",
        "FDA 2020 (Prior/Concurrent Malignancies); ASCO-Friends 2017",
    ),
    "age": (
        "Avoid arbitrary upper age caps and lower the minimum age where the science "
        "allows; justify any age limit by a specific safety or pharmacology concern.",
        "FDA 2020 (Minimum Age); ASCO-Friends 2017",
    ),
    "performance_status": (
        "Consider including ECOG 2 (or the equivalent) when patients are otherwise "
        "clinically stable, instead of restricting to ECOG 0-1.",
        "FDA 2024 (Performance Status); ASCO-Friends 2021",
    ),
    # --- categories WITHOUT formal FDA/ASCO guidance: neutral, no citation ---
    "diabetes": (
        "No specific FDA/ASCO guidance. Review whether excluding diabetes is "
        "scientifically necessary; consider allowing controlled diabetes with a "
        "documented HbA1c ceiling rather than a blanket exclusion.",
        "",
    ),
    "bmi": (
        "No specific FDA/ASCO guidance. Review whether the BMI or weight cap is "
        "scientifically necessary (e.g. a scanner limit) or could be relaxed.",
        "",
    ),
    "smoking": (
        "No specific FDA/ASCO guidance. Review whether the restriction is "
        "necessary; consider excluding only active use within a defined window "
        "rather than all current or former users.",
        "",
    ),
    "language": (
        "No specific FDA/ASCO guidance. Consider offering translated consent and "
        "patient-reported-outcome materials rather than an English-only requirement, "
        "which can disproportionately exclude limited-English communities.",
        "",
    ),
    "pregnancy": (
        "No specific FDA/ASCO guidance. Where the investigational agent allows, "
        "consider contraception requirements rather than a broad exclusion of all "
        "people who could become pregnant.",
        "",
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
