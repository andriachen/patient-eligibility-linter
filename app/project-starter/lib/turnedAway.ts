// Server-side data for the "Who gets turned away" funnel on the Map page. Built at
// build time from trials_enriched.json (the matcher's index), so the client gets a
// compact list instead of the full criteria text.

import { loadCounties } from "./loadCounties";
import { loadTrialsIndex } from "./loadTrialsIndex";
import type { Exclusion } from "./patientVector";

/** One trial, reduced to what the funnel filters on. */
export type FunnelTrial = {
  id: string;
  minAge: number | null;
  maxAge: number | null;
  fips: string[];
  /** Restricted categories: "a" = excludes outright, "c" = only under conditions. */
  r: Record<string, "a" | "c">;
  /** Highest ECOG score the trial accepts, or null if it doesn't cap performance status. */
  ecogMax: number | null;
};

export type FunnelExample = { id: string; text: string };

export type TurnedAwayData = {
  trials: FunnelTrial[];
  counties: { fips: string; name: string }[];
  /** A few real quotes per county ("all" = statewide) and category, absolute rules first. */
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

/** CT.gov escapes ("\<", "&gt;") make quotes hard to read, so clean them for display. */
function cleanQuote(text: string) {
  const decoded = text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\\([^\w\s])/g, "$1");
  return decoded.length > 150 ? `${decoded.slice(0, 147).trimEnd()}...` : decoded;
}

/**
 * The highest ECOG score a performance-status rule accepts. Karnofsky/KPS/Lansky are
 * converted (70+ = ECOG 1, 50+ = ECOG 2). Returns null when the text can't be read.
 */
export function ecogCap(threshold: string | null, section: string): number | null {
  if (!threshold) return null;
  const t = threshold.replace(/\\/g, "");
  const ecog = t.match(/\b(?:ECOG|Zubrod|WHO)\b[^;(]*/i)?.[0];
  if (ecog) {
    let m: RegExpMatchArray | null;
    if ((m = ecog.match(/(\d)\s*(?:-|–|to)\s*(\d)/))) return Number(m[2]);
    if ((m = ecog.match(/(\d)(?:\s*,\s*\d)*\s*,?\s*or\s*(\d)/))) return Number(m[2]);
    if ((m = ecog.match(/(?:≤|<=)\s*(\d)/))) return Number(m[1]);
    if ((m = ecog.match(/<\s*(\d)/))) return Number(m[1]) - 1;
    if ((m = ecog.match(/(?:≥|>=)\s*(\d)/))) return section === "exclusion" ? Number(m[1]) - 1 : null;
    if ((m = ecog.match(/>\s*(\d)/))) return Number(m[1]);
    if ((m = ecog.match(/\b(\d)\b/))) return Number(m[1]);
    return null;
  }
  const kps = t.match(/(?:Karnofsky|KPS|Lansky)[^\d]{0,15}(\d{2,3})/i);
  if (kps) {
    const score = Number(kps[1]);
    return score >= 70 ? 1 : score >= 50 ? 2 : 3;
  }
  return null;
}

function restrictions(exclusions: Exclusion[]): Record<string, "a" | "c"> {
  const r: Record<string, "a" | "c"> = {};
  for (const e of exclusions) {
    if (e.absolute) r[e.category] = "a";
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
      r: restrictions(t.exclusions),
      ecogMax: caps.length ? Math.min(...caps) : null,
    };
  });

  // Up to two quotes per (county, category); absolute rules first so the examples are clear.
  const examples: TurnedAwayData["examples"] = {};
  const add = (key: string, category: string, example: FunnelExample) => {
    const byCategory = (examples[key] ??= {});
    const list = (byCategory[category] ??= []);
    if (list.length < 2 && !list.some((e) => e.id === example.id)) list.push(example);
  };
  for (const pass of [true, false]) {
    for (const t of trials) {
      for (const e of t.exclusions) {
        if (e.absolute !== pass || !(FUNNEL_CATEGORIES as readonly string[]).includes(e.category)) continue;
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
