# Submission 

## Checklist

| Requirement | Status | Owner |
|---|---|---|
| Text description of features and functionality | Draft below | Andria |
| Demo video under 3:00, public on YouTube or Vimeo, no copyrighted music or third-party logos | Not recorded. Record after the 4:45 freeze. | Andria |
| Video shows the project running (the deployed web app in a browser) | Needs the live URL | Namik (Vercel) |
| Public GitHub repo with all source, assets, and run instructions | Repo is public. **README has no instructions for the web app** (`app/project-starter`) or `accounts/` | P3 / Namik |
| `/.kiro` at the repo root, not in `.gitignore` | Present: 2 specs. Not ignored. | done |
| Challenge track | Healthcare & biotech | done |
| Kiro write-up | Draft below. **Teammates must fill in the TODOs**; only describe what we actually did. | Arush, Namik, P3 |

## Links

- Repo: https://github.com/andriachen/patient-eligibility-linter
- Live app: TODO
- Demo video: TODO

## Track

Healthcare & biotech. Primary focus: access to clinical research (H5). Secondary: translation speed (H4).

## Project description

Threshold is an eligibility linter for the people who write cancer trial protocols at
Massachusetts biotechs and academic cancer centers. It reads the eligibility criteria of all
1,011 recruiting cancer trials with a Massachusetts site, uses an LLM to extract 13 kinds of
restrictive criteria (HIV, brain metastases, English-only requirements, organ-function
cutoffs, and more), and joins them to county health data (CDC PLACES 2023) and
environmental-justice data (MassGIS 2020) to show who each rule shuts out, and where.

What it found: 1 in 5 phase 1–3 drug trials (22%) still exclude people with HIV outright,
despite FDA guidance since 2020 that people with well-controlled HIV should generally be
eligible. About half the trials that mention HIV already set FDA-style conditions instead,
such as an undetectable viral load on treatment, so better wording is already in use. About 3 in 10
supportive-care and behavioral studies require a specific language, usually English, while
1 in 7 households in Suffolk County's environmental-justice neighborhoods have limited English.

Features:
- **Landscape:** how often each restriction appears across all trials, with a filterable table of the exact quoted criteria.
- **Map:** a Massachusetts county map by restriction type, with local trial counts and county health context.
- **Linter:** paste draft criteria and get each restriction flagged with its quoted sentence, a suggested rewording, and the FDA or ASCO–Friends of Cancer Research guidance behind it.
- **Accounts:** an optional profile prototype for patients and trial designers.

We measure our own AI. A person hand-labeled 42 randomly sampled trials. On 10 trials held
out from all prompt tuning, the extractor caught 92% of the restrictions the human found
(recall) and 98% of its flags were correct (precision). Every flag quotes the protocol
sentence it came from. The tool suggests changes; the protocol team decides.

## How we used Kiro

Paste-ready text for the form. Anything marked **[Arush: confirm]** must be checked by the
person who did it before we submit; delete a sentence rather than guess. Remove the markers
before pasting.

### Which Kiro tools we used

We used the **Kiro IDE** for the two parts of the pipeline where a mistake would silently
corrupt every number downstream: data ingest and LLM extraction. **[Arush: confirm, and add
whether anyone used Kiro CLI or Web.]** Smaller pieces (the eval scripts, the web app's
styling) were built faster with lighter tooling; we kept Kiro's spec workflow for the code
that defines our data.

### Spec-driven development

Both specs are committed in `.kiro/specs/`.

**1. `p2-extraction-engine` (feature spec: requirements → design → tasks).** This is the
core of the product: it turns each trial's free-text eligibility criteria into structured,
auditable records. We wrote seven requirements in WHEN/THEN/SHALL form before any code,
including:

- *Requirement 1:* extract only our 13 fixed categories, from inclusion **and** exclusion
  sections, and mark conditional rules ("uncontrolled", "unless stable for 4 weeks") as
  `absolute = false`.
- *Requirement 2, verifiable source quotes:* every record's quote must be an exact substring
  of the trial's criteria text.
- *Requirements 3–4:* a cached, resumable batch run with cost and rate limits, so a crash at
  trial 700 doesn't cost us the first 699 (we had a ~$10 API budget).
- *Requirement 5:* the same engine serves a live single-text `lint_criteria()` call.

The design doc then pinned down the module split (`prompts.py`, `llm.py`, `extract.py`,
`lint.py`), the cache and CSV data shapes, the dedupe rule, substring validation, and error
handling, and the task list broke it into 36 implementation steps.

What this bought us compared to vibe coding: the "verifiable quote" requirement became a
validation step in the design instead of something we'd remember later. It's why we can tell
judges that **3,801 of 3,839 flags (99%) quote the protocol word for word**, and why every
flag in the app links back to a sentence a reviewer can check. The design's thin provider seam (`llm.py`) keeps the model choice in one place.
**[Arush: confirm whether we actually switched models through it; add one moment where the
spec caught a problem before code existed.]**

**2. `p1-per-site-recruiting-filter` (bugfix spec, requirements-first).** Midway through,
we found that our trial pool was inflated: ClinicalTrials.gov's `RECRUITING` filter applies
to the trial, not to each site, so we were counting Massachusetts sites that weren't
recruiting. Kiro's bugfix spec made us write down three things separately:

- *Current behavior:* 1,877 site rows across 1,170 trials, including non-recruiting sites
  (for example, NCT07104331 had two Boston rows, one of them `NOT_YET_RECRUITING`).
- *Expected behavior:* keep only recruiting MA sites, and only trials with at least one.
- *Unchanged behavior:* the 6-column `trial_sites.csv` contract and the town-to-county
  crosswalk, which three teammates' code depended on.

The fix corrected the pool from **1,170 to 1,011 trials**, and every number in our pitch uses
the corrected pool. Writing "unchanged behavior" down first mattered on a four-person team:
the fix could not be allowed to break the data contract the app and the eval were built on.

### Property-based testing

The bugfix spec's task list drove a test-first sequence:

1. **Bug-condition test** (`tests/test_bug_condition.py`, Property 1). It encodes the
   expected behavior and was written to **fail on the unfixed output** (1,170 trials,
   NCT07104331 with two rows). It passes after the fix (1,011 trials, one row).
2. **Preservation property tests** (`tests/test_preservation.py`, Property 2). They use
   Hypothesis to sample 200 site rows and check that every one still has all 6 contract
   columns and a resolved county and FIPS code, and that the build still reports 0 unmatched
   cities. They were run on the unfixed code first to capture the baseline, then again after
   the fix.

A hand-written unit test would have checked one or two rows we thought of. The property test
checks the contract across whatever rows it samples, which is what protects the app and the
eval from a silent schema change. **[Arush: confirm; say whether either test caught a real
regression.]** `tests/test_p2_logic.py` adds unit tests for the extraction guards, such as
dropping a bare "age ≥ 18" floor and rejecting a quote filed under the wrong category.

### Agent hooks, steering docs, MCP, Kiro powers

We didn't use these during the hackathon, and we'd rather say so than pad the write-up.
Our project rules (team ownership, data contracts, the 13 category definitions) live in
`AGENTS.md` and `README.md` at the repo root, and the extraction spec quotes the category
definitions directly. Turning those into `.kiro/steering/` files, and adding a hook that
re-runs the eval whenever `exclusions.csv` changes, are the first things we'd add next.
**[Arush / Namik / P3: if you did use any of these, replace this paragraph with what you did
and commit the files.]**
