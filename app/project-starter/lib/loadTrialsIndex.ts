// Loads the matcher's runtime index (data/processed/trials_enriched.json),
// built by eval/build_trials_enriched.py. Server-side only. Mirrors the
// mock-fallback pattern of loadStats.ts / loadExclusionRows.ts.

import fs from "fs";
import path from "path";

import type { EnrichedTrial } from "./patientVector";

const PROCESSED_PATH = path.join(
  process.cwd(),
  "..",
  "..",
  "data",
  "processed",
  "trials_enriched.json",
);

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
