# Patient-facing matching — design contract

Status: proposal for P3 (app) + Namik (accounts) to build against. No code yet.
Scope: turn a signed-in patient's self-reported constraints into a ranked view of
recruiting MA cancer trials, framed as "worth reaching out / ask about this /
probably not yet" with a contact-the-team call to action.

## 0. Framing & guardrails (read first)

- We screen only the **13 restrictive categories** in `exclusions.csv`. That is NOT
  full eligibility (cancer type, stage, biomarkers, prior therapy, labs outside the
  13, etc. are not modeled).
- Therefore every positive result is **"worth reaching out," never "you qualify."**
  The product's job is to surface open doors and drive a human confirmation, like a
  trial navigator — not to decide eligibility.
- One caveat sentence is always visible on results:
  > "We check 13 common eligibility barriers, not full eligibility. Contact the
  > study team to confirm."
- No diagnosis, no medical advice. We match stated constraints to published criteria.
- Patient health data is sensitive (Supabase `profiles`). Collect only the 13-category
  signals, show a consent note, don't over-collect.

## 1. User flow

1. **Account + profile** (accounts module, Supabase). The profile wizard captures the
   patient constraint vector (§2). Reuse the existing branching wizard.
2. **Constraint capture** — primary = structured questions (one per category, §2);
   optional = a free-text "describe your health" box that runs through the P2
   extractor (`lint_criteria`) to populate the SAME vector. Downstream only ever sees
   the vector, so the free-text path is additive, not required.
3. **Match** — deterministic join of the vector against `exclusions.csv` (§3). No LLM
   at query time.
4. **Results** — three buckets, each with a CTA (§4), plus the geography/EJ overlay.

## 2. Patient constraint vector

One field per category. Values are COARSE on purpose — thresholds in the data are
messy free-text (mixed units, per-arm, ranges), so we don't ask patients for exact
labs. Each field is one of: `yes` / `no` / `controlled` / `unknown` (per category
below). `unknown` = don't use this category to rule anything in or out.

| category | question (plain language) | values |
|----------|---------------------------|--------|
| diabetes | Do you have diabetes? Is it controlled? | none / controlled / uncontrolled / unknown |
| bmi | (optional) Is your BMI above ~33, or weight above ~100 kg? | no / yes / unknown |
| smoking | Do you currently use tobacco, nicotine, or vape? | no / yes / unknown |
| age | Your age (years) | integer / unknown |
| renal | Known kidney disease or reduced kidney function? | no / mild / significant / unknown |
| hepatic | Known liver disease or abnormal liver labs? | no / mild / significant / unknown |
| cardiac | Significant heart condition (recent MI, heart failure, arrhythmia)? | no / yes / unknown |
| hiv | HIV status? If positive, is it controlled on treatment? | negative / positive_controlled / positive_uncontrolled / unknown |
| brain_mets | Cancer spread to the brain / CNS? If so, treated & stable? | no / treated_stable / active / unknown |
| prior_malignancy | A different cancer in the past few years? | no / yes / unknown |
| performance_status | How active day-to-day? (maps to ECOG) | fully_active / restricted_but_mobile / limited / unknown |
| language | Do you read/speak English comfortably? (+ other languages) | english_ok / english_limited / unknown |
| pregnancy | Pregnant or breastfeeding? | no / yes / unknown |

Notes:
- `performance_status` uses a lifestyle proxy, not a number patients won't know:
  fully_active≈ECOG 0, restricted_but_mobile≈ECOG 1, limited≈ECOG 2+.
- `age` is the one clean numeric; the age match can use it against the trial's
  min/max age in `trials.csv` directly.

## 3. Match rules (vector × exclusions.csv)

For each trial, look at each of its exclusion rows. A row "trips" when the patient's
value conflicts with it. Because thresholds are unreliable free-text, the default is
a **category-level coarse match**, not numeric parsing. `unknown` never trips.

| category | trips when patient value is... | notes |
|----------|-------------------------------|-------|
| diabetes | `uncontrolled` (hard); `controlled` only trips `absolute=false` rows softly | controlled diabetes vs an HbA1c cap = "ask" |
| bmi | `yes` | coarse; we don't parse the exact cap |
| smoking | `yes` | |
| age | patient age outside the trial's min/max (from `trials.csv`) | the one numeric rule |
| renal | `significant` (hard); `mild` → soft | |
| hepatic | `significant` (hard); `mild` → soft | |
| cardiac | `yes` | |
| hiv | `positive_uncontrolled` (hard); `positive_controlled` → soft (many allow w/ CD4/VL) | this is the flagship "ask about it" case |
| brain_mets | `active` (hard); `treated_stable` → soft | |
| prior_malignancy | `yes` → soft (most are conditional / time-windowed) | |
| performance_status | `limited` (hard vs ECOG 0-1 trials); `restricted_but_mobile` → soft | |
| language | `english_limited` and trial requires English | |
| pregnancy | `yes` | |

"Hard" vs "soft" is cross-checked with the row's `absolute` field:
- tripped + `absolute=true`  → **hard barrier**
- tripped + `absolute=false` → **soft/conditional**
- not tripped                → no barrier from this row

## 4. Results — three buckets + CTA

Classify each trial by its worst tripped row:

1. **Worth reaching out** — no row trips.
   - CTA: **Contact the study team** (link to the ClinicalTrials.gov record / contact).
   - Inline caveat: "common barriers only, not full eligibility."
2. **Might be a fit — one thing to ask about** — only soft (`absolute=false`) rows trip.
   - Show the category + the exact `source_text` + the `suggest.py` suggestion
     ("FDA guidance says this exclusion is often unnecessary — worth asking").
   - CTA: **Ask the team about [category]**.
3. **Likely not a fit right now** — a hard (`absolute=true`) row trips.
   - Still show why (quoted sentence) + the suggestion, as the advocacy angle.
   - No contact CTA (or a secondary "ask anyway" link).

Within each bucket, the existing **geography/EJ overlay** applies: which counties
these trials recruit in, and the limited-English / health context — tying the patient
view back to the equity thesis.

## 5. Why this is demo-safe

- Matching is a **deterministic join** over `exclusions.csv` + `trials.csv` — no live
  LLM at query time, so it can't flake on stage (dodges the Python-on-Vercel problem
  for the core feature).
- Reuses what exists: accounts (profile), exclusions.csv (data), `suggest.py` (the
  "why it's unfair" line), county/EJ (the overlay).
- The `absolute` / `threshold` fields earn their keep: they power the hard-vs-soft
  bucketing, which is what makes "ask about this" credible.
- Optional free-text uses the live `lint_criteria()` path — attempt it as a stretch,
  but the structured path carries the demo if it's down.

## 6. Open decisions

- Structured questionnaire now; free-text (live extractor) as a stretch — confirm.
- "Pick from all 1011" vs a curated patient persona for the demo (a pre-filled profile
  like "Maria: HIV-controlled, English-limited" makes the story land fast and reliably).
- Exact ECOG proxy wording — clinician sanity-check if anyone's available.
