# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Only Recruiting MA Sites and Their Trials Are Kept
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists (non-recruiting MA sites kept, inflated trial count)
  - **Prerequisite**: Re-fetch raw pages WITH `LocationStatus` first (`.venv/bin/python -m pipeline.ingest.fetch_trials --force`), since original pages lack per-site status
  - **Scoped PBT Approach**: For this deterministic data bug, scope the property to concrete failing cases from the design: NCT07104331 should have exactly one Boston MA row; distinct trials should be 1011
  - Test details from Bug Condition in design: parse `trials.csv` and `trial_sites.csv` with a CSV parser (NOT wc -l, eligibility_text has embedded newlines) and assert (a) NCT07104331 has exactly one Boston MA site row, (b) distinct nct_id in trials.csv equals distinct nct_id in trial_sites.csv, (c) distinct trial count equals 1011
  - The test assertions should match the Expected Behavior Properties from design (Property 1)
  - Run test on UNFIXED build output
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists: NCT07104331 has two rows, distinct trials is 1170)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Recruiting Sites, Contract, and County Resolution
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for recruiting MA sites: a recruiting MA location produces a 6-column row (nct_id, facility, city, zip, county, county_fips); city-to-county resolution and FIPS are populated; the build reports 0 unmatched cities
  - Write property-based tests capturing observed behavior from Preservation Requirements: for all recruiting MA locations, the produced site row has the same 6 columns and county resolution as the unfixed output, and the unmatched-city report still shows 0
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3. Fix per-site RECRUITING filtering in P1 ingest

  - [ ] 3.1 Add LocationStatus field and --force flag to fetch_trials.py
    - Add `"LocationStatus"` to `FIELDS` immediately after `"LocationZip"`
    - Add a `--force` CLI flag in `main()` and pass it through to `fetch_all(force=...)`
    - In `fetch_all`, when `force` is set, ignore existing `page_{n}.json` files (skip the resume branch) and overwrite them with freshly fetched pages that include `LocationStatus`
    - _Bug_Condition: isBugCondition where loc.status is absent/non-recruiting (from design)_
    - _Expected_Behavior: per-site status present in raw pages (Property 1 from design)_
    - _Preservation: existing paging and polite-delay behavior unchanged_
    - _Requirements: 2.2_

  - [ ] 3.2 Add per-site RECRUITING filter and Option A trial scoping to build_trials.py
    - In the per-location loop, after the Massachusetts state check, add `if (loc.get("status") or "").strip().upper() != "RECRUITING": continue`
    - After building `sites`, compute `ma_trial_ids = {s["nct_id"] for s in sites}` and keep only trials whose `nct_id` is in that set before writing `trials.csv`
    - Keep the 6-column `trial_sites.csv` contract unchanged (no status column); keep unmatched-city reporting
    - _Bug_Condition: isBugCondition(loc, trial) from design_
    - _Expected_Behavior: expectedBehavior(result) from design (Property 1)_
    - _Preservation: Preservation Requirements from design (Property 2)_
    - _Requirements: 2.1, 2.3, 3.1, 3.2, 3.3_

  - [ ] 3.3 Re-run the P1 pipeline with the fix
    - Run `.venv/bin/python -m pipeline.ingest.fetch_trials --force` (re-fetch WITH LocationStatus)
    - Run `.venv/bin/python -m pipeline.ingest.build_crosswalk` only if needed (crosswalk is unchanged)
    - Run `.venv/bin/python -m pipeline.ingest.build_trials`
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Only Recruiting MA Sites and Their Trials Are Kept
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Verify with a CSV parser: distinct nct_id in trials.csv equals distinct nct_id in trial_sites.csv, that count is 1011, NCT07104331 has exactly one Boston MA row, and 0 cities are unmatched
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Recruiting Sites, Contract, and County Resolution
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions: recruiting site rows, 6-column contract, county resolution, and 0 unmatched cities unchanged)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 4. Update AGENTS.md living doc
  - Update section 6 (current state + P1 numbers) to the corrected figures (1011 trials; recruiting MA sites; updated per-county distribution)
  - Add a dated entry to section 8 (change log) noting the per-site RECRUITING filter fix and that trials.csv is now scoped to trials with a recruiting MA site (1011)
  - _Requirements: 2.3_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Report the final numbers: distinct trials (1011), total MA site rows, and the per-county site distribution.
