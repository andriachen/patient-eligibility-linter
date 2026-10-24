# P2 Extraction Engine — Implementation Plan

- [ ] 1. Provider + model setup
  - [ ] 1.1 Add Anthropic SDK to `pipeline/extract/requirements.txt` and confirm it
        installs into `./.venv`
  - [ ] 1.2 Add `ANTHROPIC_API_KEY` and optional `P2_MODEL` to `.env.example`
  - [ ] 1.3 Confirm a current, non-EOL Anthropic Sonnet model id (Sonnet 4 is EOL
        2026-10-14) and set it as the default in config
  - _Requirements: 4.5, 7.1, 7.2_

- [ ] 2. Prompt + tool schema (`prompts.py`)
  - [ ] 2.1 Write `SYSTEM_PROMPT` embedding the 13 README category definitions
        verbatim + the extract-only / exact-quote / absolute / threshold rules
  - [ ] 2.2 Replace the placeholder tool with `EXTRACT_TOOL` = `extract_exclusions`,
        schema forcing `category` (enum of 13), `threshold` (string|null),
        `absolute` (bool), `section` (enum), `source_text` (string)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 3. Provider seam (`llm.py`)
  - [ ] 3.1 `extract_raw(text) -> list[dict]`: Anthropic client, forced tool_choice,
        temperature 0, parse tool-use block
  - [ ] 3.2 Read `ANTHROPIC_API_KEY`; clear error if missing
  - [ ] 3.3 Exponential backoff retries on rate-limit / 5xx
  - _Requirements: 4.1, 4.3, 7.1, 7.3_

- [ ] 4. Validation + dedupe helpers
  - [ ] 4.1 `normalize()` + `is_valid(source_text, eligibility_text)` substring check
  - [ ] 4.2 `dedupe(records)` — one row per category, absolute beats conditional,
        keep chosen record's threshold + source_text
  - [ ] 4.3 Unit tests for both (invalid category rejected, reflowed-text substring
        passes, absolute preference)
  - _Requirements: 2.1, 2.2_

- [ ] 5. Dev fixtures (`fetch_sample.py`)
  - [ ] 5.1 Sample 10 trials from `data/processed/trials.csv` (prefer longer
        eligibility text), write `sample_trials.json` with nct_id + eligibility_text
  - [ ] 5.2 Fallback to ClinicalTrials.gov API if trials.csv absent
  - _Requirements: 6.1, 6.2_

- [ ] 6. Batch engine (`extract.py`)
  - [ ] 6.1 Load input (json sample or trials.csv by extension)
  - [ ] 6.2 Per trial: cache hit -> load; else call `llm.extract_raw`, validate,
        write raw list to `data/cache/{nct_id}.json`
  - [ ] 6.3 Thread pool, max 5 concurrent
  - [ ] 6.4 Accumulate + print substring-failure report (never silent)
  - [ ] 6.5 CSV mode: attach nct_id, apply dedupe, write `exclusions.csv`
        (6 contract cols, sorted by nct_id, category)
  - [ ] 6.6 CLI: `--input sample_trials.json` and `--input ../../data/processed/trials.csv`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.2, 4.4_

- [ ] 7. Live linter (`lint.py`)
  - [ ] 7.1 `lint_criteria(text)` reuses `llm.extract_raw` + dedupe, returns contract
        fields minus nct_id plus empty `suggestion` / `suggestion_source`
  - [ ] 7.2 No nct_id / no cache dependency; mock fallback when key is missing
  - _Requirements: 5.1, 5.2, 5.3, 7.2_

- [ ] 8. Sample run + hand-check (gate before full run)
  - [ ] 8.1 Run `extract.py --input sample_trials.json`; iterate prompt until zero
        substring failures
  - [ ] 8.2 Hand-check 3 trials against the eligibility text; confirm categories,
        thresholds, and absolute flags look right
  - _Requirements: 2.3_

- [ ] 9. Full run + outputs
  - [ ] 9.1 Run `extract.py --input ../../data/processed/trials.csv`
  - [ ] 9.2 Verify `exclusions.csv`: one row per (nct_id, category), valid enum
        categories, every source_text passes substring validation
  - [ ] 9.3 Confirm a rerun makes zero API calls (cache hit on all)
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 10. Update AGENTS.md
  - Mark P2 components done with real numbers (trials extracted, total exclusions,
    rows after dedupe, substring failures, approx cost), note cache-invalidation
    rule and the eval-independence flag to P4
  - _Requirements: all_

## Notes
- Cache is lossless (all records); `exclusions.csv` is the deduped view. Never
  dedupe the cache.
- Iterate on the 10-sample set before the 1011 run to protect the $10 budget.
- Coordinate with P4: extractor model must differ from the gold-label model.
