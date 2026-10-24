// Aim 1 / Sub-Aim 3 — the deterministic patient matcher (no inference).
// Mirrors docs/patient-matching.md §8. Pure functions; unit-testable.

import { categoryLabel } from "./categories";

/** One exclusion row from trials_enriched.json. */
export type Exclusion = {
  category: string;
  threshold: string | null;
  absolute: boolean;
  section: string;
  source_text: string;
};

export type TrialSite = {
  facility: string;
  city: string;
  zip: string;
  county: string;
  county_fips: string;
};

/** One enriched trial record (from data/processed/trials_enriched.json). */
export type EnrichedTrial = {
  nct_id: string;
  title: string;
  phase: string;
  lead_sponsor: string;
  conditions: string[];
  min_age: number | null;
  max_age: number | null;
  exclusions: Exclusion[];
  exclusion_categories: string[];
  sites: TrialSite[];
  counties: string[];
};

/**
 * The patient's self-reported constraints. Every field is coarse and optional;
 * `undefined`/"unknown" never trips a match. `age` is the one numeric field.
 * `county` is optional and only used to rank "nearby".
 */
export type PatientVector = {
  diabetes?: "none" | "controlled" | "uncontrolled" | "unknown";
  bmi?: "no" | "yes" | "unknown";
  smoking?: "no" | "yes" | "unknown";
  age?: number;
  renal?: "no" | "mild" | "significant" | "unknown";
  hepatic?: "no" | "mild" | "significant" | "unknown";
  cardiac?: "no" | "yes" | "unknown";
  hiv?: "negative" | "positive_controlled" | "positive_uncontrolled" | "unknown";
  brain_mets?: "no" | "treated_stable" | "active" | "unknown";
  prior_malignancy?: "no" | "yes" | "unknown";
  performance_status?: "fully_active" | "restricted_but_mobile" | "limited" | "unknown";
  language?: "english_ok" | "english_limited" | "unknown";
  pregnancy?: "no" | "yes" | "unknown";
  county?: string;
  /** Free-text cancer type (e.g. "breast", "lung"). Used to filter + to spare a
   *  trial's own target condition from a matching barrier (e.g. brain_mets on a
   *  brain-cancer trial). Empty/undefined = don't filter by condition. */
  cancer_type?: string;
};

/** Map a free-text cancer type to the keywords that identify its trials. */
const CANCER_KEYWORDS: Record<string, string[]> = {
  breast: ["breast"],
  lung: ["lung", "nsclc", "sclc"],
  prostate: ["prostate"],
  colorectal: ["colorectal", "colon", "rectal", "crc"],
  lymphoma: ["lymphoma"],
  leukemia: ["leukemia", "leukaemia", "aml", "cml", "all", "cll"],
  melanoma: ["melanoma"],
  brain: ["brain", "glioma", "glioblastoma", "cns", "central nervous", "astrocytoma"],
  pancreatic: ["pancrea"],
  ovarian: ["ovarian", "ovary"],
  myeloma: ["myeloma"],
  kidney: ["kidney", "renal cell", "rcc"],
  bladder: ["bladder", "urothelial"],
  liver: ["liver", "hepatocellular", "hcc"],
};

/** Keywords for the patient's cancer type (free-text, lenient). */
function cancerKeywords(cancerType?: string): string[] {
  if (!cancerType) return [];
  const t = cancerType.toLowerCase().trim();
  for (const [key, kws] of Object.entries(CANCER_KEYWORDS)) {
    if (t.includes(key) || kws.some((k) => t.includes(k))) return kws;
  }
  return [t]; // fall back to the raw term
}

/** Does this trial target the patient's cancer type? (lenient substring match) */
export function trialMatchesCancer(trial: EnrichedTrial, cancerType?: string): boolean {
  const kws = cancerKeywords(cancerType);
  if (kws.length === 0) return true; // no cancer type given -> don't filter
  const hay = (trial.conditions.join(" ") + " " + trial.title).toLowerCase();
  return kws.some((k) => hay.includes(k));
}

/** Is `category` the trial's OWN target disease? (e.g. brain_mets on a brain-cancer
 *  trial, or prior_malignancy on any cancer trial). Such a row is a disease
 *  definition, not a barrier for this patient. */
function categoryIsTrialTarget(category: string, trial: EnrichedTrial): boolean {
  const hay = (trial.conditions.join(" ") + " " + trial.title).toLowerCase();
  if (category === "brain_mets") {
    return /brain|glioma|glioblastoma|cns|central nervous|astrocytoma|meningioma|leptomening/.test(
      hay,
    );
  }
  return false;
}

export type Severity = "hard" | "soft" | null;

