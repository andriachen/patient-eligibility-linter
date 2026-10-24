## Data contracts 
data/processed/trials.csv
  nct_id, title, phase, conditions (";"-separated), lead_sponsor,
  eligibility_text, min_age, max_age, reference_pmids (";"-separated)

data/processed/trial_sites.csv          # one row per MA site
  nct_id, facility, city, zip, county, county_fips

data/processed/ma_town_county.csv
  town, county, county_fips

data/processed/county_metrics.csv       # CDC PLACES, long format
  county, county_fips, measure_key, pct, low, high, population
  measure_key ∈ {diabetes, obesity, smoking, mental_distress, checkup}

data/processed/county_ej.csv            # EJ block groups rolled up to county
  county, county_fips, ej_block_groups, ej_population,
  ej_limited_english_pct, ej_minority_pct      # population-weighted, EJ areas only

data/processed/exclusions.csv
  nct_id, category, threshold, absolute (true/false),
  section (inclusion/exclusion), source_text

eval/gold_labels.csv
  nct_id, category, threshold, source_text     # one row per category PRESENT

## Linter function (P2 implements, P3 calls)
pipeline/extract/lint.py
  lint_criteria(text: str) -> list[dict]
  # each dict = exclusions.csv fields (minus nct_id) + "suggestion" + "suggestion_source"

## Categories (fixed — extract ONLY these)
Any criterion, in the inclusion OR exclusion section, that restricts who can enroll:
- diabetes: diabetes excluded, uncontrolled diabetes, HbA1c cap
- bmi: BMI or body weight cap
- smoking: current smoking / tobacco / nicotine use excluded
- age: maximum age cap, or minimum age above 18
- renal: creatinine, CrCl, or eGFR threshold; kidney disease
- hepatic: bilirubin, AST/ALT threshold; liver disease
- cardiac: NYHA class, recent MI, LVEF or QTc threshold
- hiv: HIV-positive excluded (HBV/HCV do NOT count)
- brain_mets: CNS/brain metastases excluded
- prior_malignancy: another cancer within X years excluded
- performance_status: ECOG or Karnofsky threshold
- language: must speak/read English (or a specific language)
- pregnancy: pregnant or breastfeeding excluded
absolute = false if conditional ("uncontrolled", "unless stable for 4 weeks")

## County FIPS
Barnstable 25001, Berkshire 25003, Bristol 25005, Dukes 25007, Essex 25009,
Franklin 25011, Hampden 25013, Hampshire 25015, Middlesex 25017,
Nantucket 25019, Norfolk 25021, Plymouth 25023, Suffolk 25025, Worcester 25027
