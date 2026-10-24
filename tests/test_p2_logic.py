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


def test_bare_adult_floor_detection():
    from pipeline.extract.logic import is_bare_adult_floor

    # bare floors -> dropped
    assert is_bare_adult_floor("Age >= 18 years")
    assert is_bare_adult_floor("18 years of age or older")
    assert is_bare_adult_floor("at least 18 years of age")
    assert is_bare_adult_floor("Participants 18 years of age or older")
    # real restrictions -> kept
    assert not is_bare_adult_floor("<= 75 years")
    assert not is_bare_adult_floor("age 40-80 years")
    assert not is_bare_adult_floor(">= 21 years")
    assert not is_bare_adult_floor("early onset CRC (<55 years old)")
    assert not is_bare_adult_floor("")


def test_drop_noise_removes_bare_age_only():
    from pipeline.extract.logic import drop_noise

    recs = [
        {"category": "age", "source_text": "Age >= 18 years", "absolute": True,
         "section": "inclusion", "threshold": None},
        {"category": "age", "source_text": "<= 75 years", "absolute": True,
         "section": "inclusion", "threshold": "<=75"},
        {"category": "renal", "source_text": "CrCl < 60", "absolute": True,
         "section": "exclusion", "threshold": "CrCl<60"},
    ]
    out = drop_noise(recs)
    cats_quotes = [(r["category"], r["source_text"]) for r in out]
    assert ("age", "Age >= 18 years") not in cats_quotes  # dropped
    assert ("age", "<= 75 years") in cats_quotes  # kept
    assert ("renal", "CrCl < 60") in cats_quotes  # untouched


def test_quote_matches_category_keyword_guard():
    from pipeline.extract.logic import quote_matches_category

    # mis-filed quotes -> rejected
    assert not quote_matches_category("hiv", "active hepatitis B and hepatitis C infection")
    assert not quote_matches_category("smoking", "Current use of warfarin")
    assert not quote_matches_category("smoking", "Current alcohol or drug abuse")
    assert not quote_matches_category("pregnancy", "must use two forms of contraception")
    # correct quotes -> accepted
    assert quote_matches_category("hiv", "known HIV infection")
    assert quote_matches_category("smoking", "current tobacco or nicotine use")
    assert quote_matches_category("pregnancy", "pregnant or breastfeeding women")
    assert quote_matches_category("age", "anything")  # age exempt (numeric logic)


def test_drop_noise_removes_misfiled_category():
    from pipeline.extract.logic import drop_noise

    recs = [
        {"category": "hiv", "source_text": "hepatitis B and C infection"},
        {"category": "hiv", "source_text": "known HIV positive"},
        {"category": "pregnancy", "source_text": "two forms of contraception required"},
        {"category": "pregnancy", "source_text": "pregnant or breastfeeding"},
    ]
    out = [(r["category"], r["source_text"]) for r in drop_noise(recs)]
    assert ("hiv", "hepatitis B and C infection") not in out
    assert ("hiv", "known HIV positive") in out
    assert ("pregnancy", "two forms of contraception required") not in out
    assert ("pregnancy", "pregnant or breastfeeding") in out


def test_age_child_exclusion_boilerplate_dropped():
    from pipeline.extract.logic import is_bare_adult_floor

    q = ("Because no dosing or adverse event data are currently available on the use "
         "of the drug in patients < 18 years of age, children are excluded from this study")
    assert is_bare_adult_floor(q)  # not a real cohort age cap -> drop
    # a genuine pediatric-upper cap still kept
    assert not is_bare_adult_floor("patients must be < 30 years old at enrollment")


def test_age_cap_with_child_boilerplate_is_kept():
    from pipeline.extract.logic import is_bare_adult_floor

    # real 70 cap must survive even though child-exclusion boilerplate follows
    assert not is_bare_adult_floor("Age 18 to 70 years; children are excluded")
    assert not is_bare_adult_floor("Patients 21 to 65 years of age")


