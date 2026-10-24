# accounts/ — optional login + profile questions

Email/password login (Supabase Auth) in the sidebar, and a "My profile" tab that asks
one question per screen. The first question picks a role and the rest branch:

- **patient / caregiver**: age, sex, town (→ county), travel distance, cancer type,
  stage, treatment status, health conditions, BMI, smoking, activity level (ECOG),
  pregnancy, language, free-text notes
- **trial_designer**: org type and name, job, cancer focus, phases, counties, goals, notes

Logging in is optional: Landscape, Map and Linter work without it.

## Setup (once)

1. Create a Supabase project. In **Authentication → Sign In / Providers → Email**, turn
   off **Confirm email** so sign-ups log in straight away.
2. Paste `accounts/schema.sql` into the project's SQL editor and run it.
3. Add the project URL and anon (publishable) key to `.env`:
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ANON_KEY=...
   ```
4. `pip install -r accounts/requirements.txt`

Try it on its own: `python -m streamlit run accounts/demo.py`

## Hook for P3 (app/main.py)

```python
import accounts

accounts.render_sidebar()  # right after st.set_page_config / st.title

tab_landscape, tab_map, tab_linter, tab_profile = st.tabs(
    ["Landscape", "Map", "Linter", "My profile"]
)
...
with tab_profile:
    accounts.render_profile()
```

## Saved data (for matching)

One row per user in `public.profiles`: `user_id`, `role`, `answers` (jsonb),
`completed`, `created_at`, `updated_at`. `answers` keys are the `key` of each question
in `questions.py`, and values are the option codes, not the labels. Example:

```json
{
  "role": "patient", "age": 64, "sex": "female",
  "home": {"town": "Springfield", "county": "Hampden", "county_fips": "25013"},
  "travel": "hour", "cancer_type": "breast", "cancer_stage": "metastatic",
  "treatment_status": "in_treatment", "conditions": ["diabetes", "renal"],
  "diabetes_control": "controlled",
  "body": {"height_in": 64, "weight_lb": 190, "bmi": 32.6},
  "smoking": "former", "activity": 1, "language": "spanish",
  "english_reading": "with_help", "notes": "Had chemo in 2024."
}
```

`conditions` uses the README category names (`diabetes`, `renal`, `hepatic`, `cardiac`,
`hiv`, `brain_mets`, `prior_malignancy`, or `none`), so they line up with
`exclusions.csv`. `activity` is the ECOG score (0–4). Skipped optional questions are
left out. In the app, read the signed-in user's row with
`accounts.store.load_profile(accounts.current_user()["id"])`.
