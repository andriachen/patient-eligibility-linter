# Threshold web app

Next.js 15 app for Landscape, Map (with "Who gets turned away"), Linter, Find trials and
one page per trial (`/trial/NCT…`). It is served at `/` on Vercel; the accounts app at
`/account` lives in `../../accounts`.

```bash
npm install
npm run dev        # http://localhost:3010 (copies data/processed in first)
npm run build      # static pages for every route except /api/lint
```

- Data comes from `../../data/processed`, copied in by `scripts/copy-data.mjs` before
  `dev` and `build`. Don't edit the copies.
- The Linter calls Claude through `app/api/lint/route.ts`. Copy `.env.example` to
  `.env.local` and set `ANTHROPIC_API_KEY`; without it the Linter uses keyword rules.
- `npx tsx scripts/check-extraction-parity.ts` checks that the live Linter filters model
  output exactly like the pipeline (it replays `data/cache` against `exclusions.csv`).

See `../../AGENTS.md` for the build log and data notes.
