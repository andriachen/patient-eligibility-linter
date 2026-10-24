# Hackachusetts Trial Linter

A pipeline + app for surfacing and linting clinical trial eligibility criteria, with a Massachusetts-focused trial landscape and county-level context.

## Overview

The project is split into four phases:

- **P1 — Ingest** (`pipeline/ingest/`): fetch raw trial data (ClinicalTrials.gov), CDC PLACES, and EJ data, then build processed CSVs.
- **P2 — Extract** (`pipeline/extract/`): run an LLM extraction + lint pass over eligibility criteria, with a committed cache so nobody re-runs the LLM.
- **P3 — App** (`app/`): a Streamlit app that visualizes the trial landscape, a map view, and the linter.
- **P4 — Eval & Docs** (`eval/`, `docs/`): gold labels, precision/recall evaluation, and pitch/submission docs.

## Data Contracts

### `data/processed/trials.csv` (P1)
One row per trial.

| column | type | description |
|--------|------|-------------|
| nct_id | str | ClinicalTrials.gov identifier |
| title | str | brief title |
| status | str | recruitment status |
| conditions | str | pipe-delimited conditions |
| phase | str | trial phase |

### `data/processed/trial_sites.csv` (P1)
One row per (trial, site) location.

| column | type | description |
|--------|------|-------------|
| nct_id | str | ClinicalTrials.gov identifier |
| facility | str | site/facility name |
| city | str | site city |
| state | str | site state |
| county | str | resolved county |
| lat | float | latitude |
| lon | float | longitude |

### `data/processed/ma_town_county.csv` (P1)
Crosswalk from MA town to county.

| column | type | description |
|--------|------|-------------|
| town | str | MA town name |
| county | str | MA county name |

### `data/processed/county_metrics.csv` (P1)
CDC PLACES health metrics per county.

| column | type | description |
|--------|------|-------------|
| county | str | MA county name |
| metric | str | health measure |
| value | float | metric value |

### `data/processed/county_ej.csv` (P1)
Environmental justice indicators per county.

| column | type | description |
|--------|------|-------------|
| county | str | MA county name |
| indicator | str | EJ indicator |
| value | float | indicator value |

### `data/processed/exclusions.csv` (P2)
Lint output: flagged exclusion criteria.

| column | type | description |
|--------|------|-------------|
| nct_id | str | ClinicalTrials.gov identifier |
| category | str | lint category |
| text | str | matched criterion text |
| suggestion | str | optional reworded suggestion |

### `data/cache/{nct_id}.json` (P2)
Raw LLM extraction output per trial, committed so the LLM is not re-run.

## Setup

```bash
cp .env.example .env   # add your ANTHROPIC_API_KEY
python -m venv .venv && source .venv/bin/activate
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
python -m pipeline.extract.fetch_sample
python -m pipeline.extract.extract

# P3: app
streamlit run app/main.py

# P4: eval
python eval/run_eval.py
```
