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

Later guidances in the same series:
- Performance Status: https://www.fda.gov/media/178018/download → `performance_status`
- Laboratory Values: https://www.fda.gov/media/178013/download → `renal`, `hepatic`
- Washout Periods and Concomitant Medications: https://www.fda.gov/media/178016/download (not one of our categories)

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

## Gaps for the rewording prompt
No FDA or ASCO-Friends guidance in this list covers `diabetes`, `bmi`, `smoking`, `language`, or `pregnancy`.
For those, P2's suggestions should say "no specific guidance; review whether the exclusion is scientifically necessary"
and not cite a source that doesn't address it.
