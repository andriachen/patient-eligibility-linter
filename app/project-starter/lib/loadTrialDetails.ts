// Data for the static /trial/[nct] pages: the matcher's enriched record plus the full
// eligibility text from trials.csv. Server-side only; parsed once per build.

import { normalizeCriteria } from "./criteriaText";
import { loadTrialsIndex } from "./loadTrialsIndex";
import type { EnrichedTrial } from "./patientVector";
import { parseCsv, readProcessedText } from "./readProcessedFile";

let eligibilityById: Map<string, string> | null = null;

function eligibilityTexts(): Map<string, string> {
  if (!eligibilityById) {
    const text = readProcessedText("trials.csv");
    eligibilityById = new Map(text ? parseCsv(text).map((t) => [t.nct_id, t.eligibility_text]) : []);
  }
  return eligibilityById;
}

export function trialIds(): string[] {
  return loadTrialsIndex().trials.map((t) => t.nct_id);
}

export type TrialDetails = EnrichedTrial & { eligibility: string };

export function loadTrialDetails(id: string): TrialDetails | null {
  const trial = loadTrialsIndex().trials.find((t) => t.nct_id === id);
  if (!trial) return null;
  return { ...trial, eligibility: normalizeCriteria(eligibilityTexts().get(id) ?? "") };
}
