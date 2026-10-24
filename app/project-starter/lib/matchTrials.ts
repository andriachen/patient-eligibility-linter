// Top-level matcher (Aim 1): patient vector -> trials grouped into the three
// buckets, ordered for display. Deterministic, no inference. See
// docs/aims-matching-engine.md.

import { loadTrialsIndex } from "./loadTrialsIndex";
import {
  classifyTrial,
  type Bucket,
  type MatchedTrial,
  type PatientVector,
} from "./patientVector";

export type MatchResult = {
  worthReachingOut: MatchedTrial[];
  askAboutThis: MatchedTrial[];
  likelyNotAFit: MatchedTrial[];
  counts: { worth: number; ask: number; notFit: number; total: number };
  source: "mock" | "processed";
};

const BUCKET_ORDER: Record<Bucket, keyof Omit<MatchResult, "counts" | "source">> = {
  worth_reaching_out: "worthReachingOut",
  ask_about_this: "askAboutThis",
  likely_not_a_fit: "likelyNotAFit",
};

/**
 * Match a patient against every trial in the index.
 *
 * Within each bucket, trials with a site in the patient's county ("nearby") come
 * first, then those with fewer hits (closer to a fit).
 */
export function matchTrials(patient: PatientVector): MatchResult {
  const { trials, source } = loadTrialsIndex();

  const groups: Record<Bucket, MatchedTrial[]> = {
    worth_reaching_out: [],
    ask_about_this: [],
    likely_not_a_fit: [],
  };

  for (const trial of trials) {
    const matched = classifyTrial(patient, trial);
    groups[matched.bucket].push(matched);
  }

  // #2: deterministic, meaningful order — nearby first, then screened-and-clear
  // ahead of not-screened, then fewer barriers, then by phase (later phases first,
  // closer to patients), then nct_id as a stable tiebreak (never raw file order).
  const phaseRank = (p: string) => {
    const m = p.match(/(\d)/g);
    return m ? Math.max(...m.map(Number)) : 0;
  };
  const sortBucket = (arr: MatchedTrial[]) =>
    arr.sort((a, b) => {
      // #1: in "Likely not yet", float the patient's OWN-cancer trials (blocked by a
      // real barrier) above the hundreds of other-cancer trials they'd never join.
      if (a.cancerMatch !== b.cancerMatch) return a.cancerMatch ? -1 : 1;
      if (a.nearby !== b.nearby) return a.nearby ? -1 : 1;
      if (a.notScreened !== b.notScreened) return a.notScreened ? 1 : -1;
      if (a.hits.length !== b.hits.length) return a.hits.length - b.hits.length;
      const pr = phaseRank(b.trial.phase) - phaseRank(a.trial.phase);
      if (pr !== 0) return pr;
      return a.trial.nct_id.localeCompare(b.trial.nct_id);
    });

  sortBucket(groups.worth_reaching_out);
  sortBucket(groups.ask_about_this);
  sortBucket(groups.likely_not_a_fit);

  return {
    worthReachingOut: groups.worth_reaching_out,
    askAboutThis: groups.ask_about_this,
    likelyNotAFit: groups.likely_not_a_fit,
    counts: {
      worth: groups.worth_reaching_out.length,
      ask: groups.ask_about_this.length,
      notFit: groups.likely_not_a_fit.length,
      total: trials.length,
    },
    source,
  };
}

export type { PatientVector, MatchedTrial } from "./patientVector";
export { BUCKET_ORDER };
