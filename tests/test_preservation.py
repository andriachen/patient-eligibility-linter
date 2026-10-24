"""Task 2 - Preservation property tests (Property 2).

Captures the baseline behavior the fix MUST NOT regress. These PASS on the
unfixed code and must still PASS after the fix:

    - every trial_sites.csv row has exactly the 6 contract columns populated
      with a resolved county + county_fips,
    - the build reports 0 unmatched cities.

County resolution is exercised by invoking build() directly (observation-first):
it returns (trials, sites, unmatched) and we assert the unmatched set is empty
and every produced site row carries a resolved county/FIPS.
"""

from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

from pipeline.ingest.build_trials import build
from tests.conftest import SITES_CONTRACT, SITES_CSV, read_rows

# build() is deterministic over the on-disk raw pages; compute once.
_TRIALS, _SITES, _UNMATCHED = build()


def test_build_reports_zero_unmatched_cities():
    assert _UNMATCHED == set(), (
        f"build() should resolve every MA site city, found unmatched: {sorted(_UNMATCHED)}"
    )


def test_every_built_site_row_has_the_six_column_contract():
    assert _SITES, "expected at least one MA site row from build()"
    for row in _SITES:
        assert set(row.keys()) == set(SITES_CONTRACT), (
            f"site row must have exactly the 6 contract columns, got {sorted(row.keys())}"
        )


def test_every_built_site_row_has_resolved_county_and_fips():
    for row in _SITES:
        assert row["county"], f"row missing county: {row}"
        assert row["county_fips"], f"row missing county_fips: {row}"


def test_written_sites_csv_header_is_the_six_column_contract():
    import csv

    with SITES_CSV.open(newline="") as fh:
        header = next(csv.reader(fh))
    assert header == SITES_CONTRACT, f"trial_sites.csv header drifted: {header}"


@settings(max_examples=200, deadline=None)
@given(st.integers(min_value=0))
def test_sampled_rows_have_populated_contract_columns(seed):
    """Property: across sampled site rows, all 6 columns are present and the
    resolved county/FIPS fields are non-empty strings."""
    if not _SITES:
        return
    row = _SITES[seed % len(_SITES)]
    for col in SITES_CONTRACT:
        assert col in row
    assert isinstance(row["county"], str) and row["county"]
    assert isinstance(row["county_fips"], str) and row["county_fips"]
