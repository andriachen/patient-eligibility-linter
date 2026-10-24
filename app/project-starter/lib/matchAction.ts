"use server";

// Server action for Sub-Aim 4. The trial index (trials_enriched.json) is bundled into
// the server, so matching runs there; the client MatchPanel calls this. Returns only
// the data the UI needs (trimmed so we don't ship every exclusion row to the client).

import { matchTrials, type MatchedTrial, type PatientVector } from "./matchTrials";
import { formatPhase } from "./phase";

export type MatchCardSite = { facility: string; city: string; county: string };
export type MatchCard = {
  nct_id: string;
  title: string;
  phase: string;
  lead_sponsor: string;
  nearby: boolean;
  notScreened: boolean; // #4: no restrictions extracted from this trial's criteria
  site: MatchCardSite | null;
  hits: { category: string; label: string; severity: "hard" | "soft"; source_text: string; threshold: string | null }[];
  ctUrl: string;
};

export type MatchResponse = {
  worthReachingOut: MatchCard[];
  askAboutThis: MatchCard[];
  likelyNotAFit: MatchCard[];
  // `shown` = how many cards returned per bucket; `counts` = true totals (#2).
  counts: { worth: number; ask: number; notFit: number; otherCancer: number; total: number };
  shown: { worth: number; ask: number; notFit: number };
  source: "mock" | "processed";
};

const LIMIT = 50; // cap cards per bucket so the payload stays small

function toCard(m: MatchedTrial, patientCounty?: string): MatchCard {
  const site =
    (patientCounty && m.trial.sites.find((s) => s.county === patientCounty)) ||
    m.trial.sites[0] ||
    null;
  return {
    nct_id: m.trial.nct_id,
    title: m.trial.title,
    phase: formatPhase(m.trial.phase),
    lead_sponsor: m.trial.lead_sponsor,
    nearby: m.nearby,
    notScreened: m.notScreened,
    site: site ? { facility: site.facility, city: site.city, county: site.county } : null,
    hits: m.hits.map((h) => ({
      category: h.category,
      label: h.label,
      severity: h.severity,
      source_text: h.source_text,
      threshold: h.threshold,
    })),
    ctUrl: `https://clinicaltrials.gov/study/${m.trial.nct_id}`,
  };
}

export async function runMatch(patient: PatientVector): Promise<MatchResponse> {
  const result = matchTrials(patient);
  const trim = (arr: MatchedTrial[]) => arr.slice(0, LIMIT).map((m) => toCard(m, patient.county));
  return {
    worthReachingOut: trim(result.worthReachingOut),
    askAboutThis: trim(result.askAboutThis),
    likelyNotAFit: trim(result.likelyNotAFit),
    counts: result.counts,
    shown: {
      worth: Math.min(result.worthReachingOut.length, LIMIT),
      ask: Math.min(result.askAboutThis.length, LIMIT),
      notFit: Math.min(result.likelyNotAFit.length, LIMIT),
    },
    source: result.source,
  };
}
