# Specific Aims — Patient Matching Engine (Aim 1)

Status: spec for build. No code yet. Companion to `docs/patient-matching.md`
(design/pseudocode). This file is the buildable breakdown: what to build, who owns
it, and how we know each piece is done.

Tagline this serves: *"A trial that could help you might be a few miles away, buried
in fine print. We read it for you, rule out what clearly won't fit, and show you who
to call nearby. Your next step: cross the threshold."*

Promise discipline: confident on EXCLUDE (an explicit criterion rules you out),
humble on INCLUDE (surviving = "worth a call," never "eligible"). We check 13
barriers, not full eligibility.

---

## Primary Aim

Given a signed-in patient's self-reported constraints, return every recruiting MA
cancer trial sorted into three buckets — **worth reaching out / ask about one thing /
likely not a fit** — each with the exact quoted criterion, an FDA/ASCO-grounded note
on soft hits, and the nearest MA site + contact. Entirely deterministic at query
time (no LLM, no network).

**Done when:** a patient profile produces the three buckets over all 1,011 trials in
<1s, every "rule-out" cites the verbatim `source_text`, and every bucket-1/2 trial
shows a reachable MA site + ClinicalTrials.gov contact link.

---

## Sub-Aim 1 — Constraint capture (profile → vector)
Owner: Namik (accounts) + P3

Build the structured questionnaire (§2 of patient-matching.md): one question per
category, coarse values (`yes/no/controlled/unknown`, etc.), plus numeric age.
Output = a `PatientVector` persisted on the Supabase profile.

- AC1: all 13 categories + age captured; every field defaults to `unknown`.
- AC2: `unknown` is a first-class value and never trips a match.
- AC3: the vector is the ONLY thing the matcher consumes (free-text path, if built,
  must populate this same vector — see Sub-Aim 5).
- AC4: a consent note + "13 barriers, not full eligibility" caveat shown at capture.

## Sub-Aim 2 — Pre-joined runtime index  ✅ DONE
Owner: P2 (data) · `eval/build_trials_enriched.py` -> `data/processed/trials_enriched.json`

Produce one build-time artifact the matcher reads, so runtime touches a single file.
Join on `nct_id`:
- `exclusions.csv` → barriers (category, absolute, threshold, source_text)
- `trials.csv` → title, phase, lead_sponsor, min_age, max_age
- `trial_sites.csv` → MA sites (facility, city, zip, county, county_fips)

- AC1: `data/processed/trials_enriched.json`, one record per trial with its
  exclusion rows + site list embedded.
- AC2: regenerated automatically when exclusions.csv changes (hook into
  `write_exclusions()`, same pattern as stats.json).
- AC3: 1,011 trial records; counts reconcile with the source CSVs.

## Sub-Aim 3 — The matcher (vector × index → buckets)
Owner: P3 — **implemented in TypeScript, inside the Next.js app.**

Decision: the matcher runs NO inference (it filters the precomputed
`trials_enriched.json`), so it is written in TS and deploys Vercel-native — no Python
service, no network, no live-LLM risk. This is the opposite of the researcher Linter,
which is the ONE feature that needs live inference (see note below).

Implement `classify()` from patient-matching.md §8: per-category `trips()` returning
hard/soft/none, plus the numeric age rule against min/max. Bucket by worst hit.

- AC1: hard hit (`absolute=true` tripped, or age out of range) → bucket 3.
- AC2: only soft hits (`absolute=false`) → bucket 2.
- AC3: no hits → bucket 1.
- AC4: `unknown` patient values never trip (verified by a test profile of all-unknown
  → every trial lands in bucket 1).
- AC5: deterministic + fast: same input → same output; full run <1s.

## Sub-Aim 4 — Results view + CTA + geography
Owner: P3

Render the three buckets. Each bucket-1/2 card: trial title/phase/sponsor, the
tripped category + verbatim `source_text`, the `suggest.py` note on soft hits, and a
**contact CTA** (ClinicalTrials.gov record / site contact). "Nearby" = same or
adjacent county from `county`/`county_fips` (coarse; precise geocoding is a stretch).

- AC1: bucket 1 CTA = "Contact the study team"; bucket 2 CTA = "Ask the team about
  [category]"; bucket 3 = reason shown, no primary contact CTA.
- AC2: the "13 barriers, not full eligibility" caveat is persistently visible.
- AC3: each surfaced trial shows >=1 MA site with its county; "nearby" ranking uses
  the patient's county when provided.
- AC4: the county/EJ overlay is reachable from results (ties to the equity thesis).

## Sub-Aim 5 (STRETCH) — Free-text constraint entry
Owner: P2 + P3

A "describe your health" box that runs `lint_criteria()` to populate the PatientVector
(the live-LLM path). Must degrade to the structured path if the service is down.

- AC1: free-text maps into the same PatientVector; nothing downstream changes.
- AC2: if the linter service is unreachable, the UI falls back to the structured form
  without error.

---

## Data dependencies (all exist today)
- `data/processed/exclusions.csv` — 3,839 rows, `absolute`/`threshold`/`source_text`
- `data/processed/trials.csv` — min_age/max_age (years; sub-year as fractions), phase, sponsor
- `data/processed/trial_sites.csv` — MA sites + county + county_fips
- `pipeline/extract/suggest.py` — the soft-hit note + FDA/ASCO citation

## Out of scope (be explicit)
- No eligibility *confirmation* — only rule-out + "worth a call."
- No numeric parsing of `threshold` strings (they're inconsistent free-text); matching
  is category-level coarse + the `absolute` flag.
- No precise geodistance in v1 (county-level "nearby" only).
- No non-13 criteria (cancer type, stage, biomarkers, prior therapy) — the CTA covers them.

## Demo path
Curated patient persona (e.g. "Maria: HIV-controlled, English-limited, ECOG 1") →
buckets render instantly from `trials_enriched.json` → click a bucket-2 trial → see
the HIV criterion quoted + the FDA "often unnecessary" note + the contact CTA. No live
call in the core path.
