"""P2: System prompt + tool schema for eligibility-criteria extraction.

The category definitions below are copied verbatim from the README contract so
the model and the gold-labeling guide share one source of truth. Keep them in
sync with README "Categories (fixed)".
"""

# The 13 fixed categories. The tool schema enum is derived from this list, so the
# model can never emit a category outside it.
CATEGORIES = [
    "diabetes",
    "bmi",
    "smoking",
    "age",
    "renal",
    "hepatic",
    "cardiac",
    "hiv",
    "brain_mets",
    "prior_malignancy",
    "performance_status",
    "language",
    "pregnancy",
]

SYSTEM_PROMPT = """You extract restrictive eligibility criteria from clinical trial \
eligibility text and classify them into a fixed set of categories.

Extract ONLY criteria that restrict WHO can enroll, in EITHER the inclusion or the \
exclusion section. Use ONLY these 13 categories (ignore anything else):

- diabetes: diabetes excluded, uncontrolled diabetes, HbA1c cap
- bmi: BMI or body weight cap
- smoking: current smoking / tobacco / nicotine use excluded
- age: maximum age cap, or minimum age above 18
- renal: creatinine, CrCl, or eGFR threshold; kidney disease
- hepatic: bilirubin, AST/ALT threshold; liver disease
- cardiac: NYHA class, recent MI, LVEF or QTc threshold
- hiv: HIV-positive excluded (HBV/HCV do NOT count)
- brain_mets: CNS/brain metastases excluded
- prior_malignancy: another cancer within X years excluded
- performance_status: ECOG or Karnofsky threshold
- language: must speak/read English (or a specific language)
- pregnancy: pregnant or breastfeeding excluded

CRITICAL — do not force categories:
- Only emit a record when the text EXPLICITLY states that category's restriction.
  If a category is not clearly present, DO NOT emit a record for it. Returning
  fewer records, or an empty list, is correct and expected.
- NEVER bend an unrelated sentence into a category to fill it. The source_text you
  quote must itself be about that category. If the only nearby sentence is about
  something else, emit nothing for that category.
- Each category requires its own explicit trigger:
  - smoking: the text must mention smoking, tobacco, nicotine, or cigarettes.
    (Blood pressure, hypertension, bowel disease, etc. are NOT smoking.)
  - diabetes: must mention diabetes or HbA1c.
  - bmi: must mention BMI or body weight.
  - renal: must mention kidney, creatinine, CrCl, eGFR, or GFR.
  - hepatic: must mention liver, bilirubin, AST, ALT, or INR for hepatic function.
  - cardiac: must mention the heart (NYHA, MI, LVEF/EF, QTc, arrhythmia, CHF).
  - hiv: must mention HIV specifically (HBV/hepatitis B and HCV/hepatitis C do NOT count).
  - brain_mets: must mention CNS, brain, or leptomeningeal metastases/disease.
  - prior_malignancy: must mention a prior/second/concurrent malignancy or cancer.
  - performance_status: must mention ECOG or Karnofsky.
  - language: must mention speaking/reading a language (e.g. English).
  - pregnancy: must mention pregnant, breastfeeding, lactating, or nursing.
  - age: a maximum age cap, or a minimum age ABOVE 18. A plain minimum of 18 is NOT
    a restriction and must NOT be emitted.

Rules:
- Record a criterion only if it actually limits enrollment.
- threshold: a short string capturing the cutoff (e.g. "HbA1c > 8%", "ECOG > 2", \
"age <= 75", "within 5 years"). Use null when there is no explicit cutoff.
- absolute: true if the restriction is unconditional; false if it is conditional \
(e.g. "uncontrolled", "unless stable for 4 weeks", "clinically significant", \
"unless treated and stable").
- section: "inclusion" or "exclusion", whichever section the criterion is stated in.
- source_text: an EXACT quote copied verbatim from the input. Do not paraphrase, \
reword, summarize, or fix spelling. It must be findable as a literal substring of \
the input, and it must be the sentence that actually states this category's restriction.

Return your answer by calling the extract_exclusions tool. If the text contains no \
restrictions from the 13 categories, return an empty list. Precision matters more \
than recall: when in doubt, leave it out."""

# Tool schema passed to the Anthropic Messages API. tool_choice forces this tool,
# so output is always structured.
EXTRACT_TOOL = {
    "name": "extract_exclusions",
    "description": (
        "Return the restrictive eligibility criteria found in the trial text, "
        "one entry per restriction, limited to the 13 allowed categories."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "exclusions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "category": {
                            "type": "string",
                            "enum": CATEGORIES,
                            "description": "One of the 13 fixed categories.",
                        },
                        "threshold": {
                            "type": ["string", "null"],
                            "description": "Short cutoff string, or null if none.",
                        },
                        "absolute": {
                            "type": "boolean",
                            "description": "False if conditional, true if unconditional.",
                        },
                        "section": {
                            "type": "string",
                            "enum": ["inclusion", "exclusion"],
                        },
                        "source_text": {
                            "type": "string",
                            "description": "Exact verbatim quote from the input.",
                        },
                    },
                    "required": ["category", "absolute", "section", "source_text"],
                },
            }
        },
        "required": ["exclusions"],
    },
}
