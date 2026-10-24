"""Unit tests for P2 pure helpers (validation + dedupe)."""

from pipeline.extract.logic import dedupe, is_valid, normalize, validate_records
from pipeline.extract.prompts import CATEGORIES, EXTRACT_TOOL


def test_normalize_collapses_whitespace_and_case():
    assert normalize("  HbA1c\n  >  8%  ") == "hba1c > 8%"


def test_is_valid_passes_on_reflowed_text():
    elig = "Inclusion Criteria:\n\n* Age >= 18 years\n* ECOG performance status <= 2"
    # model may reflow newlines to spaces
    assert is_valid("ECOG performance status <= 2", elig)
    assert is_valid("Age >=   18 years", elig)


def test_is_valid_fails_on_paraphrase():
    elig = "Patients must have adequate renal function."
    assert not is_valid("creatinine clearance below 60", elig)


def test_is_valid_empty_quote_is_invalid():
    assert not is_valid("", "anything")


def test_is_valid_handles_ctgov_backslash_escapes():
    # source text has CT.gov escapes; model quotes the clean form
    elig = "no active cancer for 3 years prior (Cycle 1 Day 1 \\[C1D1\\])"
    quote = "no active cancer for 3 years prior (Cycle 1 Day 1 [C1D1])"
    assert is_valid(quote, elig)


def test_is_valid_handles_escaped_comparison_operators():
    elig = "Platelets \\>75,000 and creatinine \\<1.5 x ULN"
    assert is_valid("Platelets >75,000", elig)
    assert is_valid("creatinine <1.5 x ULN", elig)


def test_is_valid_handles_escaped_caret():
    elig = "glomerular filtration rate >= 60 mL/min/1.73 m\\^2"
    assert is_valid("rate >= 60 mL/min/1.73 m^2", elig)


def test_is_valid_handles_html_entities():
    elig = "myocardial infarction \\&lt; 6 months ago"
    assert is_valid("myocardial infarction < 6 months ago", elig)


def test_validate_records_reports_only_failures():
    elig = "ECOG <= 2 and no active HIV infection."
    recs = [
        {"source_text": "ECOG <= 2"},
        {"source_text": "no active HIV infection"},
        {"source_text": "something the model hallucinated"},
    ]
    bad = validate_records(recs, elig)
    assert len(bad) == 1
    assert bad[0]["source_text"] == "something the model hallucinated"


def test_dedupe_absolute_beats_conditional():
    recs = [
        {"category": "renal", "threshold": None, "absolute": False,
         "section": "exclusion", "source_text": "renal impairment unless stable"},
        {"category": "renal", "threshold": "CrCl < 60", "absolute": True,
         "section": "exclusion", "source_text": "CrCl < 60"},
    ]
    out = dedupe(recs)
    assert len(out) == 1
    assert out[0]["absolute"] is True
    assert out[0]["threshold"] == "CrCl < 60"


def test_dedupe_one_row_per_category_preserves_order():
    recs = [
        {"category": "age", "threshold": "<= 75", "absolute": True,
         "section": "inclusion", "source_text": "age <= 75"},
        {"category": "hiv", "threshold": None, "absolute": True,
         "section": "exclusion", "source_text": "HIV positive"},
        {"category": "age", "threshold": "<= 80", "absolute": True,
         "section": "inclusion", "source_text": "age <= 80"},
    ]
    out = dedupe(recs)
    cats = [r["category"] for r in out]
    assert cats == ["age", "hiv"]  # one row per category, first-seen order
    assert out[0]["source_text"] == "age <= 75"  # first absolute candidate kept


def test_dedupe_all_conditional_keeps_first():
    recs = [
        {"category": "cardiac", "threshold": None, "absolute": False,
         "section": "exclusion", "source_text": "clinically significant arrhythmia"},
        {"category": "cardiac", "threshold": None, "absolute": False,
         "section": "exclusion", "source_text": "uncontrolled hypertension"},
    ]
    out = dedupe(recs)
    assert len(out) == 1
    assert out[0]["source_text"] == "clinically significant arrhythmia"


def test_tool_schema_enum_matches_categories():
    enum = EXTRACT_TOOL["input_schema"]["properties"]["exclusions"]["items"][
        "properties"
    ]["category"]["enum"]
    assert enum == CATEGORIES
    assert len(CATEGORIES) == 13
