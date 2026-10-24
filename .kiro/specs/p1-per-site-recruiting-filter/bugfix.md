# Bugfix Requirements Document

## Introduction

The P1 data-ingest pipeline keeps clinical-trial sites that are not actually recruiting. The ClinicalTrials.gov v2 query uses a trial-level `filter.overallStatus=RECRUITING` filter, but that filter does not constrain individual site status. A trial that is recruiting overall can still have Massachusetts sites whose own per-site status is `NOT_YET_RECRUITING`, `WITHDRAWN`, `TERMINATED`, `COMPLETED`, etc. The pipeline currently writes every MA site row regardless of its per-site status, inflating both the MA site count and the distinct-trial count.

Concretely, `trial_sites.csv` currently holds 1877 MA site rows across 1170 distinct trials. The correct number of trials with at least one actively-RECRUITING MA site is 1011. Trial NCT07104331 has two Boston/MA locations — one `NOT_YET_RECRUITING` and one `RECRUITING` — and the pipeline writes both rows when it should keep only the `RECRUITING` one.

The fix has two parts: (1) request the per-site `LocationStatus` field from the API and re-fetch the raw pages, since the existing saved pages do not contain per-site status; (2) filter sites to those whose per-site status is `RECRUITING`, and scope the trials output to trials that have at least one recruiting MA site.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a trial is recruiting overall but a Massachusetts location has per-site status `NOT_YET_RECRUITING`, `WITHDRAWN`, `TERMINATED`, or `COMPLETED` THEN the pipeline writes that non-recruiting site as a row in `trial_sites.csv`
1.2 WHEN the API is queried for trial fields THEN the request omits `LocationStatus`, so the saved raw pages contain no per-site status and non-recruiting sites cannot be distinguished from recruiting ones
1.3 WHEN a trial has only non-recruiting Massachusetts sites THEN that trial is still written to `trials.csv`, inflating the distinct-trial count to 1170 instead of 1011

### Expected Behavior (Correct)

2.1 WHEN a Massachusetts location has a per-site status other than `RECRUITING` THEN the system SHALL skip that location and SHALL NOT write it to `trial_sites.csv`
2.2 WHEN the API is queried for trial fields THEN the system SHALL request `LocationStatus` so that per-site status is present in the saved raw pages
2.3 WHEN a trial has no recruiting Massachusetts site THEN the system SHALL exclude that trial from `trials.csv`, so that the distinct trial count equals the number of trials with at least one recruiting MA site (1011)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a Massachusetts location has per-site status `RECRUITING` THEN the system SHALL CONTINUE TO write it to `trial_sites.csv` with the existing 6-column contract (nct_id, facility, city, zip, county, county_fips) unchanged
3.2 WHEN a site city is resolved to a county THEN the system SHALL CONTINUE TO use the existing crosswalk and manual-override resolution and SHALL CONTINUE TO report any unmatched cities
3.3 WHEN a trial has at least one recruiting Massachusetts site THEN the system SHALL CONTINUE TO write that trial's row to `trials.csv` with all existing columns unchanged