/**
 * Does the patient's value for `category` conflict with this exclusion row?
 * Returns "hard" (absolute exclusion tripped), "soft" (conditional / discuss), or
 * null (no conflict). See docs/patient-matching.md §8.
 */
export function trips(
  category: string,
  value: string | undefined,
  absolute: boolean,
): Severity {
  if (value === undefined || value === "unknown") return null;
  const hard: Severity = absolute ? "hard" : "soft";

  switch (category) {
    case "hiv":
      if (value === "positive_uncontrolled") return hard;
      // An ABSOLUTE HIV exclusion ("Known HIV infection") has no carve-out, so it
      // is a hard barrier even for controlled patients. Only a CONDITIONAL row
      // (absolute=false, e.g. "unless CD4 > 350") is "ask about it".
      if (value === "positive_controlled") return absolute ? "hard" : "soft";
      return null;
    case "diabetes":
      if (value === "uncontrolled") return hard;
      if (value === "controlled") return "soft";
      return null;
    case "renal":
    case "hepatic":
      if (value === "significant") return hard;
      if (value === "mild") return "soft";
      return null;
    case "brain_mets":
      if (value === "active") return hard;
      if (value === "treated_stable") return "soft";
      return null;
    case "performance_status":
      if (value === "limited") return hard;
      if (value === "restricted_but_mobile") return "soft";
      return null;
    case "language":
      if (value === "english_limited") return hard;
      return null;
    case "prior_malignancy":
      if (value === "yes") return "soft"; // nearly always time-windowed/conditional
      return null;
    case "bmi":
    case "smoking":
    case "cardiac":
    case "pregnancy":
      if (value === "yes") return hard;
      return null;
    default:
      return null; // age handled separately; unknown categories ignored
  }
}

export type Hit = {
  category: string;
  label: string;
  severity: "hard" | "soft";
  source_text: string;
  threshold: string | null;
};

export type Bucket = "worth_reaching_out" | "ask_about_this" | "likely_not_a_fit";

export type MatchedTrial = {
  trial: EnrichedTrial;
  bucket: Bucket;
  hits: Hit[];
  nearby: boolean; // a site in the patient's county
  cancerMatch: boolean; // trial targets the patient's cancer type (or none given)
  notScreened: boolean; // trial has NO extracted criteria — we couldn't check it
};

/** Classify one trial against the patient vector. */
export function classifyTrial(
  patient: PatientVector,
  trial: EnrichedTrial,
): MatchedTrial {
  const hits: Hit[] = [];
  const cancerMatch = trialMatchesCancer(trial, patient.cancer_type);
  // #4: no extracted rows means we couldn't screen this trial (112 trials, incl.
  // the 5 known extraction failures) — distinct from "screened, nothing found".
  const notScreened = trial.exclusions.length === 0;

  // age: numeric, from the trial's own min/max (not an exclusion row)
  if (typeof patient.age === "number") {
    if (
      (trial.min_age != null && patient.age < trial.min_age) ||
      (trial.max_age != null && patient.age > trial.max_age)
    ) {
      const range = `${trial.min_age ?? "?"}–${trial.max_age ?? "?"} years`;
      hits.push({
        category: "age",
        label: categoryLabel("age"),
        severity: "hard",
        source_text: `Trial age range ${range}`,
        threshold: range,
      });
    }
  }

  // the 13 categories against the trial's exclusion rows
  for (const ex of trial.exclusions) {
    // #3: a row describing the trial's OWN target disease (e.g. a brain_mets row on
    // a brain-cancer trial) is a disease definition, not a barrier for this patient.
    if (categoryIsTrialTarget(ex.category, trial)) continue;
    const value = (patient as Record<string, string | number | undefined>)[
      ex.category
    ] as string | undefined;
    const sev = trips(ex.category, value, ex.absolute);
    if (sev) {
      hits.push({
        category: ex.category,
        label: categoryLabel(ex.category),
        severity: sev,
        source_text: ex.source_text,
        threshold: ex.threshold,
      });
    }
  }

  let bucket: Bucket;
  // #1: a trial that doesn't target the patient's cancer type is not a fit,
  // regardless of the 13 barriers — this is the dominant real-world filter.
  if (!cancerMatch) bucket = "likely_not_a_fit";
  else if (hits.some((h) => h.severity === "hard")) bucket = "likely_not_a_fit";
  else if (hits.some((h) => h.severity === "soft")) bucket = "ask_about_this";
  else bucket = "worth_reaching_out";

  const nearby =
    patient.county != null && trial.counties.includes(patient.county);

  return { trial, bucket, hits, nearby, cancerMatch, notScreened };
}
