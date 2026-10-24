# Threshold

Threshold reads the eligibility criteria of every recruiting cancer trial in Massachusetts,
flags the rules that keep people out, and shows protocol teams what each rule costs, where,
and how other trials already word it more inclusively.

**Live:** [https://patient-eligibility-linter.vercel.app](https://patient-eligibility-linter.vercel.app?_vercel_share=wMmVOSq03cYcve3kSn3nu5h47uOwBPS3)
**Built for:** Hackachusetts 2026, Healthcare & biotech track (clinical research access)

Trial protocols are written once and copied forward. Exclusions such as "known HIV infection" or
"must speak English" are often boilerplate, not science, and they shut out patients long before
anyone looks at their cancer. Threshold is a linter for those rules. It suggests changes and cites
the guidance behind them; the protocol team decides.

## What we found

Across all **1,011 recruiting cancer trials with a recruiting Massachusetts site**
(ClinicalTrials.gov, pulled October 24, 2026):

- **1 in 5 phase 1–3 drug trials (22%, 166 of 748) still exclude people with HIV outright**, even
  though FDA guidance since 2020 says people with well-controlled HIV should generally be eligible.
  The fix is already in use: about half of the trials that mention HIV (177 of 347) set conditions
  instead, such as an undetectable viral load on treatment.
- **About 3 in 10 supportive-care, behavioral and quality-of-life studies (82 of 263) require a
  specific language**, usually English. In Suffolk County's environmental-justice neighborhoods,
  1 in 7 households (14.4%) has limited English.
- **Access is concentrated:** 945 of these trials recruit in Suffolk County, 24 in Hampden, 1 in
  Berkshire.

Sources: ClinicalTrials.gov API v2, CDC PLACES 2023, MassGIS Environmental Justice 2020. Guidance
citations are listed in [`docs/sources.md`](docs/sources.md).

## What's in the app

| Screen | What it does |
|---|---|
| **Landscape** | How often each of 13 restriction types appears across the 1,011 trials, with a filterable table of the exact quoted criteria. Every row links to its trial page. |
| **Map** | A county map of Massachusetts by restriction type, with CDC PLACES health measures and MassGIS environmental-justice measures for each county. **Who gets turned away** walks a sample patient through each restriction and shows how many local trials remain at each step. |
| **Linter** | Paste draft inclusion and exclusion criteria. Claude reads them with the same prompt and checks that extracted all 1,011 trials (or switch to in-browser keyword rules). Flags are grouped into *Fix first*, *Worth a look* and *Team's call*. Each one shows the quoted sentence, a suggestion with its cited guidance and, for blanket rules, standard inclusive wording you can copy, with a count of Massachusetts trials that already use conditional wording for that rule. |
| **Find Trials** | A patient-side prototype. Answer a few coarse questions (cancer type, age, county, HIV, daily activity, language, and more) and see trials sorted into *Worth reaching out*, *Ask about one thing* and *Likely not yet*, each with the sentence that put it there. Not medical advice. |
| **Trial pages** | One page per trial (1,011 in total) with the full criteria and every flagged sentence highlighted. |

## Can you trust it?

We measured our own AI instead of assuming it works.

- **A human-labeled answer key.** 42 trials: a seeded random sample of 30 (quotas by phase,
  sponsor type and cancer type), 2 added for BMI coverage, and 10 more drawn *after* prompt tuning
  and labeled blind. A person wrote every label; no model did.
- **Held-out accuracy (the 10 trials the prompt never saw):** the extractor caught 46 of the 50
  restrictions the human found (**recall 92%**), and 46 of its 47 flags were right (**precision 98%**).
  F1 0.95, 95% CI 0.89–0.99. With only 10 trials, the interval is wide.
- **Weak spots are shown, not hidden.** Prior malignancy is the weakest category (recall 72% across
  all 42 trials). Diabetes, BMI and smoking have only two labeled examples each, so we don't claim
  a score for them. Full table: [`eval/results.md`](eval/results.md).
- **Every flag shows its receipt.** All 3,839 flags in the dataset are checked to appear in their
  trial's criteria (ignoring whitespace, letter case and ClinicalTrials.gov's formatting escapes),
  and each trial page highlights them.
- **Citations say how strong they are.** Suggestions cite FDA and ASCO–Friends of Cancer Research
  guidance and mark it final, draft (ICH E21 for pregnancy) or general only (diabetes, BMI, smoking).
