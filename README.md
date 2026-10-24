# Threshold

Surfaces and lints restrictive clinical-trial eligibility criteria for Massachusetts
oncology trials, with county-level health and environmental-justice context.

## Phases & ownership

| Phase | Owner | Folders |
|-------|-------|---------|
| P1 Data | `p1-data` | `pipeline/ingest/`, `data/raw/`, P1 CSVs in `data/processed/` |
| P2 LLM | `p2-extract` | `pipeline/extract/`, `data/cache/`, `data/processed/exclusions.csv` |
| P3 Frontend | `p3-app` | `app/` |
| P4 PM | `p4-eval` | root files, `eval/`, `docs/` |

Each folder has its own `requirements.txt`.

## Data contracts (do not change without telling the team)

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

## Linter function (P2 implements, P3 calls)

```
pipeline/extract/lint.py
  lint_criteria(text: str) -> list[dict]
  # each dict = exclusions.csv fields (minus nct_id) + "suggestion" + "suggestion_source"
```

## Categories (fixed — extract ONLY these)

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

## County FIPS

| County | FIPS | County | FIPS |
|--------|------|--------|------|
| Barnstable | 25001 | Hampshire | 25015 |
| Berkshire | 25003 | Middlesex | 25017 |
| Bristol | 25005 | Nantucket | 25019 |
| Dukes | 25007 | Norfolk | 25021 |
| Essex | 25009 | Plymouth | 25023 |
| Franklin | 25011 | Suffolk | 25025 |
| Hampden | 25013 | Worcester | 25027 |

## Setup

```bash
cp .env.example .env   # add ANTHROPIC_API_KEY (or Bedrock creds)
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r pipeline/ingest/requirements.txt
pip install -r pipeline/extract/requirements.txt
pip install -r app/requirements.txt
```

## Running

```bash
# P1: ingest
python -m pipeline.ingest.fetch_trials
python -m pipeline.ingest.build_crosswalk
python -m pipeline.ingest.build_trials
python -m pipeline.ingest.build_county

# P2: extract + lint
python pipeline/extract/fetch_sample.py
python pipeline/extract/extract.py --input ../../data/processed/trials.csv

# P3: app
streamlit run app/main.py

# P4: eval
python eval/run_eval.py
```

See `AGENTS.md` for the living build log and current state.
