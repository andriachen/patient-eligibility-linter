// Rules the two patient tools share (the Map's "Who gets turned away" funnel and Find
// trials), so the same person gets the same answer from both. Pure functions.

/** ECOG score for each Find trials activity answer (plain-English wording). */
export const ECOG_LEVEL: Record<string, number> = {
  fully_active: 0,
  restricted_but_mobile: 1,
  limited: 2,
  very_limited: 3,
};

/**
 * The highest ECOG score a performance-status rule accepts. Karnofsky/KPS/Lansky are
 * converted (70+ = ECOG 1, 50+ = ECOG 2). Returns null when the text can't be read.
 */
export function ecogCap(threshold: string | null, section: string): number | null {
  if (!threshold) return null;
  const t = threshold.replace(/\\/g, "");
  const clauses = [...t.matchAll(/\b(?:ECOG|Zubrod|WHO)\b[^;(]*/gi)].map((m) => m[0]);
  if (clauses.length) {
    // Several ECOG clauses that disagree (e.g. one cap per cohort) can't be read as one cap.
    const caps = new Set(clauses.map((c) => ecogClauseCap(c, section)));
    return caps.size === 1 ? [...caps][0] : null;
  }
  const kps = t.match(/(?:Karnofsky|KPS|Lansky)[^\d]{0,15}(\d{2,3})/i);
  if (kps) {
    const score = Number(kps[1]);
    return score >= 70 ? 1 : score >= 50 ? 2 : 3;
  }
  return null;
}

function ecogClauseCap(ecog: string, section: string): number | null {
  let m: RegExpMatchArray | null;
  // Single digits only, so an age range like "18-74" in the same clause isn't read as ECOG.
  if ((m = ecog.match(/(?<!\d)(\d)\s*(?:-|–|to)\s*(\d)(?!\d)/))) return Number(m[2]);
  if ((m = ecog.match(/(?<!\d)(\d)(?:\s*,\s*\d)*\s*,?\s*or\s*(\d)(?!\d)/))) return Number(m[2]);
  if ((m = ecog.match(/(?:≤|<=)\s*(\d)/))) return Number(m[1]);
  if ((m = ecog.match(/<\s*(\d)/))) return Number(m[1]) - 1;
  if ((m = ecog.match(/(?:≥|>=)\s*(\d)/))) return section === "exclusion" ? Number(m[1]) - 1 : null;
  if ((m = ecog.match(/>\s*(\d)/))) return Number(m[1]);
  if ((m = ecog.match(/\b(\d)\b/))) return Number(m[1]);
  return null;
}

// Rules aimed only at active disease, or with a carve-out, admit treated, stable
// metastases even when the extractor marked them absolute ("Active brain metastases").
// ("except" and "eligible" are left out: "except for glioma" and "not eligible" still bar.)
const ACTIVE_OR_CARVE_OUT =
  /\b(?:active|untreated|symptomatic|progressive|progressing|unstable|uncontrolled|unless|allowed|permitted)\b/i;
// ...unless the rule names past or treated disease too ("active or history of").
const BARS_TREATED = /\bactive or (?:a |prior )?history\b|\beven if treated\b/i;

/** Does this brain-mets rule turn away someone whose metastases are treated and stable? */
export function barsTreatedBrainMets(rule: { absolute: boolean; source_text: string }): boolean {
  return rule.absolute && (BARS_TREATED.test(rule.source_text) || !ACTIVE_OR_CARVE_OUT.test(rule.source_text));
}

/**
 * Is this a trial for primary brain cancer (cancer-type tag "brain", from
 * pipeline/extract/tag_trials.py)? There a brain-mets row describes the disease being
 * studied, not a barrier, so neither tool counts it.
 */
export function isPrimaryBrainTrial(trial: { cancer_types?: string[] }): boolean {
  return (trial.cancer_types ?? []).includes("brain");
}
