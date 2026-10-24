# accounts/ — login + profile questions (Next.js)

A separate Next.js app, deployed on its own to Vercel. People sign up with email and
password (Supabase Auth), then answer one question per screen. The first question picks a
role and the rest branch:

- **patient / caregiver**: age, sex, town (→ county), travel distance, cancer type,
  stage, treatment status, health conditions, height and weight (→ BMI), smoking,
  activity level (ECOG), pregnancy, language, notes
- **trial_designer**: org type and name, job, cancer focus, phases, counties, goals, notes

Answers save after every step, so people can stop and pick up where they left off.

Stack: Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4,
Supabase (`@supabase/ssr`, cookie sessions), lucide-react, Jest.

## Run it locally

```bash
cd accounts
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev                  # http://localhost:3000
```

- `/preview` lets you click through every question without logging in. Nothing is saved,
  and the page only exists under `npm run dev`.
- `npm test` runs the wizard logic tests. `npm run lint` and `npm run build` should pass
  before you push.

## Supabase (once per project)

1. Run `schema.sql` in the project's SQL editor. It creates `public.profiles` with row-level
   security, so each user can only read and change their own row.
2. **Authentication → Sign In / Providers → Email**: turn off **Confirm email** so
   sign-ups log in straight away.
3. Copy the project URL and the anon (publishable) key from **Project Settings → API** into
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never use the
   `service_role` key here.

## Deploy to Vercel

- Import the repo with **Root Directory** set to `accounts`. Vercel detects Next.js.
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under
  **Environment Variables**.
- The repo belongs to `andriachen`, so Vercel's GitHub app has to be installed on her
  account, or you deploy from a fork.

## Saved data (for matching)

One row per user in `public.profiles`: `user_id`, `role`, `answers` (jsonb),
`completed`, `created_at`, `updated_at`. `answers` keys are the `key` of each question in
`src/lib/questions.ts`, and values are option codes, not labels:

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
`exclusions.csv`. `activity` is the ECOG score (0–4). Skipped optional questions are left
out. On the server, read the signed-in user's row with
`getProfile((await getCurrentUser()).id)` from `src/lib/profile.ts` and `src/lib/auth.ts`.

## Where things are

| Path | What |
|------|------|
| `src/lib/questions.ts` | Every question, its options and when it shows |
| `src/lib/wizard.ts` | Step logic: resume, next, edit from review, validation |
| `src/app/profile/` | The wizard UI and the `saveProfile` Server Action |
| `src/app/login/` | Log in / sign up form and the auth Server Actions |
| `src/proxy.ts` | Refreshes the Supabase session cookie on every request |
| `src/data/ma-towns.json` | Town → county, generated from `data/processed/ma_town_county.csv` with `npm run towns` |
| `schema.sql` | The `profiles` table and its access rules |