- **The live Linter matches the measured pipeline.** It uses the same model (`claude-haiku-5-5`) and
  prompt version as the batch extraction; `tests/test_prompt_parity.py` fails if the copies drift.

Reproduce the scores with `python eval/run_eval.py`.

## What the numbers don't say

- **The tool suggests; people decide.** Some exclusions are justified, for example pregnancy with a
  drug that can harm a fetus.
- **County figures are estimates for places, not people.** CDC PLACES gives county-level crude
  prevalence; MassGIS figures cover environmental-justice block groups only. We report each measure
  on its own and never add or multiply them across criteria.
- **BMI is an upper bound.** PLACES obesity means BMI 30 or more, so it's exact only for caps at 30.
- **A trial's site county stands in for where its patients come from.** Patients travel.
- **Find Trials is a first matcher.** It doesn't check a trial's sex requirement, cancer stage or
  treatment history.

## Privacy

- **Find Trials** uses your answers only to run the search. They aren't saved, shared or tied to you.
- **Linter** sends pasted text to Anthropic's API so Claude can read it. There is no database: the
  server keeps its last 200 results in memory so a repeat run of the same text is instant, and that
  memory clears when the server restarts. To keep a draft in your browser, choose **Keyword rules**.

## How it works

```
ClinicalTrials.gov API v2 ─> pipeline/ingest ─> trials.csv, trial_sites.csv   (town→county crosswalk)
CDC PLACES, MassGIS EJ ────> pipeline/ingest ─> county_metrics.csv, county_ej.csv

trials.csv ─> pipeline/extract   Claude, forced tool use over a fixed 13-category schema;
                                 every quote verified against the trial text
           ─> data/cache/{nct_id}.json ─> exclusions.csv
           ─> tag_trials.py      cancer-type and age tags, once per trial ─> trial_tags.json
           ─> eval/build_stats.py ─> stats.json            (Landscape headline and bars)
           ─> eval/build_trials_enriched.py ─> trials_enriched.json   (Find Trials index)

data/processed/* ─> app/project-starter (Next.js)  pages built ahead of time from the data
                    app/api/lint                   live Linter: same prompt and checks, plus keyword fallback
```

The raw API pages and the model outputs are committed, so the app runs, and the processed files
rebuild, without calling ClinicalTrials.gov or Claude again. Extraction and tagging are cache-first:
only new trials go to the model.

## Run it locally

You need Node 18.18 or newer. The data is already in the repo, so the web app runs with no API key:

```bash
cd app/project-starter
npm install
npm run dev        # http://localhost:3010
```

To use Claude in the Linter, create `app/project-starter/.env.local` with `ANTHROPIC_API_KEY=...`
(optional: `LINT_MODEL`, default `claude-haiku-5-5`). Without a key, the Linter uses keyword rules.

To rebuild the data or run the evaluation (Python 3.11 recommended; 3.9 works), from the repo root:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r pipeline/ingest/requirements.txt -r pipeline/extract/requirements.txt -r requirements-dev.txt
cp .env.example .env            # add ANTHROPIC_API_KEY for extraction and tagging

python -m pipeline.ingest.fetch_trials        # ClinicalTrials.gov -> data/raw/ctgov/
python -m pipeline.ingest.build_crosswalk     # -> ma_town_county.csv
python -m pipeline.ingest.build_trials        # -> trials.csv, trial_sites.csv
python -m pipeline.ingest.build_county        # -> county_metrics.csv, county_ej.csv
python -m pipeline.extract.extract --input data/processed/trials.csv
                                              # -> exclusions.csv; also re-tags new trials and
                                              #    rebuilds stats.json and trials_enriched.json
