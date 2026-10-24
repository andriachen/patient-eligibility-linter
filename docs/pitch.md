# Pitch (3 minutes)

Numbers are from the 13:55 data: Arush's full rerun, all 1011 trials on prompt `v2-2026-10-24`.
If the data changes again: `python eval/build_stats.py && python eval/run_eval.py`, then update them.

## 0:00–0:30 · Problem

> Finding a cancer trial is hard. Being allowed into one can be harder.
>
> Picture a 58-year-old in Boston with metastatic cancer. Her HIV has been undetectable on
> treatment for years, and she speaks Spanish at home. Her oncologist finds a promising drug
> trial. She's turned away for HIV before anyone looks at her tumor. Then a study on managing
> treatment fatigue turns her away too, because it requires English.
>
> Neither rule is about her cancer.

(The patient is illustrative. Say so if asked.)

## 0:30–1:00 · What we found

> We read the eligibility criteria of every recruiting cancer trial with a Massachusetts site:
> **1,011 trials**.
>
> - **1 in 3** restrict people with HIV, and in phase 1–3 drug trials it's **44%**. That's despite
>   FDA guidance since 2020 saying people with well-controlled HIV should generally be eligible.
> - **About 3 in 10** supportive-care, behavioral, and quality-of-life studies require a specific
>   language, usually English. In Suffolk County's environmental-justice
>   neighborhoods, about **1 in 7 households** has limited English.
> - And access is concentrated: 945 trials recruit in Suffolk, **24 in Hampden**, **1 in Berkshire**.

Show the Landscape page here (headline is the HIV line, from `data/processed/stats.json`).

Numbers for Q&A:
- HIV: 33.4% of all 1011 trials restrict (338), 16.3% exclude outright; 44.4% of phase 1–3 drug trials.
- Language: 82 of 263 non-drug studies flagged (31%); a 10-trial spot-check found 9 real, so about 28–30%.
  Phase 1–3 drug trials: 27 of 748 (3.6%). See `eval/language_spotcheck.md`.

## 1:00–2:00 · Live demo: the Linter

> Our user isn't the patient. It's the person who writes the protocol, because that's where
> these rules start.

1. Paste the demo criteria below into the Linter.
2. Point at the flags: HIV, brain metastases, English-only, prior cancer. Each one shows its exact quoted sentence.
3. Open one flag: the suggested rewording and the FDA or ASCO–Friends source it comes from.
4. Switch to the Map, select **language**, and hover over Suffolk.

> The tool doesn't decide. It shows the protocol team what each rule costs and what the
> guidance says. They make the call.

**Demo criteria to paste** (written for the demo, not from a real trial):

```
Inclusion Criteria:
* Age 18 to 75 years
* ECOG performance status 0-1
* Creatinine clearance >= 60 mL/min
* Must be able to read and speak English

Exclusion Criteria:
* Known HIV infection
* Brain metastases, treated or untreated
* Any prior malignancy within 5 years
* Pregnant or breastfeeding
```

**Blocked as of 13:45. Steps 3–4 fail unless these are fixed:**
- The Linter tab runs `lib/mockLint.ts` (regex). Its suggestions cite "mock protocol playbook" and
  its county impact is made up. Without the Anthropic key, the fastest honest fix: keep regex
  flags, but give each category a fixed suggestion + real source from `docs/sources.md`, and
  "no specific guidance" for diabetes, BMI, smoking, language, pregnancy. Drop or relabel the
  county impact list. (P3, with P2's suggestion text.)
- The Map shows 0% for every county: `loadCounties` never fills `trialsWithCategoryPct`. (P3)
- If the Linter isn't LLM-backed by demo time, don't call it "AI" on stage. Say "flags" and point
  to the eval for the AI part.

**Backup:** if the live Linter fails, play the recorded video and keep talking.

## 2:00–2:30 · We checked our own AI

> An LLM that flags medical criteria has to be checked. We hand-labeled 42 trials. We tuned our
> prompt on 32 of them, so we held 10 back that the AI never saw. On those 10, it matched our
> labels with **98% precision and 92% recall**. Every flag quotes its source
> sentence, and we show the categories where we don't have enough examples to score.

Show the "By subset" table in `eval/results.md`, or a one-slide version of it.

Sampling, for the slide: seeded random draw (seed 2026) with quotas by phase (6/8/6/4/6) and sponsor
(12/12/6), max 5 per cancer type; 2 trials added for BMI coverage, marked targeted; 10 held-out
trials drawn afterwards. Labels are human-written; the AI only helped find candidate sentences.

## 2:30–3:00 · Why it matters

> Narrower criteria slow enrollment, which slows the path from Massachusetts labs to patients.
> They also decide who gets access at all. Fixing one unnecessary rule helps both.
>
> Next: patients and caregivers can create a profile (our account prototype), so the same
> engine can show which criteria they'd hit before they ask their oncologist.
>
> Massachusetts is great at discovery. We fix the step where discovery becomes a trial.

---

## Judge Q&A prep

| Question | Answer |
|---|---|
| Aren't some exclusions necessary? | Yes. Pregnancy with teratogenic drugs, or high blood sugar with PI3K inhibitors, can be justified. We flag and cite; the protocol team decides. That's why the output is a suggestion. |
| How accurate is the AI? | On 10 held-out trials it never saw: 98% precision, 92% recall. On the 30-trial random sample we tuned it on: 96% / 91%. Every flag quotes its source sentence. Diabetes, smoking, and BMI have too few examples to score, and we say so. |
| Did you tune on your test set? | We tuned on the first 32, which is why we drew 10 more afterwards and report those separately. That's the number we quote. |
| Isn't English needed for validated questionnaires? | Often, yes, and that's most of what we see in supportive-care studies. Many validated instruments have Spanish versions, and several MA studies already accept Spanish, Korean, or Mandarin. We flag it; the team decides. |
| How do you get "% of people affected"? | CDC PLACES county prevalence (diabetes, smoking, obesity) and MassGIS EJ data (limited English, EJ block groups only). These are county estimates. We never add or multiply them across criteria. |
| Patients travel. Why county? | It's a simplification and we say so. Drive-time catchments are the next step. |
| Who pays for this? | Sponsors and academic cancer centers, because slow enrollment is one of the costliest delays in drug development, and FDA is pushing for broader eligibility. |
| What about patient privacy? | The core tool uses only public data. The account prototype is optional and separate. |
| Why not just use ClinicalTrials.gov search? | Search helps a patient find trials. We help sponsors write criteria that let more people in. |

## Before rehearsal

- [x] After Arush's rerun: rebuilt `stats.json` and `results.md`, updated the numbers, recomputed the language split
- [ ] Linter shows real sources, not "mock protocol playbook" (P3)
- [ ] Map shows real per-county percentages, not 0% (P3)
- [ ] Confirm the demo criteria trigger the expected flags on the deployed site
- [ ] Record the backup demo video
- [ ] Rehearse twice with a timer
