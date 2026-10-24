// Loads the matcher's runtime index (data/processed/trials_enriched.json),
// built by eval/build_trials_enriched.py. Server-side only. Mirrors the
// mock-fallback pattern of loadStats.ts / loadExclusionRows.ts.

import fs from "fs";
import path from "path";

import type { EnrichedTrial } from "./patientVector";

// The build-time copy (scripts/copy-data.mjs) puts the file INSIDE the app so
// Vercel bundles it. Prefer that; fall back to the repo-root path for local dev
// if the copy hasn't run.
function resolveDataPath(file: string): string {
  const inApp = path.join(process.cwd(), "data", "processed", file);
  if (fs.existsSync(inApp)) return inApp;
  return path.join(process.cwd(), "..", "..", "data", "processed", file);
}

const PROCESSED_PATH = resolveDataPath("trials_enriched.json");

export type TrialsIndex = {
  trials: EnrichedTrial[];
  source: "mock" | "processed";
};

let _cache: TrialsIndex | null = null;

/** Load + memoize the enriched trial index. Falls back to an empty set. */
export function loadTrialsIndex(): TrialsIndex {
  if (_cache) return _cache;
  if (fs.existsSync(PROCESSED_PATH)) {
    const raw = fs.readFileSync(PROCESSED_PATH, "utf-8");
    _cache = { trials: JSON.parse(raw) as EnrichedTrial[], source: "processed" };
  } else {
    _cache = { trials: [], source: "mock" };
  }
  return _cache;
}
