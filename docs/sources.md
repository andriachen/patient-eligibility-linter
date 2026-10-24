# Sources

## Data
- ClinicalTrials.gov API v2, U.S. National Library of Medicine: https://clinicaltrials.gov/data-api/api
- CDC PLACES, county data (2023 release, crude prevalence): https://data.cdc.gov/resource/swc5-untb
- MassGIS Environmental Justice Populations (2020 block groups), Commonwealth of Massachusetts: https://arcgisserver.digital.mass.gov/arcgisserver/rest/services/AGOL/EJ2020/MapServer/0

## Rewording guidance: FDA

Final guidances (2020): *Cancer Clinical Trial Eligibility Criteria*
- Brain Metastases: https://www.fda.gov/media/121317/download → `brain_mets`
- Patients with HIV, Hepatitis B Virus, or Hepatitis C Virus Infections: https://www.fda.gov/media/121319/download → `hiv`
- Patients with Organ Dysfunction or Prior or Concurrent Malignancies: https://www.fda.gov/media/123745/download → `renal`, `hepatic`, `cardiac`, `prior_malignancy`
- Minimum Age Considerations for Inclusion of Pediatric Patients: https://www.fda.gov/media/121318/download → `age`

Later guidances in the same series (final):
- Performance Status (2026): https://www.fda.gov/media/178018/download → `performance_status`
- Laboratory Values (2026): https://www.fda.gov/media/178013/download → `renal`, `hepatic`
- Washout Periods and Concomitant Medications: https://www.fda.gov/media/178016/download (not one of our categories)

Related final FDA guidances:
- Enhancing the Diversity of Clinical Trial Populations (2020): https://www.fda.gov/media/127712/download → cited as general support for `diabetes`, `bmi`, `smoking`, `cardiac`, `language`
- Inclusion of Older Adults in Cancer Clinical Trials (2022): https://www.fda.gov/media/135402/download → `age`

Draft guidance:
- ICH E21: Inclusion of Pregnant and Breastfeeding Individuals in Clinical Trials (draft, 2025) → `pregnancy` (cited as draft; not a final recommendation)

Index of all FDA Oncology Center of Excellence guidances:
https://www.fda.gov/about-fda/oncology-center-excellence/oncology-center-excellence-guidance-documents

## Rewording guidance: ASCO and Friends of Cancer Research

2017 joint research statement, *Journal of Clinical Oncology* (overview: https://pmc.ncbi.nlm.nih.gov/articles/PMC5692724):
- Brain metastases: https://ascopubs.org/doi/abs/10.1200/JCO.2017.74.0761 → `brain_mets`
- HIV/AIDS: https://ascopubs.org/doi/full/10.1200/JCO.2017.73.7338 → `hiv`
- Organ dysfunction, prior or concurrent malignancies, comorbidities: https://ascopubs.org/doi/abs/10.1200/JCO.2017.74.4102 → `renal`, `hepatic`, `cardiac`, `prior_malignancy`
- Minimum age: https://ascopubs.org/doi/abs/10.1200/JCO.2017.74.4144 → `age`

2021 "Modernizing Clinical Trial Eligibility Criteria" series, *Clinical Cancer Research*:
- Performance status: https://aacrjournals.org/clincancerres/article/27/9/2424/672050/Modernizing-Clinical-Trial-Eligibility-Criteria → `performance_status`
- Laboratory tests: https://aacrjournals.org/clincancerres/article/27/9/2416/672177/Modernizing-Clinical-Trial-Eligibility-Criteria → `renal`, `hepatic`

Friends of Cancer Research hub for all of the above: https://friendsofcancerresearch.org/clinical-trial-eligibility-criteria/

## Strength of each citation

The 13 categories have very different levels of guidance. The suggestion source string
on every flag names the strength so a reviewer can read it directly:

- **Category-specific FDA + ASCO–Friends** (strongest): `brain_mets`, `hiv`, `renal`, `hepatic`,
  `cardiac`, `prior_malignancy`, `performance_status`, `age`.
- **General FDA guidance only** (annotated as "general guidance only"): `diabetes`, `bmi`,
  `smoking`, `language` — cited to the 2020 FDA *Enhancing Diversity* guidance, which
  argues for broader inclusion but does not set category-specific thresholds.
- **Draft guidance only** (annotated as "draft"): `pregnancy` — cited to ICH E21 (draft, 2025).

The suggestion sources must stay honest: do not drop a strength label, and do not cite
a document that doesn't address the category. `pipeline/extract/suggest.py` is the source
of truth; the live Linter copies the same table via `app/project-starter/lib/mockLint.ts`
(parity enforced by `tests/test_suggest_parity.py`).
