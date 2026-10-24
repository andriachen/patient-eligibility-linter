// Server-side data for the "Who gets turned away" funnel on the Map page. Built at
// build time from trials_enriched.json (the matcher's index), so the client gets a
// compact list instead of the full criteria text.

import { normalizeCriteria } from "./criteriaText";
import { loadCounties } from "./loadCounties";
import { loadTrialsIndex } from "./loadTrialsIndex";
import type { EnrichedTrial } from "./patientVector";
import { barsTreatedBrainMets, ecogCap, isPrimaryBrainTrial } from "./traitRules";

/** One trial, reduced to what the funnel filters on. */
export type FunnelTrial = {
  id: string;
  minAge: number | null;
  maxAge: number | null;
  fips: string[];
  /**
   * Restricted categories: "a" = excludes outright, "c" = only under conditions. For
   * brain_mets, "a" means it turns away treated, stable metastases (lib/traitRules.ts).
   */
  r: Record<string, "a" | "c">;
  /** Highest ECOG score the trial accepts, or null if it doesn't cap performance status. */
  ecogMax: number | null;
};

export type FunnelExample = { id: string; text: string };

export type TurnedAwayData = {
  trials: FunnelTrial[];
  counties: { fips: string; name: string }[];
  /** Real quotes per county ("all" = statewide) and category, absolute rules first. */
  examples: Record<string, Record<string, FunnelExample[]>>;
};

/** Categories the funnel can filter on (age is handled separately). */
export const FUNNEL_CATEGORIES = [
  "hiv",
  "language",
  "brain_mets",
  "prior_malignancy",
  "performance_status",
  "renal",
  "hepatic",
  "cardiac",
  "pregnancy",
] as const;

/** Readable, short version of a quote for the funnel. */
function cleanQuote(text: string) {
  const clean = normalizeCriteria(text);
  return clean.length > 150 ? `${clean.slice(0, 147).trimEnd()}...` : clean;
}

function restrictions(trial: EnrichedTrial): Record<string, "a" | "c"> {
  const r: Record<string, "a" | "c"> = {};
  for (const e of trial.exclusions) {
    if (e.category === "brain_mets" && isPrimaryBrainTrial(trial)) continue;
    const outright = e.category === "brain_mets" ? barsTreatedBrainMets(e) : e.absolute;
    if (outright) r[e.category] = "a";
    else if (!r[e.category]) r[e.category] = "c";
  }
  return r;
}

export function loadTurnedAwayData(): TurnedAwayData {
  const { trials } = loadTrialsIndex();
  const { counties } = loadCounties();

  const funnelTrials: FunnelTrial[] = trials.map((t) => {
    const caps = t.exclusions
      .filter((e) => e.category === "performance_status")
      .map((e) => ecogCap(e.threshold, e.section))
      .filter((c): c is number => c !== null);
    return {
      id: t.nct_id,
      minAge: t.min_age,
      maxAge: t.max_age,
      fips: [...new Set(t.sites.map((s) => s.county_fips).filter(Boolean))],
      r: restrictions(t),
      ecogMax: caps.length ? Math.min(...caps) : null,
    };
  });

  // Quotes per (county, category); rules that turn people away outright first.
  const examples: TurnedAwayData["examples"] = {};
  const add = (key: string, category: string, example: FunnelExample) => {
    const byCategory = (examples[key] ??= {});
    const list = (byCategory[category] ??= []);
    // Several candidates, so the panel can show quotes from the trials each step actually drops.
    if (list.length < 8 && !list.some((e) => e.id === example.id)) list.push(example);
  };
  for (const pass of [true, false]) {
    for (const t of trials) {
      for (const e of t.exclusions) {
        const outright = e.category === "brain_mets" ? barsTreatedBrainMets(e) : e.absolute;
        if (outright !== pass || !(FUNNEL_CATEGORIES as readonly string[]).includes(e.category)) continue;
        if (e.category === "brain_mets" && isPrimaryBrainTrial(t)) continue;
        // Only ECOG rules that turn away ECOG 2 (the funnel's test), not "ECOG ≤ 2".
        if (e.category === "performance_status" && (ecogCap(e.threshold, e.section) ?? 2) >= 2) continue;
        const example = { id: t.nct_id, text: cleanQuote(e.source_text) };
        add("all", e.category, example);
        for (const fips of new Set(t.sites.map((s) => s.county_fips))) add(fips, e.category, example);
      }
    }
  }

  return {
    trials: funnelTrials,
    counties: counties
      .map((c) => ({ fips: c.county_fips, name: c.county }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    examples,
  };
}
