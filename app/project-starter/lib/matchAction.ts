"use server";

// Server action for Sub-Aim 4. matchTrials() uses fs (reads trials_enriched.json),
// so it must run on the server; the client MatchPanel calls this. Returns only the
// data the UI needs (trimmed so we don't ship every exclusion row to the client).

import { matchTrials, type MatchedTrial, type PatientVector } from "./matchTrials";

export type MatchCardSite = { facility: string; city: string; county: string };
export type MatchCard = {
  nct_id: string;
  title: string;
  phase: string;
  lead_sponsor: string;
  nearby: boolean;
  site: MatchCardSite | null;
  hits: { category: string; label: string; severity: "hard" | "soft"; source_text: string; threshold: string | null }[];
  ctUrl: string;
};

export type MatchResponse = {
  worthReachingOut: MatchCard[];
  askAboutThis: MatchCard[];
  likelyNotAFit: MatchCard[];
  counts: { worth: number; ask: number; notFit: number; total: number };
  source: "mock" | "processed";
};

const LIMIT = 40; // cap cards per bucket so the demo stays snappy

function toCard(m: MatchedTrial, patientCounty?: string): MatchCard {
  // prefer a site in the patient's county, else the first MA site
  const site =
    (patientCounty && m.trial.sites.find((s) => s.county === patientCounty)) ||
    m.trial.sites[0] ||
    null;
  return {
    nct_id: m.trial.nct_id,
    title: m.trial.title,
    phase: m.trial.phase,
    lead_sponsor: m.trial.lead_sponsor,
    nearby: m.nearby,
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
    source: result.source,
  };
}
