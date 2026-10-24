# P1 Per-Site RECRUITING Filter Bugfix Design

## Overview

The P1 ingest pipeline over-collects Massachusetts trial sites because the ClinicalTrials.gov v2 `filter.overallStatus=RECRUITING` filter is trial-level, not site-level. A trial recruiting overall can carry MA locations that are individually `NOT_YET_RECRUITING`, `WITHDRAWN`, `TERMINATED`, or `COMPLETED`, and `build_trials.py` writes all of them.

The fix is Option A: keep only locations whose per-site status is `RECRUITING`, and scope `trials.csv` to the trials that have at least one such site. This requires two code changes and a re-fetch:

1. `fetch_trials.py` must request the `LocationStatus` field so the raw pages carry per-site status. Because the existing resume logic skips pages already on disk (which lack `LocationStatus`), a `--force` flag is added to overwrite and re-fetch all pages.
2. `build_trials.py` must skip non-recruiting MA locations and then filter the trials list down to trials that produced at least one recruiting MA site.

The 6-column `trial_sites.csv` contract is unchanged — per-site status is used only for filtering, not stored.

## Glossary

- **Bug_Condition (C)**: A Massachusetts location whose per-site status is not `RECRUITING` is written to `trial_sites.csv`, or a trial with no recruiting MA site is written to `trials.csv`.
- **Property (P)**: Only MA locations with per-site status `RECRUITING` are written as site rows, and only trials with at least one such site are written as trial rows.
- **Preservation**: Recruiting MA sites, the 6-column site contract, trial columns, and county resolution / unmatched-city reporting all stay unchanged.
- **LocationStatus**: The ClinicalTrials.gov v2 field giving the recruitment status of an individual study location (`loc["status"]` in the flattened `contactsLocationsModule.locations[]`).
- **fetch_all**: The paging function in `pipeline/ingest/fetch_trials.py` that writes `data/raw/ctgov/page_{n}.json`; its resume logic skips pages already on disk.
- **build()**: The function in `pipeline/ingest/build_trials.py` that flattens raw pages into the `trials` and `sites` lists.

## Bug Details

### Bug Condition

The bug manifests during flattening in `build_trials.py`: the per-location loop checks only that the location's state is Massachusetts, then unconditionally appends a site row. There is no per-site status check, so non-recruiting MA locations are written. Compounding this, `trials.csv` is written from the full trials list rather than being scoped to trials that have a recruiting MA site. Upstream, `fetch_trials.py` does not request `LocationStatus`, so the per-site status is absent from the raw pages and cannot be used for filtering until a re-fetch.

**Formal Specification:**
```
FUNCTION isBugCondition(loc, trial)
  INPUT: loc of type Location (from contactsLocationsModule.locations[])
         trial of type Trial
  OUTPUT: boolean

  // A site is buggy if it is an MA location that is not RECRUITING but still written,
  // OR a trial is buggy if it has no recruiting MA site but is still written.
  RETURN (loc.state = "Massachusetts" AND upper(trim(loc.status)) != "RECRUITING")
         OR (trial has zero MA locations with upper(trim(status)) = "RECRUITING"
             AND trial is written to trials.csv)
END FUNCTION
```

### Examples

- NCT07104331 has two Boston MA locations, one `NOT_YET_RECRUITING` and one `RECRUITING`. Current output: 2 rows. Expected: 1 row (the `RECRUITING` one).
- A trial recruiting overall whose only MA location is `WITHDRAWN`. Current: 1 site row + 1 trial row. Expected: 0 site rows, trial excluded from `trials.csv`.
- A trial whose MA location is `RECRUITING`. Current: written. Expected: written (unchanged).
- Aggregate: current distinct trials = 1170, MA sites = 1877. Expected distinct trials = 1011, with the site count reduced to only recruiting MA sites.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Recruiting MA locations continue to be written to `trial_sites.csv` exactly as before.
- The `trial_sites.csv` contract stays at 6 columns (nct_id, facility, city, zip, county, county_fips); no status column is added.
- County resolution via the crosswalk and `MANUAL_OVERRIDES`, and the unmatched-city report, are unchanged.
- `trials.csv` columns are unchanged for every trial that remains.

