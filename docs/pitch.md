# Pitch (3 minutes)

Numbers are from `main` at 16:15: all 1,011 trials on prompt `v2-2026-10-24`. If the data changes:
`python eval/build_stats.py && python eval/run_eval.py`, then update this file and `docs/slides.html`.

Slides: `docs/slides.html` (9 slides). Spoken text is in quotes; about 440 words, so keep moving.

## 0:00–0:25 · Problem (slides 1–2)

> Finding a cancer trial is hard. Being allowed into one can be harder.
>
> Picture a 58-year-old in Boston with metastatic cancer. Her HIV has been undetectable on
> treatment for years, and she speaks Spanish at home. Her oncologist finds a promising drug
> trial, but it excludes anyone with HIV, controlled or not. A study on managing treatment
> fatigue turns her away too, because it requires English.
>
> Neither rule is about her cancer.

(The patient is illustrative. Say so if asked.)

## 0:25–0:55 · What we found (slide 3)

> We read the eligibility criteria of all 1,011 recruiting cancer trials with a Massachusetts site.
>
> **One in five drug trials still excludes people with HIV outright**, even though FDA guidance
> since 2020 says people with well-controlled HIV should generally be eligible. And the fix
> already exists: about half the trials that mention HIV set conditions instead, such as an
> undetectable viral load on treatment, which is what FDA recommends.
>
> **About 3 in 10** supportive-care and quality-of-life studies require a specific language,
> usually English. In Suffolk County's environmental-justice neighborhoods, **1 in 7 households**
> has limited English.
>
> And access is concentrated: 945 trials recruit in Suffolk. 24 in Hampden. One in Berkshire.

If over time, cut the access line; it's on the slide.

## 0:55–1:45 · Live demo (slide 4, then the app)

> Our user isn't the patient. It's the person who writes the protocol, because that's where
> these rules start.

1. **Landscape.** The headline reads "34.3% … set rules for people with HIV. 16.8% still exclude them outright."
   Click any trial ID in the table: the trial page shows its full criteria with the flagged sentence highlighted.
   > Every number here has a receipt. Click any row and you see the sentence it came from.
2. **Linter.** Paste the demo criteria below and run it. Expect 8 flags and the banner
   "This draft restricts 8 of 13 categories (8 outright). That's more than 83% of 1,011 recruiting
   Massachusetts cancer trials (median: 4)." (It rounds down so "more than" stays true: 849 of 1,011 is 83.98%.)
   > Eight flags, each quoting its sentence. This draft is more restrictive than 83% of
   > Massachusetts trials.
3. Open the **HIV** flag: suggestion plus "FDA 2020 (HIV, Hepatitis B, Hepatitis C, final); ASCO–Friends 2017". Then point at
   English or pregnancy, which cite weaker sources and say so (`general guidance only`, or `draft`).
   > For HIV it suggests the FDA wording and names the final guidance. For English, we cite the FDA 2020
   > diversity guidance and mark it as general-only; pregnancy cites ICH E21 and marks it as a draft.
4. **Map.** Select **language**, hover over **Suffolk**: 10.7% of its 945 trials restrict language; the
   county detail shows 14.4% limited-English households in its EJ block groups.
   > And this is where the English rule lands: 1 in 7 households in Suffolk's EJ neighborhoods.

> The tool suggests. The protocol team decides.

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

**"Who gets turned away" (Map page, below the map) is fixed and safe to show.** The traits name the
person on screen (`HIV, controlled on treatment`, `Limited English`), so "controlled HIV" only drops
trials whose rules exclude HIV outright — a conditional rule like "eligible if on ART with an
undetectable viral load" admits her and the funnel reflects that honestly. The example button
(58, controlled HIV, limited English, Hampden) gives **24 → 20 → 20 → 16**, and each step quotes
sentences from the trials it removed. Tick "Count only rules that exclude outright" to narrow
language to outright rules too: 24 → 20 → 20 → 18.

**Linter, as built:** keyword rules for the 13 categories, run in the browser so it works live
with no API key. It is not the model: on stage say "flags", not "AI", and point to the eval for
the AI part (the offline extraction behind Landscape and Map).

**Backup:** if the live demo fails, play the recorded video and keep talking.

## 1:45–2:35 · Can you trust it? (slides 5–7)

