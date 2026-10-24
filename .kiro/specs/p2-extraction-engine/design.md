# P2 Extraction Engine — Design

## Overview

P2 extracts restrictive eligibility criteria from each trial's `eligibility_text`
into the `exclusions.csv` contract, and exposes the same logic as a live
`lint_criteria(text)` call for the app. The provider is the Anthropic API (direct,
tool-use, temperature 0). A committed per-trial cache makes the full run a
one-time cost (~$10 budget, expected low single digits).

Pipeline shape:

```
trials.csv (1011) ─┐
                   ├─► extract.py ──► data/cache/{nct_id}.json ──► exclusions.csv
sample_trials.json ┘        │                (raw, all records)   (deduped rows)
                            │
         shared engine ◄────┴──── lint.py:lint_criteria(text) ◄── app Linter tab
```

Key principle: **cache is raw and lossless; `exclusions.csv` is the deduped view.**

## Modules & responsibilities

### `prompts.py` — system prompt + tool schema
Replaces the current placeholder (which used `{text, kind, category}` — wrong
contract). New contents:

- `SYSTEM_PROMPT`: embeds the 13 README category definitions **verbatim**, plus
  rules: extract ONLY those categories; quote `source_text` exactly from the input;
  `absolute = false` when the criterion is conditional; `threshold` is a short
  string or null; a criterion counts whether it sits in the inclusion OR exclusion
  section.
- `EXTRACT_TOOL`: a single tool `extract_exclusions` whose `input_schema` forces an
  array `exclusions` of objects with:
  - `category` — `enum` of the 13 values (model cannot invent a category)
  - `threshold` — string or null
  - `absolute` — boolean
  - `section` — `enum ["inclusion", "exclusion"]`
  - `source_text` — string
  Required: `category, absolute, section, source_text`.
- `MODEL` / config: a current non-EOL Anthropic model id, read from env with a
  sane default (Sonnet 4 is EOL as of 2026-10-14; pin a current Sonnet). The exact
  id is confirmed at build time against the live model list.

### `llm.py` (new, thin) — provider seam
A small wrapper so the call site is isolated:
- `extract_raw(text: str) -> list[dict]`: builds the messages, calls Anthropic with
  `tool_choice` forcing `extract_exclusions`, parses the tool-use block, returns the
  raw list of record dicts.
- Reads `ANTHROPIC_API_KEY`; raises a clear error if absent.
- Retry with exponential backoff ONLY on transient status (408/409/429/5xx) +
  connection errors; fail fast on 4xx (bad key / model / request) to avoid wasting
  calls and hiding the real cause.
- This is the ONLY file that imports the Anthropic SDK, so swapping to
  Bedrock/Gemini later touches one module.

**Temperature note (SDK 2.3.0 / Haiku 5.5):** the current models reject a
`temperature` parameter ("Extra inputs are not permitted"), and the typed SDK no
longer exposes it. So Requirement 4.1's "temperature 0" is satisfied in spirit by
**forced tool_choice + a tightly-constrained enum schema**, not a sampling temp.
Verified empirically: identical inputs produced identical category/quote sets
across repeated calls, so cache reproducibility holds.

**max_tokens = 4096** (not 2048) because dense trials can emit many records; a
`stop_reason == "max_tokens"` is logged as a truncation warning so partial tool
JSON never passes silently.

### `extract.py` — batch engine + CLI
- Loads trials from either `--input sample_trials.json` or
  `--input ../../data/processed/trials.csv` (detects by extension).
- For each trial: if `data/cache/{nct_id}.json` exists, load it; else call
  `llm.extract_raw(eligibility_text)`, validate, and write the raw list to cache.
- Concurrency via a thread pool, max 5 in flight.
- After each extraction, run **substring validation** and accumulate a failure
  report (trial id + offending quote). Never silently drop.
- CSV mode (`trials.csv`): after all trials are cached, build
  `exclusions.csv` by (a) attaching `nct_id`, (b) applying the dedupe rule, (c)
  writing the 6 contract columns sorted by `nct_id, category`.
- Prints a summary: trials processed, cache hits, records before/after dedupe,
  substring failures.

### `lint.py` — live single-text entry point
- `lint_criteria(text) -> list[dict]`: calls `llm.extract_raw(text)`, applies the
  same per-category dedupe, and returns dicts with
  `category, threshold, absolute, section, source_text, suggestion,
  suggestion_source` where the last two are `""` this phase.
