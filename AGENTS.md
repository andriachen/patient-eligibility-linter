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
| Accounts (Namik) | `namik` | `accounts/` (Next.js app at `/account`: login + profile questions, Supabase) |

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
  `LocationStatus,ReferencePMID`. Page via `nextPageToken`. Save `data/raw/ctgov/page_{n}.json`.
  Per-site RECRUITING filtering happens in build_trials (see change log).
- **PLACES:** `https://data.cdc.gov/resource/swc5-untb.json?stateabbr=MA&datavaluetypeid=CrdPrv`
  (crude prevalence, county level). Map measureid → `measure_key`.
- **EJ:** live from MassGIS ArcGIS FeatureServer (no manual download):
  `https://arcgisserver.digital.mass.gov/arcgisserver/rest/services/AGOL/EJ2020/FeatureServer/0/query`
  Page 2000 rows at a time. Every BG in the layer is EJ-designated. Fields:
  `MUNICIPALITY, TOTAL_POP, LIMENGHHPCT, PCT_MINORITY`. `--ej-local` forces the
  `data/raw/ej/` file fallback.

## 6. Current state (update me!)

| Component | Status | Notes |
|-----------|--------|-------|
| Phase 0 scaffold | done | folders, .gitignore, README contracts, .env.example |
| README contracts | done | updated to authoritative contracts |
| P1 fetch_trials.py | done | 6 pages, 1170 studies; requests LocationStatus; `--force` re-fetch, `--probe` to inspect |
| P1 build_crosswalk.py | done | 351 munis from Census cousub file; overrides for villages/typos |
| P1 build_trials.py | done | filters to RECRUITING MA sites; 1011 trials, 1537 sites, 0 unmatched |
| P1 build_county.py | done | PLACES 70 rows; EJ fetched live from MassGIS ArcGIS (2604 BGs) |
| trials.csv | done | 1011 records (scoped to trials w/ a recruiting MA site) |
| trial_sites.csv | done | 1537 recruiting MA sites |
| ma_town_county.csv | done | 351 municipalities, 14 counties |
| county_metrics.csv | done | 70 rows = 14 counties x 5 measures (crude prevalence, 2023) |
| county_ej.csv | done | 14 counties, 2604 EJ block groups, pop-weighted limEng/minority |
| P2 prompts/llm/logic | done | Anthropic tool-use, claude-haiku-5-5, 20 unit tests green |
| P2 extract.py | done | cached batch + CLI; sample run clean |
| P2 lint.py | done | lint_criteria reuses engine; mock fallback w/o key |
| P2 sample (10 trials) | done | 0 substring failures; hand-check clean after prompt tighten |
| exclusions.csv (full run) | done | **v2 prompt, all 1011 uniform**; 3792 rows; 0 contract violations |
| P2 suggest.py | done | template, 13 cats, FDA/ASCO-cited; 5 gap cats say "no guidance" w/ empty source; wired into lint.py |
| P3 app | done (frontend) | Next.js at `app/project-starter` (NOT Streamlit); Landscape/Map read real CSVs, Linter still uses `mockLint.ts`; deploys on Vercel |
| P4 eval | done | run_eval.py: micro F1 **0.93** (P 0.96 / R 0.91), CI [0.90,0.97]; results.md |
| P4 docs | todo | sources.md / pitch.md / submission.md |
| accounts/ | done | separate Next.js 16 app (not Streamlit): email login + branching profile wizard, saved to Supabase `profiles`; see accounts/README.md |

### P1 numbers (actual, after per-site RECRUITING filter)
- trials: **1011** (each has >=1 actively recruiting MA site; Option A scoping)
- MA sites: **1537** (recruiting only; across 10 counties; Suffolk 1241, Worcester 75,
  Essex 71, Middlesex 71, Norfolk 43, Hampden 24, Plymouth 6, Bristol 3, Barnstable 2,
  Berkshire 1)
- unmatched cities: **0**
- note: before the fix these were 1170 trials / 1877 sites — those counted MA sites
  whose per-site status was NOT_YET_RECRUITING / WITHDRAWN / TERMINATED / COMPLETED.

### Data notes
- `eligibility_text` contains embedded newlines, so `wc -l` over-counts trials.csv.
  Always count records with a CSV parser (1011 records, not ~40k lines).
- `overallStatus=RECRUITING` is TRIAL-level, not SITE-level. build_trials filters each
  MA location on `loc["status"] == "RECRUITING"`; fetch_trials must request
  `LocationStatus` (re-fetch with `--force` if old pages lack it).
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
- 2026-10-24: **P1 per-site RECRUITING filter fix.** `filter.overallStatus=RECRUITING`
  is trial-level, so non-recruiting MA sites were being kept. fetch_trials now requests
  `LocationStatus` (+ `--force` to re-fetch); build_trials skips MA sites that aren't
  `RECRUITING` and scopes trials.csv to trials with >=1 recruiting MA site (Option A).
  trials 1170→1011, MA sites 1877→1537. No contract columns changed (6-col sites kept;
  status used only for filtering). Spec: `.kiro/specs/p1-per-site-recruiting-filter/`.
