// Build-time copy: bring the pipeline's processed outputs INTO the app so Vercel
// bundles them. Vercel deploys only `app/project-starter` (the service root in
// vercel.json), so `../../data/processed` is outside the bundle and unreadable at
// runtime. This copies the files the loaders need into app/project-starter/data/processed.
//
// Runs via `prebuild` (and can be run manually). Idempotent. If the source repo-root
// data isn't present (e.g. a shallow deploy), it leaves any existing copy in place and
// warns rather than failing the build.

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)); // app/project-starter/scripts
const appRoot = join(here, ".."); // app/project-starter
const repoRoot = join(appRoot, "..", ".."); // repo root
const srcDir = join(repoRoot, "data", "processed");
const destDir = join(appRoot, "data", "processed");

// Files the app's loaders read (JSON + the CSVs behind counties/exclusions).
const FILES = [
  "trials_enriched.json",
  "stats.json",
  "trials.csv",
  "exclusions.csv",
  "trial_sites.csv",
  "county_metrics.csv",
  "county_ej.csv",
];

if (!existsSync(srcDir)) {
  console.warn(`copy-data: source ${srcDir} not found; leaving any existing copy in place.`);
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
let copied = 0;
for (const name of FILES) {
  const src = join(srcDir, name);
  if (!existsSync(src)) {
    console.warn(`copy-data: skip missing ${name}`);
    continue;
  }
  cpSync(src, join(destDir, name));
  copied += 1;
}
console.log(`copy-data: copied ${copied}/${FILES.length} files -> app/project-starter/data/processed`);