**Scope:**
All inputs that do NOT involve a non-recruiting MA site are unaffected by this fix. This includes:
- MA locations with per-site status `RECRUITING`
- Trials that have at least one recruiting MA site
- City-to-county resolution and unmatched-city reporting

## Hypothesized Root Cause

Based on the bug analysis, the causes are:

1. **Missing API field (fetch)**: `fetch_trials.py` `FIELDS` omits `LocationStatus`, so saved pages have no per-site status to filter on. Existing pages must be re-fetched with `--force` because the resume logic skips pages already on disk.

2. **No per-site status filter (build)**: In `build_trials.py`, the per-location loop only checks `loc["state"] == "Massachusetts"` and appends unconditionally, keeping non-recruiting sites.

3. **Unscoped trials list (build)**: `trials.csv` is written from the full `trials` list rather than restricted to trials that produced at least one recruiting MA site, so trials with only non-recruiting MA sites inflate the distinct-trial count.

## Correctness Properties

Property 1: Bug Condition - Only Recruiting MA Sites and Their Trials Are Kept

_For any_ input where the bug condition holds (isBugCondition returns true) — a non-recruiting MA location, or a trial with no recruiting MA site — the fixed pipeline SHALL omit that location from `trial_sites.csv` and SHALL omit that trial from `trials.csv`, such that every site row has per-site status `RECRUITING` and the distinct `nct_id` count in `trials.csv` equals the distinct `nct_id` count in `trial_sites.csv` (1011). Specifically, NCT07104331 SHALL have exactly one Boston MA site row (the RECRUITING one).

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Recruiting Sites, Contract, and County Resolution

_For any_ input where the bug condition does NOT hold (isBugCondition returns false) — a recruiting MA location and the trial that owns it — the fixed pipeline SHALL produce the same result as the original pipeline: the site row is written with the same 6 columns, the trial row is written with the same columns, county resolution and unmatched-city reporting behave identically, and 0 cities are unmatched.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

Assuming the root cause analysis is correct:

**File**: `pipeline/ingest/fetch_trials.py`

**Function**: `FIELDS`, `fetch_all`, `main`

**Specific Changes**:
1. **Add LocationStatus field**: Insert `"LocationStatus"` into `FIELDS` immediately after `"LocationZip"`.
2. **Add --force flag**: Add a `--force` argument in `main()` and pass it through to `fetch_all(force=...)`.
3. **Honor --force in fetch_all**: When `force` is set, ignore existing `page_{n}.json` files (do not take the skip/resume branch) and overwrite them with freshly fetched pages that now include `LocationStatus`.

**File**: `pipeline/ingest/build_trials.py`

**Function**: `build`

**Specific Changes**:
4. **Per-site RECRUITING filter**: In the per-location loop, after the existing Massachusetts state check, add `if (loc.get("status") or "").strip().upper() != "RECRUITING": continue` so non-recruiting MA sites are skipped.
5. **Scope trials to recruiting MA sites (Option A)**: After building `sites`, compute `ma_trial_ids = {s["nct_id"] for s in sites}` and keep only trials whose `nct_id` is in that set before writing `trials.csv`.
6. **Keep the site contract and unmatched reporting unchanged**: Do not add a status column; continue collecting and reporting unmatched cities.

## Testing Strategy

### Validation Approach

The strategy is two-phase: first surface counterexamples that demonstrate the bug on the raw data as fetched WITH `LocationStatus`, then verify the fix filters correctly and preserves recruiting sites. Note that the exploration requires re-fetching with `LocationStatus` first, since the original pages lack per-site status.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug before implementing the build-side filter. Confirm the root cause (non-recruiting MA sites are kept and inflate counts).