> Why should you trust any of this? Because we measured it.
>
> A person hand-labeled 42 randomly sampled trials. We tuned the AI on 32 of them, then drew 10
> new trials it had never seen. On those 10, it caught **46 of the 50** restrictions our labeler
> found: **92% recall**. And **46 of its 47** flags were right: **98% precision**.
>
> By category, it's strong where it matters. Prior malignancy is our weakest at 72%, and we show
> it. Diabetes, BMI and smoking have too few examples to score, so we don't claim one.
>
> And every flag quotes the protocol word for word, so a reviewer can check any flag in seconds —
> all 3,839 of them locate as a verbatim substring of their trial's text.

Numbers behind this (`eval/results.md`): held-out F1 0.95, 95% CI 0.89–0.99; tuning set 97% precision,
91% recall; all 42: 139 of 152 caught. Verbatim quotes: 3,839 of 3,839 flags (100%).

Sampling, if asked: seeded random draw (seed 2026) with quotas by phase (6/8/6/4/6) and sponsor
(12/12/6), max 5 per cancer type; 2 trials added for BMI coverage, marked targeted; 10 held-out
trials drawn after tuning and labeled blind. Labels are human-written; no AI wrote a label.

## 2:35–3:00 · Limits and close (slides 8–9)

> Our numbers are county estimates, never added together, and a trial's site county stands in
> for where its patients come from. We say so on every screen.
>
> Narrow criteria slow enrollment and decide who gets in. Fixing one rule helps both.
>
> Massachusetts is great at discovery. We fix the step where discovery becomes a trial.

---

## Judge Q&A prep

| Question | Answer |
|---|---|
| Why "1 in 5" and not the 46% on your Landscape data? | 46% of drug trials mention HIV, but about half of all trials that mention it set conditions instead, most often FDA-style ones such as an undetectable viral load on treatment (177 of 347). Only outright exclusions clearly go against the guidance: 22% of phase 1–3 drug trials (166 of 748), 17% of all trials (170). |
| Aren't some exclusions necessary? | Yes. Pregnancy with teratogenic drugs, high blood sugar with PI3K inhibitors, or HIV drug interactions with an investigational agent can be justified. We flag and cite; the protocol team decides. That's why the output is a suggestion. |
| How accurate is the AI? | On 10 held-out trials it never saw: 98% precision, 92% recall (F1 0.95, 95% CI 0.89–0.99). On the 30-trial random sample we tuned it on: 97% / 91%. Diabetes, smoking and BMI have only 2 gold examples each, so their 1.00 isn't meaningful. |
| Did you tune on your test set? | We tuned on the first 32, which is why we drew 10 more afterwards and labeled them blind. That's the number we quote. |
| Is the Linter tab the AI? | No. It uses keyword rules so it runs live in the browser. The AI does the offline extraction behind Landscape and Map, and that's what we measured. The rules agree with our human labels 95% of the time, but they were written with those trials in view, so we don't quote that as a test. |
| Isn't English needed for validated questionnaires? | Often, yes, and that's most of what we see in supportive-care studies. Many validated instruments have Spanish versions, and several MA studies already accept Spanish, Korean or Mandarin. We flag it; the team decides. |
| How do you get "% of people affected"? | CDC PLACES county prevalence (diabetes, smoking, obesity) and MassGIS EJ data (limited English, EJ block groups only). These are county estimates. We never add or multiply them across criteria. |
| Patients travel. Why county? | It's a simplification and we say so. Drive-time catchments are the next step. |
| What is Find trials? | A prototype for the patient side: answer a few questions, then see which trials you'd hit a barrier on before asking your oncologist. Separate from the public-data tool. |
| Who pays for this? | Sponsors and academic cancer centers, because slow enrollment is one of the costliest delays in drug development, and FDA is pushing for broader eligibility. |
| What about patient privacy? | The core tool uses only public data. The account prototype is optional and separate. |
| Why not just use ClinicalTrials.gov search? | Search helps a patient find trials. We help sponsors write criteria that let more people in. |

## Before rehearsal

- [x] Data rerun, `stats.json` and `results.md` rebuilt; Landscape headline now separates outright from conditional HIV rules
- [x] Linter shows real sources; Map shows real county numbers and limited-English households
- [x] Namik: fix or hide the "Who gets turned away" default (see the demo section)
- [ ] Confirm the demo criteria give 8 flags and "more than 83%" on the deployed site
- [ ] Record the backup demo video
- [ ] Rehearse twice with a timer
