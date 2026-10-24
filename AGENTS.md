# AGENTS.md — living context & build log

**Purpose:** single source of truth for any AI agent or teammate working this repo.
Read this first, then `README.md` for the data contracts. Update the relevant section
whenever you change state. Keep entries short and factual.

---

## 1. What we're building

A Streamlit app that flags restrictive eligibility criteria in **recruiting MA cancer
trials** (ClinicalTrials.gov), and shows **county-level** health (CDC PLACES) and
**environmental-justice** (MassGIS EJ) context for who those criteria exclude.

Three app tabs: **Landscape** (headline stats + per-category bars + filterable table),
**Map** (MA county choropleth by category), **Linter** (paste criteria → flagged list +
suggestions).

## 2. Architecture / data flow

```
ClinicalTrials.gov v2 ─┐
                       ├─ pipeline/ingest ─> data/processed/*.csv ─┐
CDC PLACES (SODA) ─────┤                                          ├─> app/ (Streamlit)
MassGIS EJ zip ────────┘                                          │
                                                                  │
EligibilityCriteria text ─> pipeline/extract (Anthropic tool-use) ┘
      └─> data/cache/{nct_id}.json  +  data/processed/exclusions.csv
      └─> lint.py:lint_criteria(text) called live by the app's Linter tab
```

## 3. Ownership (don't touch other folders)

| Phase | Branch | Owns |
|-------|--------|------|
| P1 Data | `p1-data` | `pipeline/ingest/`, `data/raw/`, P1 CSVs |
| P2 LLM | `p2-extract` | `pipeline/extract/`, `data/cache/`, `exclusions.csv` |
| P3 Frontend | `p3-app` | `app/` |
| P4 PM | `p4-eval` | root files, `eval/`, `docs/` |
| Accounts (Namik) | `namik` | `accounts/` (Next.js app: login + profile questions, Supabase, deployed on Vercel) |

## 4. Data contracts

Authoritative copy lives in `README.md` → "Data contracts". **Do not change a column
without posting to the team and updating both files.** Contract changes get logged in
section 8 below.

Category enum (extract ONLY these 13): `diabetes, bmi, smoking, age, renal, hepatic,
cardiac, hiv, brain_mets, prior_malignancy, performance_status, language, pregnancy`.

MA county FIPS 25001–25027 (odd only), 14 counties — see README.

## 5. Key external endpoints / params

- **Trials:** `GET https://clinicaltrials.gov/api/v2/studies`
  params: `query.locn=Massachusetts`, `query.cond=cancer`,
  `filter.overallStatus=RECRUITING`, `pageSize=200`,
  `fields=NCTId,BriefTitle,Phase,Condition,LeadSponsorName,EligibilityCriteria,`
  `MinimumAge,MaximumAge,LocationFacility,LocationCity,LocationState,LocationZip,`
  `ReferencePMID`. Page via `nextPageToken` until gone. Save `data/raw/ctgov/page_{n}.json`.
- **PLACES:** SODA URL — TODO paste from the kit. Map measure names → `measure_key`.
- **EJ:** download the block-group **zip** from the MassGIS/EJ portal into `data/raw/ej/`
  (the live query caps at 100 rows). Roll up `MUNICIPALITY → county`, population-weight
  `LIMENGHHPCT` and `PCT_MINORITY`.

## 6. Current state (update me!)

| Component | Status | Notes |
|-----------|--------|-------|
| Phase 0 scaffold | done | folders, .gitignore, README contracts, .env.example |
| README contracts | done | updated to authoritative contracts |
| P1 fetch_trials.py | done | 6 pages, 1170 studies; resumable, `--probe` to inspect |
| P1 build_crosswalk.py | done | 351 munis from Census cousub file; overrides for villages/typos |
| P1 build_trials.py | done | 1170 trials, 1877 MA sites, 0 unmatched cities |
| P1 build_county.py | done (PLACES) / blocked (EJ) | PLACES 70 rows; EJ needs the zip |
| trials.csv | done | 1170 records, all contract cols |
| trial_sites.csv | done | 1877 MA sites |
| ma_town_county.csv | done | 351 municipalities, 14 counties |
| county_metrics.csv | done | 70 rows = 14 counties x 5 measures (crude prevalence, 2023) |
| county_ej.csv | **blocked** | empty until EJ block-group zip is in data/raw/ej/ |
| P2 extract | todo | other owner |
| P3 app | todo | other owner |
| P4 eval/docs | todo | other owner |
| accounts/ | done | separate Next.js 16 app (not Streamlit): email login + branching profile wizard, saved to Supabase `profiles`; see accounts/README.md |

### P1 numbers (actual, from the run)
- trials: **1170**
- MA sites: **1877** (across 10 counties; Suffolk 1502, Worcester 98, Middlesex 94, Essex 84, Norfolk 48, Hampden 37, Plymouth 6, Bristol 3, Barnstable 3, Berkshire 2)
- unmatched cities: **0**
- trials w/ phase: 1047 · w/ max_age: 209 · w/ reference_pmids: 229 (all optional fields)

### Data notes
- `eligibility_text` contains embedded newlines, so `wc -l` over-counts trials.csv.
  Always count records with a CSV parser (1170 records, not 43k lines).
- PLACES: dataset `swc5-untb`, crude prevalence (`CrdPrv`), year 2023.
  measure_key→measureid: diabetes→DIABETES, obesity→OBESITY, smoking→CSMOKING,
  mental_distress→MHLTH, checkup→CHECKUP.
- Crosswalk source: Census 2020 cousub file
  `www2.census.gov/geo/docs/reference/codes2020/cousub/st25_ma_cousub2020.txt`.

## 7. How to run P1

```bash
pip install -r pipeline/ingest/requirements.txt
python -m pipeline.ingest.fetch_trials      # -> data/raw/ctgov/page_*.json
python -m pipeline.ingest.build_crosswalk    # -> data/processed/ma_town_county.csv
python -m pipeline.ingest.build_trials       # -> trials.csv, trial_sites.csv
python -m pipeline.ingest.build_county       # -> county_metrics.csv, county_ej.csv
```

## 8. Contract/definition change log

- 2026-10-24: README data contracts replaced the Phase-0 placeholder contracts
  with the authoritative ones from the team plan. No column has changed since.

## 9. Open questions / blockers

- **Accounts is its own Next.js app** in `accounts/`, deployed separately on Vercel (root
  directory `accounts`). It has its own `package.json` and `.env.local`
  (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Nothing in `app/` needs
  to change; link to its URL from the Streamlit app if wanted.

- **EJ zip (blocker for county_ej.csv):** download the EJ block-group file from the
  MassGIS/EJ portal, unzip into `data/raw/ej/`, then rerun
  `python -m pipeline.ingest.build_county`. If the column names differ from
  `MUNICIPALITY / POPULATION / LIMENGHHPCT / PCT_MINORITY`, pass
  `--ej-muni/--ej-pop/--ej-limeng/--ej-minority`.
- **PLACES URL:** currently using the default CDC SODA endpoint for `swc5-untb`.
  If the team's kit provides a different URL, pass `--places-url`.
- Field paths for the trials API were confirmed live via `fetch_trials --probe`.