**Test Plan**: Re-fetch pages with `LocationStatus` present, then parse the raw ctgov pages and the current `trial_sites.csv` to show that non-recruiting MA sites are written. Run against the UNFIXED `build_trials.py` to observe the inflated counts.

**Test Cases**:
1. **NCT07104331 Duplicate Site**: Assert NCT07104331 has exactly one Boston MA site row (will fail on unfixed code — it has two).
2. **All Sites Recruiting**: Assert every MA site row corresponds to a location whose per-site status is `RECRUITING` (will fail on unfixed code — some are `NOT_YET_RECRUITING`, etc.).
3. **Distinct Trial Count**: Assert distinct `nct_id` count in `trials.csv` equals 1011 (will fail on unfixed code — it is 1170).
4. **Trials/Sites Consistency**: Assert distinct `nct_id` in `trials.csv` equals distinct `nct_id` in `trial_sites.csv` (may fail on unfixed code — trials with only non-recruiting MA sites appear in trials.csv but, after filtering, not in sites).

**Expected Counterexamples**:
- NCT07104331 appears twice in `trial_sites.csv`.
- MA site rows exist whose underlying location status is not `RECRUITING`.
- Possible causes: missing per-site status filter in the build loop, unscoped trials list.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed pipeline produces the expected behavior.

**Pseudocode:**
```
FOR ALL loc WHERE isBugCondition(loc, trial) DO
  result := build_fixed()
  ASSERT loc NOT IN result.sites
  ASSERT every site row in result.sites has upper(trim(status)) = "RECRUITING"
  ASSERT distinct(result.trials.nct_id) = distinct(result.sites.nct_id) = 1011
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed pipeline produces the same result as the original for recruiting sites and their trials.

**Pseudocode:**
```
FOR ALL loc WHERE NOT isBugCondition(loc, trial) DO
  ASSERT build_original().site_row(loc) = build_fixed().site_row(loc)
  ASSERT build_fixed() reports 0 unmatched cities
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation because:
- It generates many location/trial records across the input domain.
- It catches edge cases that manual unit tests might miss.
- It gives strong guarantees that recruiting-site behavior is unchanged.

**Test Plan**: Observe behavior on recruiting MA sites (county resolution, 6-column rows, unmatched reporting), then assert those outputs hold after the fix.

**Test Cases**:
1. **Recruiting Site Preserved**: A recruiting MA site produces the same 6-column row before and after the fix.
2. **County Resolution Preserved**: City-to-county resolution and FIPS are unchanged for recruiting sites.
3. **Unmatched Reporting Preserved**: The unmatched-city report still runs and reports 0 unmatched cities.
4. **Trial Columns Preserved**: A trial with a recruiting MA site keeps all its `trials.csv` columns unchanged.

### Unit Tests

- `build()` skips a synthetic MA location with status `NOT_YET_RECRUITING`.
- `build()` keeps a synthetic MA location with status `RECRUITING`.
- A trial whose only MA location is non-recruiting is excluded from the trials list.
- `FIELDS` contains `LocationStatus`; `fetch_all(force=True)` overwrites an existing page.

### Property-Based Tests

- Generate random location lists with mixed statuses; assert only `RECRUITING` MA locations appear as sites.
- Generate random trials with recruiting MA sites; assert their site rows are byte-identical to the unfixed output (preservation).
- Across many generated inputs, assert distinct trial ids in sites equals distinct trial ids in the scoped trials list.

### Integration Tests

- Full P1 run: `fetch_trials --force`, optionally `build_crosswalk`, then `build_trials`; assert 1011 distinct trials, trials/sites id consistency, 0 unmatched cities.
- NCT07104331 end-to-end: exactly one Boston MA row after the run.
- Per-county site distribution is reported and non-empty for the expected counties.