python eval/run_eval.py                       # human labels vs. extraction -> eval/results.md
python -m pytest                              # pipeline, parity and funnel tests
```

`vercel.json` deploys `app/project-starter` as a single Vercel service. Set `ANTHROPIC_API_KEY` on
the project to enable the live Linter.

## Repository layout

```
app/project-starter/   Next.js web app (Landscape, Map, Find Trials, Linter, trial pages, /api/lint)
app/main.py            earlier Streamlit prototype, no longer used
pipeline/ingest/       ClinicalTrials.gov, CDC PLACES and MassGIS ingest
pipeline/extract/      Claude extraction, suggestions, trial tagging, lint_criteria()
data/raw/, data/cache/ committed API pages and model outputs
data/processed/        contract CSVs and the app's indexes (stats.json, trial_tags.json, trials_enriched.json)
eval/                  gold-set picker, human labels, labeling guide, scoring
tests/                 pytest and Hypothesis tests
docs/                  pitch, slides, sources, submission write-up, matcher design
.kiro/specs/           Kiro specs: P1 per-site recruiting filter (bugfix), P2 extraction engine
AGENTS.md              build log and current state
```

---

## For contributors

### Ownership

| Phase | Folders |
|-------|---------|
| A Data | `pipeline/ingest/`, `data/raw/`, P1 CSVs in `data/processed/` |
| P2 LLM | `pipeline/extract/`, `data/cache/`, `data/processed/exclusions.csv` |
| P3 Frontend | `app/project-starter/` |
| P4 PM | root files, `eval/`, `docs/` |

### Data contracts (do not change without telling the team)

```
data/processed/trials.csv
  nct_id, title, phase, conditions (";"-separated), lead_sponsor,
  eligibility_text, min_age, max_age, reference_pmids (";"-separated)

data/processed/trial_sites.csv          # one row per MA site
  nct_id, facility, city, zip, county, county_fips

data/processed/ma_town_county.csv
  town, county, county_fips

data/processed/county_metrics.csv       # CDC PLACES, long format
  county, county_fips, measure_key, pct, low, high, population
  measure_key ∈ {diabetes, obesity, smoking, mental_distress, checkup}

data/processed/county_ej.csv            # EJ block groups rolled up to county
  county, county_fips, ej_block_groups, ej_population,
  ej_limited_english_pct, ej_minority_pct      # population-weighted, EJ areas only

data/processed/exclusions.csv
  nct_id, category, threshold, absolute (true/false),
  section (inclusion/exclusion), source_text

eval/gold_labels.csv
  nct_id, category, threshold, source_text     # one row per category PRESENT
```

Derived files, rebuilt by the scripts above: `stats.json` (`eval/build_stats.py`),
`trial_tags.json` (`pipeline/extract/tag_trials.py`) and `trials_enriched.json`
(`eval/build_trials_enriched.py`).

### Linter function

```
pipeline/extract/lint.py
  lint_criteria(text: str) -> list[dict]
  # each dict = exclusions.csv fields (minus nct_id) + "suggestion" + "suggestion_source"
```

The web Linter does the same in TypeScript: `app/project-starter/app/api/lint/route.ts` sends the
pasted text to Claude with a copy of the pipeline's prompt (`lib/extraction/prompt.ts`, guarded by
`tests/test_prompt_parity.py`) and applies the pipeline's checks (`lib/extraction/logic.ts`).
Without `ANTHROPIC_API_KEY` it falls back to keyword rules (`lib/mockLint.ts`). Suggestions live in
`pipeline/extract/suggest.py` and `lib/mockLint.ts`; `tests/test_suggest_parity.py` keeps them in sync.

### Categories (fixed — extract ONLY these)

Any criterion, in the inclusion OR exclusion section, that restricts who can enroll:

- **diabetes**: diabetes excluded, uncontrolled diabetes, HbA1c cap
- **bmi**: BMI or body weight cap
- **smoking**: current smoking / tobacco / nicotine use excluded
- **age**: maximum age cap, or minimum age above 18
- **renal**: creatinine, CrCl, or eGFR threshold; kidney disease
- **hepatic**: bilirubin, AST/ALT threshold; liver disease
- **cardiac**: NYHA class, recent MI, LVEF or QTc threshold
- **hiv**: HIV-positive excluded (HBV/HCV do NOT count)
- **brain_mets**: CNS/brain metastases excluded
- **prior_malignancy**: another cancer within X years excluded
- **performance_status**: ECOG or Karnofsky threshold
- **language**: must speak/read English (or a specific language)
- **pregnancy**: pregnant or breastfeeding excluded

`absolute = false` if conditional ("uncontrolled", "unless stable for 4 weeks").

### County FIPS

| County | FIPS | County | FIPS |
|--------|------|--------|------|
| Barnstable | 25001 | Hampshire | 25015 |
| Berkshire | 25003 | Middlesex | 25017 |
| Bristol | 25005 | Nantucket | 25019 |
| Dukes | 25007 | Norfolk | 25021 |
| Essex | 25009 | Plymouth | 25023 |
| Franklin | 25011 | Suffolk | 25025 |
| Hampden | 25013 | Worcester | 25027 |
