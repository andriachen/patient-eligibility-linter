"""Task 1 - Bug condition exploration test (Property 1).

Encodes the EXPECTED behavior of the fixed P1 pipeline. It MUST FAIL on the
unfixed output (NCT07104331 has two Boston MA rows; distinct trials == 1170)
and MUST PASS after the per-site RECRUITING filter + Option A scoping fix.

Assertions (all parsed with csv.DictReader, never wc -l):
    (a) NCT07104331 has exactly one Boston MA site row.
    (b) distinct nct_id in trials.csv == distinct nct_id in trial_sites.csv.
    (c) distinct trial count == 1011.
"""

from __future__ import annotations

from tests.conftest import (
    SITES_CSV,
    TRIALS_CSV,
    distinct_nct_ids,
    read_rows,
)

EXPECTED_DISTINCT_TRIALS = 1011
DUP_NCT = "NCT07104331"


def test_nct07104331_has_exactly_one_boston_ma_site_row():
    sites = read_rows(SITES_CSV)
    boston = [
        r
        for r in sites
        if r["nct_id"] == DUP_NCT and r["city"].strip().upper() == "BOSTON"
    ]
    assert len(boston) == 1, (
        f"{DUP_NCT} should have exactly one Boston MA row (the RECRUITING one), "
        f"found {len(boston)}: {boston}"
    )


def test_trials_and_sites_have_the_same_distinct_nct_ids():
    trials_ids = distinct_nct_ids(read_rows(TRIALS_CSV))
    sites_ids = distinct_nct_ids(read_rows(SITES_CSV))
    assert trials_ids == sites_ids, (
        "trials.csv and trial_sites.csv should cover the same set of trials; "
        f"only in trials: {len(trials_ids - sites_ids)}, "
        f"only in sites: {len(sites_ids - trials_ids)}"
    )


def test_distinct_trial_count_is_1011():
    trials_ids = distinct_nct_ids(read_rows(TRIALS_CSV))
    assert len(trials_ids) == EXPECTED_DISTINCT_TRIALS, (
        f"expected {EXPECTED_DISTINCT_TRIALS} distinct trials, got {len(trials_ids)}"
    )