- No `nct_id`, no cache. If the API key is missing, returns a small mock list so
  the app's Linter tab still renders (per Requirement 7.2).

### `fetch_sample.py` — dev fixtures
- If `data/processed/trials.csv` exists, sample 10 rows (prefer ones with longer
  `eligibility_text` so the sample exercises many categories) into
  `pipeline/extract/sample_trials.json` with `nct_id` + `eligibility_text`.
- Else fall back to the ClinicalTrials.gov v2 API
  (`fields=NCTId,EligibilityCriteria`).

## Data shapes

### Raw cache — `data/cache/{nct_id}.json`
Lossless: the full list the model returned, every occurrence, no dedupe.
```json
{
  "nct_id": "NCT01234567",
  "model": "<pinned model id>",
  "exclusions": [
    {"category": "renal", "threshold": "CrCl < 60", "absolute": true,
     "section": "exclusion", "source_text": "Creatinine clearance < 60 mL/min"},
    {"category": "renal", "threshold": null, "absolute": false,
     "section": "exclusion", "source_text": "significant renal impairment unless stable"}
  ]
}
```

### Contract output — `data/processed/exclusions.csv`
Deduped view. Columns exactly:
`nct_id, category, threshold, absolute, section, source_text`.

## Dedupe rule (decided)

Applied ONLY when writing `exclusions.csv` and inside `lint_criteria` — never to
the cache.

```
FUNCTION dedupe(records):
  group records by category
  FOR each category group:
    IF any record has absolute == true:
      candidates := records where absolute == true
    ELSE:
      candidates := all records in group
    chosen := candidates[0]   # first in document order among candidates
    emit one row: chosen.category, chosen.threshold, chosen.absolute,
                  chosen.section, chosen.source_text
```
Result: one row per (nct_id, category); a hard exclusion wins over a conditional
one; the chosen record keeps its own threshold and source_text.

## Substring validation

```
FUNCTION normalize(s): collapse all runs of whitespace to a single space, strip, casefold
FUNCTION is_valid(source_text, eligibility_text):
    RETURN normalize(source_text) in normalize(eligibility_text)
```
- Whitespace-normalized (not raw-exact) because the model reflows newlines; raw
  equality would cause false failures.
- Invalid records are KEPT in the cache (lossless) but LOGGED; the sample run's
  done-state is zero failures across the 10 trials.

## Cost control

- Cache skip => pay once. Reruns are free.
- temperature 0 => deterministic, no wasted sampling.
- Iterate the prompt on the 10-sample set; only run the full 1011 after the sample
  is clean.
- Order-of-magnitude: ~1011 calls, ~1–3k input tokens each + small structured
  output on a Sonnet-class model ≈ low single-digit dollars. Well under $10.

## Error handling

- Missing `ANTHROPIC_API_KEY`: `extract.py` exits with a clear message;
  `lint_criteria` returns the mock.
- Rate limit / 5xx: exponential backoff, capped retries; a trial that still fails
  is recorded in the failure report and left uncached so a later rerun retries it.
- Malformed tool output (no tool-use block): treat as zero exclusions for that
  trial, log it, leave uncached.

## Config / env

`.env` (not committed) and `.env.example` gain:
```
ANTHROPIC_API_KEY=
P2_MODEL=<current Sonnet id>     # optional override; code has a safe default
```

## Testing strategy

- **Unit:** dedupe rule (absolute beats conditional; one row per category);
  `normalize` + `is_valid` on reflowed text; schema enum rejects an invalid
  category.
- **Sample integration:** run `extract.py --input sample_trials.json`, assert zero
  substring failures and that 3 hand-checked trials look right (the plan's
  done-criteria).
- **Live lint:** `lint_criteria` on a pasted paragraph returns deduped records with
  empty suggestion fields; with no key set, returns the mock without raising.
- **Cache behavior:** second run over the same input makes zero API calls.

## Open coordination items

- **Eval independence:** the extractor model (Anthropic Sonnet) must differ from
  whatever model P4 uses to draft gold labels, or the eval is circular. Flag to P4.
- **Cache invalidation:** if `prompts.py` changes materially, clear `data/cache/`.
  The cache records the `model` id to help spot staleness.