- 2026-10-24: **EJ unblocked.** build_county now fetches the MassGIS 2020 EJ layer
  live from its ArcGIS FeatureServer (2604 block groups, paged) instead of needing a
  manual zip. county_ej.csv populated for all 14 counties. `--ej-local` keeps the
  file fallback. Pop field is `TOTAL_POP` (not `POPULATION`). **P1 fully complete.**
- 2026-10-24: **P2 engine built + sample-validated.** Anthropic tool-use extractor,
  model `claude-haiku-5-5` (default; `P2_MODEL` overrides). SDK 2.3.0 dropped the
  `temperature` kwarg and Haiku 5.5 rejects it — determinism comes from forced
  tool_choice + enum schema (verified stable across repeat calls). Retries only on
  transient status (429/5xx), fail-fast on 4xx. `normalize()` strips CT.gov
  backslash escapes (`\[ \> \^` etc.) so verbatim quotes match escaped source text.
  Dedupe = one row per (nct_id, category), absolute beats conditional, applied only
  when writing exclusions.csv / in lint (cache stays lossless). Sample (10 trials):
  0 substring failures; a prompt-tightening pass ("do not force categories;
  precision > recall") removed false positives (smoking=IBD/hypertension, fabricated
  age). Cache is prompt-version-sensitive — **clear data/cache/ if prompts.py changes.**
- 2026-10-24: **P2 full run complete.** All 1011 trials extracted (cached).
  exclusions.csv = 4304 rows across 926/1011 trials; 0 invalid categories, 0 empty
  quotes, 0 dup (nct,category) pairs. Two run-time fixes: (a) model sometimes returns
  `exclusions` as a JSON *string* — `_parse` now json.loads it (was erroring 9 trials);
  (b) records whose source_text can't be verified are DROPPED when writing
  exclusions.csv (26 unverifiable raw records excluded — empties + encoding junk +
  rare paraphrase), so every CSV row has an auditable quote. `normalize` also decodes
  HTML entities (&lt;/&gt;). Top categories: performance_status 59.5%, pregnancy
  53.3%, prior_malignancy 51.5%, brain_mets 45.9%, cardiac 45.5%; language 10.5%
  (the EJ equity angle).
- 2026-10-24: **P2/eval hardening (fixes a train/eval mismatch).** Prior eval
  measured only 22 re-extracted gold trials while the app showed 989 old-prompt
  rows. Fixes: (1) full v2 re-extraction of ALL 1011 trials + `PROMPT_VERSION` in
  each cache record (stale entries auto-re-extract); (2) category-keyword guard in
  `logic.drop_noise` drops mis-filed quotes (hiv-is-hepatitis, smoking-is-warfarin,
  pregnancy-is-contraception); (3) age child-exclusion boilerplate now dropped;
  (4) `_parse` rejects invalid categories (e.g. `bilirubin_placeholder`); (5)
  `run_eval.py` rewrites only the table block between markers, preserving the
  narrative; (6) bootstrap 95% CI on F1. Result: exclusions.csv 4098→3792 rows,
  uniform v2; **eval now describes the shipped data: micro F1 0.93 (P 0.96 / R 0.91),
  CI [0.90, 0.97].** Model `claude-haiku-5-5`; MAX_WORKERS 5→12.
- 2026-10-24: **Age-unit bug fix in build_trials.** `_age_number` dropped the unit,
  so "6 Months" became 6 (read as 6 years). Now normalizes ALL units to YEARS
  (months/weeks/days/hours/minutes, singular + plural): "6 Months"→0.5, "29 Days"→0.08,
  "1 Year"→1. ~28 min_age + 3 max_age values corrected; 18 sub-year trials in the
  1011 set now carry fractional ages. Unknown units emit "" rather than a wrong number.
  No re-fetch needed (raw pages unchanged); rebuilt trials.csv only. Matters for the
  P2 `age` category.

## 9. Open questions / blockers

- **P1: none.** All six CSVs are populated. (EJ no longer needs a manual download.)
- **PLACES URL:** using the default CDC SODA endpoint for `swc5-untb`. If the team's
  kit provides a different URL, pass `--places-url`.
- **Accounts is its own Next.js app** in `accounts/`, served at `/account` by the root
  `vercel.json` (basePath `/account`; locally http://localhost:3000/account). It has its
  own `package.json` and `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`); set the same two on the Vercel project.
- Field paths for the trials API were confirmed live via `fetch_trials --probe`.
