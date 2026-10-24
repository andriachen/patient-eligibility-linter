# P2 Extraction Engine — Requirements

## Introduction

Phase 2 turns each trial's free-text `eligibility_text` into structured, auditable
exclusion records. The same engine powers two consumers: a batch run that writes
`data/processed/exclusions.csv` over all ~1011 trials, and a live
`lint_criteria(text)` call the app's Linter tab invokes on pasted text.

The provider for this phase is the **Anthropic API** (direct), using the team's
own `ANTHROPIC_API_KEY` (~$10 budget). The design keeps a thin provider seam so a
different backend (Bedrock, Gemini) could be swapped in later, but Anthropic is
the only backend that must work for the hackathon.

Cost control is a first-class requirement: a committed per-trial cache means the
full run is paid for exactly once, and prompt iteration happens on a 10-trial
sample before any full run.

## Glossary

- **Extraction**: one model call that reads a trial's eligibility text and returns
  a list of exclusion records via forced tool use.
- **Exclusion record**: one restrictive criterion, matching the `exclusions.csv`
  contract minus `nct_id`: `category, threshold, absolute, section, source_text`.
- **Category**: one of the 13 fixed values in the README (diabetes, bmi, smoking,
  age, renal, hepatic, cardiac, hiv, brain_mets, prior_malignancy,
  performance_status, language, pregnancy).
- **source_text**: the exact span from the input eligibility text that justifies
  the record. Must be verifiable as a substring of the input.
- **Cache**: `data/cache/{nct_id}.json`, the raw per-trial model output, committed
  so the run is never repeated unnecessarily.
- **Substring validation**: the check that every `source_text` appears in the
  input eligibility text (after whitespace normalization).

## Requirements

### Requirement 1 — Structured extraction of the 13 categories

**User story:** As a protocol reviewer, I want each restrictive criterion extracted
into a typed record, so that I can see exactly which of the 13 categories a trial
restricts and why.

#### Acceptance Criteria
1. WHEN the engine processes a trial's `eligibility_text` THEN it SHALL return zero
   or more exclusion records, each with `category`, `threshold`, `absolute`,
   `section`, and `source_text`.
2. WHEN a record is produced THEN its `category` SHALL be one of the 13 README
   categories and nothing else.
3. WHEN a criterion appears in the inclusion section but still restricts who can
   enroll (e.g. a minimum age above 18) THEN the engine SHALL extract it with
   `section = "inclusion"`.
4. WHEN a criterion is conditional (e.g. "uncontrolled", "unless stable for 4
   weeks") THEN `absolute` SHALL be `false`; otherwise `true`.
5. WHEN a criterion has a numeric or categorical cutoff (e.g. "HbA1c > 8%",
   "ECOG > 2") THEN `threshold` SHALL capture it as a string; otherwise `null`.
6. WHEN the text contains no restriction in a category THEN the engine SHALL NOT
   fabricate a record for that category.

### Requirement 2 — Verifiable source quotes

**User story:** As an evaluator, I want every record anchored to an exact quote, so
that the output is auditable and the eval is trustworthy.

#### Acceptance Criteria
1. WHEN a record is produced THEN its `source_text` SHALL be a substring of the
   input eligibility text after whitespace normalization.
2. WHEN a `source_text` fails the substring check THEN the engine SHALL log the
   trial id and the offending quote and SHALL NOT silently drop the failure.
3. WHEN the 10-sample dev run completes THEN it SHALL report the count of
   substring failures, and the done-state is zero failures.

### Requirement 3 — Cached, resumable batch run

**User story:** As a teammate on a budget, I want extraction cached per trial, so
that the $10 is spent once and reruns are free.

#### Acceptance Criteria
1. WHEN a trial is extracted THEN its raw result SHALL be written to
   `data/cache/{nct_id}.json`.
2. WHEN a trial already has a cache file THEN the engine SHALL skip the model call
   and reuse the cached result.
3. WHEN the batch run finishes THEN it SHALL write
   `data/processed/exclusions.csv` with the full contract columns
   (`nct_id, category, threshold, absolute, section, source_text`).
4. WHEN the run is interrupted and restarted THEN it SHALL resume from the cache
   without re-calling already-cached trials.

### Requirement 4 — Cost and rate safety

**User story:** As the key owner, I want the run to be cheap and well-behaved, so I
don't exhaust the $10 or hit rate limits.

#### Acceptance Criteria
1. WHEN the engine calls the model THEN it SHALL use `temperature = 0`.
2. WHEN multiple trials are processed THEN concurrency SHALL be capped (limit 5).
3. WHEN the API returns a rate-limit or transient error THEN the engine SHALL
   retry with exponential backoff.
4. WHEN iterating on the prompt THEN the workflow SHALL use the 10-trial sample,
   not the full set.
5. WHEN the model is selected THEN it SHALL be a current, non-EOL Anthropic model
   pinned via configuration (not hardcoded to an EOL id).

### Requirement 5 — Live single-text linting

**User story:** As an app user, I want to paste criteria text and get the same
flags, so the Linter tab works without the batch pipeline.

#### Acceptance Criteria
1. WHEN `lint_criteria(text)` is called THEN it SHALL run the same extraction and
   return a list of dicts with the `exclusions.csv` fields minus `nct_id`, plus
   `suggestion` and `suggestion_source`.
2. WHEN called in this phase THEN `suggestion` and `suggestion_source` SHALL be
   empty strings (Phase 3 fills them).
3. WHEN `lint_criteria` runs THEN it SHALL NOT require an `nct_id` and SHALL NOT
   depend on the cache.

### Requirement 6 — Dev fixtures

**User story:** As a developer, I want a 10-trial sample, so I can iterate the
prompt cheaply and offline.

#### Acceptance Criteria
1. WHEN `fetch_sample` runs THEN it SHALL produce
   `pipeline/extract/sample_trials.json` with 10 recruiting MA cancer trials, each
   with at least `nct_id` and `eligibility_text`.
2. WHEN P1's `trials.csv` already exists THEN the sample SHALL be drawn from it to
   avoid extra API calls (fallback to the ClinicalTrials.gov API if absent).

### Requirement 7 — Provider configuration (Anthropic now, seam for later)

**User story:** As the builder, I want the provider chosen by config, so Anthropic
works today and another backend could slot in without rewriting the engine.

#### Acceptance Criteria
1. WHEN the engine starts THEN it SHALL read `ANTHROPIC_API_KEY` from the
   environment / `.env`.
2. WHEN the key is missing THEN the engine SHALL fail with a clear message (and
   `lint_criteria` MAY fall back to a mock so the app still renders).
3. WHEN provider selection is added THEN it SHALL default to Anthropic; other
   providers are out of scope for this phase but the call site SHALL be isolated
   enough to swap.

## Out of scope (this phase)
- Rewording suggestions (Phase 3, `suggest.py`).
- Non-Anthropic providers (kept as a seam only).
- Changing any data contract column.
