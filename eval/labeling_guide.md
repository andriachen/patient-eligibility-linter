# Gold labeling guide

Labeler: Andria (P4). Labels are written by a human. AI or keyword search may only *find* candidate sentences.

## File format: `eval/gold_labels.csv`

```
nct_id,category,threshold,source_text
NCT01234567,performance_status,ECOG 0-1,ECOG performance status of 0 or 1
NCT01234567,renal,CrCl >= 50 mL/min,Creatinine clearance >= 50 mL/min (Cockcroft-Gault)
NCT07654321,none,,
```

- **One row per category present in a trial.** If a trial has two renal criteria, use one row: put the most restrictive threshold in `threshold` and quote the bullet that contains it.
- **A trial with no categories gets one `none` row**, so the eval can tell "labeled, nothing found" apart from "not labeled yet". `run_eval.py` uses `none` rows only to know which trials were labeled.
- `threshold`: the limit as written, shortened (`BMI > 35`, `ECOG 0-2`, `within 3 years`). Leave it blank if the criterion has no number.
- `source_text`: copy **one bullet exactly** from the criteria text, leaving out the leading `*` or number. Don't fix typos or spacing, because the eval checks that it's a substring of the criteria.
- Label criteria from **both** inclusion and exclusion sections when they restrict who can enroll (for example, `ECOG 0-1` under inclusion counts).

## Decisions by category

| Category | Label it | Don't label it |
|---|---|---|
| diabetes | "uncontrolled diabetes", HbA1c or fasting glucose cap, "type 1 diabetes excluded" | a generic "uncontrolled intercurrent illness" list that doesn't name diabetes |
| bmi | BMI cap, body weight cap (including scanner/table weight limits) | minimum weight only (pediatric dosing) |
| smoking | current smokers / tobacco / nicotine users excluded | trials that *require* smokers (cessation studies). Note these instead |
| age | maximum age cap; minimum age **above** 18 | "age >= 18"; pediatric minimums below 18 |
| renal | creatinine, CrCl, eGFR threshold; dialysis or kidney disease excluded; "adequate renal function" with no number (threshold blank) | urinalysis or proteinuria only |
| hepatic | bilirubin, AST/ALT threshold; cirrhosis / Child-Pugh; "adequate hepatic function" with no number | hepatitis B/C infection alone (not a category) |
| cardiac | NYHA class, recent MI or stroke window, LVEF, QTc; "clinically significant cardiovascular disease" (threshold blank) | hypertension only, unless it's "uncontrolled hypertension" listed with cardiac items (then cardiac) |
| hiv | HIV excluded, including conditional ("unless CD4 > 350 and undetectable viral load") | HBV/HCV only |
| brain_mets | untreated, active, or symptomatic brain/CNS metastases; leptomeningeal disease | primary brain tumor trials (the brain tumor is the disease) |
| prior_malignancy | another cancer within X years, even with exceptions like "except non-melanoma skin cancer" | the trial's own cancer history |
| performance_status | ECOG, Karnofsky, Lansky threshold | "life expectancy >= 12 weeks" alone |
| language | must read, speak, or understand English (or another named language) | "able to provide informed consent" with no language named |
| pregnancy | pregnant or breastfeeding excluded; positive pregnancy test excluded | contraception requirement alone |

Not a category, so skip: hematologic labs (ANC, platelets, hemoglobin), prior-therapy and washout rules, concomitant medications, disease definition ("histologically confirmed..."), consent and willingness items.

## Running log of new decisions

Add a line whenever you hit something the table doesn't cover. Mark anything that changes a category definition with **→ P2** and message P2 right away.

| Time | Trial | Situation | Decision | → P2? |
| 11:38 | NCT07349537 | "Primary CNS tumors" in exclusions | Tumor-type restriction, not prior_malignancy or brain_mets. Skip. | Yes |
| 12:05 | NCT07128303 | "Adequate organ function" with no organs named | Skip (too vague); label renal/hepatic only when the organ or lab is named | Yes |
| 12:14 | NCT04242095 | "endocrine (except diabetes/hyperglycemia)" in qualifying AE list | Not a diabetes exclusion; it defines qualifying side effects. Label none. | Yes |
| 12:29 | NCT06849713 | "CNS involvement" by leukemia | Count as brain_mets (CNS spread, same idea) | Yes |
| 12:29 | NCT06691217 | Cardiac disease is the study's own population | Skip cardiac when the condition IS the inclusion target | Yes |
| 12:29 | NCT06791057 | "English or Spanish" | Still language (restricts to named languages) | Yes |