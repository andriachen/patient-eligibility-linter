// Loads the matcher's runtime index (data/processed/trials_enriched.json), built
// by eval/build_trials_enriched.py and copied into the app by scripts/copy-data.mjs
// (prebuild). We STATICALLY IMPORT it so Next bundles it into the server output —
// a computed fs path can be dropped from the Vercel bundle and silently yield an
// empty list. The import requires the file to exist at build time, which prebuild
// guarantees; if it's genuinely missing the build fails loudly (better than a
// silent empty page in production).

import type { EnrichedTrial } from "./patientVector";
import trialsData from "@/data/processed/trials_enriched.json";

export type TrialsIndex = {
  trials: EnrichedTrial[];
  source: "mock" | "processed";
};

const trials = trialsData as unknown as EnrichedTrial[];

// Resolved vs origin/main's fs-based version: the STATIC IMPORT above is the real
// fix for the Vercel "shows nothing" bug — a computed fs path can be dropped from
// the serverless bundle, whereas an imported JSON is always included. With a static
// import the data is present whenever the module loads, so there is no runtime-miss
// path to warn about (a missing file fails the build instead).
export function loadTrialsIndex(): TrialsIndex {
  return {
    trials,
    source: trials.length > 0 ? "processed" : "mock",
  };
}