def test_age_regex_ignores_digits_in_drug_codes():
    from pipeline.extract.logic import is_bare_adult_floor

    # digits inside a code like SM08502 must NOT be read as ages 85/727
    q = "SM08502 (cirtuvivint): no data in patients < 18 years, children excluded"
    assert is_bare_adult_floor(q)  # still just child-exclusion boilerplate -> drop


def test_age_equal_to_18_not_a_range():
    from pipeline.extract.logic import is_bare_adult_floor

    # "to 18" must not be mistaken for a range like "18 to 70"
    assert is_bare_adult_floor("greater than or equal to 18 years")
    # a genuine range is still kept
    assert not is_bare_adult_floor("Age 18 to 70 years")


def test_age_trailing_period_still_counts():
    from pipeline.extract.logic import is_bare_adult_floor

    # a sentence-final "18." must still be read as the bare adult floor -> dropped
    assert is_bare_adult_floor("Age >= 18.")
    assert is_bare_adult_floor("Age minimum of age 18.")
    assert is_bare_adult_floor("Must be at least 18.")


def test_age_num_skips_decimals():
    # a decimal like 1.5 must not yield ages 1 or 5
    from pipeline.extract.logic import _AGE_NUM, normalize

    nums = _AGE_NUM.findall(normalize("creatinine 1.5; age >= 18"))
    assert "18" in nums
    assert "1" not in nums and "5" not in nums


def test_age_pediatric_17_cap_range_kept():
    from pipeline.extract.logic import is_bare_adult_floor

    # pediatric trials capped at 17 ARE an age restriction -> keep
    assert not is_bare_adult_floor("Ages 2 to 17 years")
    assert not is_bare_adult_floor("6 months to 17 years of age")


def test_keyword_guard_holes_fixed():
    from pipeline.extract.logic import quote_matches_category

    # previously wrongly DROPPED -> now kept
    assert quote_matches_category("renal", "Estimated glomerular filtration rate >= 45")
    assert quote_matches_category("renal", "creatinine clearance >= 60 mL/min")
    assert quote_matches_category("performance_status", "Eastern Cooperative Oncology Group 0-1")
    assert quote_matches_category("performance_status", "Eastern Oncology Group Status 0 to 1")
    # previously wrongly PASSED -> now dropped
    assert not quote_matches_category("brain_mets", "Evidence of metastatic disease")
    assert not quote_matches_category("hepatic", "History of breast cancer")  # 'ast' in breast
    # real short-keyword hits still work (whole-word)
    assert quote_matches_category("hepatic", "AST/ALT > 3x ULN")
    assert quote_matches_category("cardiac", "recent MI within 6 months")


def test_suggest_covers_all_13_categories():
    from pipeline.extract.suggest import suggest_for_category
    from pipeline.extract.prompts import CATEGORIES

    for cat in CATEGORIES:
        sugg, src = suggest_for_category(cat)
        assert sugg and isinstance(sugg, str)  # every category has a suggestion


def test_suggest_gap_categories_have_no_fabricated_source():
    from pipeline.extract.suggest import suggest_for_category

    # These have NO formal FDA/ASCO guidance (per docs/sources.md) -> empty source
    for cat in ("diabetes", "bmi", "smoking", "language", "pregnancy"):
        sugg, src = suggest_for_category(cat)
        assert src == "", f"{cat} must not cite a source"
        assert "no specific" in sugg.lower()


def test_suggest_guided_categories_cite_a_source():
    from pipeline.extract.suggest import suggest_for_category

    for cat in ("hiv", "brain_mets", "renal", "hepatic", "cardiac",
                "prior_malignancy", "age", "performance_status"):
        _, src = suggest_for_category(cat)
        assert ("FDA" in src) or ("ASCO" in src), f"{cat} should cite guidance"


def test_tool_schema_enum_matches_categories():
    enum = EXTRACT_TOOL["input_schema"]["properties"]["exclusions"]["items"][
        "properties"
    ]["category"]["enum"]
    assert enum == CATEGORIES
    assert len(CATEGORIES) == 13
