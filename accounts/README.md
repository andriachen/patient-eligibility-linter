# accounts/ — login + profile questions (Next.js)

A separate Next.js app, served at `/account` on the team's Vercel domain (the web app is
at `/`). People sign up with email and
password (Supabase Auth), then answer one question per screen. The first question picks a
role and the rest branch:

- **patient / caregiver**: age, sex, town (→ county), travel distance, cancer type,
  stage, treatment status, health conditions, diabetes control, height and weight (→ BMI),
  smoking, activity level (ECOG), pregnancy, language, reading English, notes
- **trial_designer**: org type and name, job, cancer focus, phases, counties, goals, notes

Answers save after every step, so people can stop and pick up where they left off.

Stack: Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4,
Supabase (`@supabase/ssr`, cookie sessions), lucide-react, Jest.

## Run it locally

```bash
cd accounts
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev                  # http://localhost:3000/account
```

- `/account/preview` lets you click through every question without logging in. Nothing is
  saved, and the page only exists under `npm run dev`.
- `next.config.ts` sets `basePath: "/account"`. `Link`, `redirect()` and `revalidatePath`
  add the prefix on their own; a raw `<a href>`, a `fetch()` URL or a `public/` asset path
  needs `/account` added by hand.
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

- The root `vercel.json` deploys the whole repo as one Vercel project with two services:
  `web` (`app/project-starter`) at `/` and `accounts` at `/account`. Leave the project's
  Root Directory at the repo root. Ask Andria before changing `vercel.json` or the base
  path, since the web app links to `/account`.
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under
  **Environment Variables** for Production and Preview. They're built into the app, so
  redeploy after adding or changing them.
- In Supabase, **Authentication → URL Configuration**: set Site URL to
  `https://<vercel-domain>/account` and add `https://<vercel-domain>/account/**` and
  `http://localhost:3000/account/**` to Redirect URLs. These only matter for emails Supabase
  sends, so they don't affect password login while Confirm email is off.
- The repo belongs to `andriachen`, so Vercel's GitHub app has to be installed on her
  account, or you deploy from a fork.
- To check a deployment, open `/account/api/health`. It says whether Supabase accepts the
  URL and key, which project each belongs to, and whether a value was pasted with quotes,
  spaces or its variable name (`src/lib/supabase/env.ts` strips those, so they show up as
  warnings). It never shows the key itself.

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
