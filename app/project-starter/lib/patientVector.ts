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
};

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
      if (value === "positive_controlled") return "soft"; // usually allowed w/ CD4/VL
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
};

/** Classify one trial against the patient vector. */
export function classifyTrial(
  patient: PatientVector,
  trial: EnrichedTrial,
): MatchedTrial {
  const hits: Hit[] = [];

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
  if (hits.some((h) => h.severity === "hard")) bucket = "likely_not_a_fit";
  else if (hits.some((h) => h.severity === "soft")) bucket = "ask_about_this";
  else bucket = "worth_reaching_out";

  const nearby =
    patient.county != null && trial.counties.includes(patient.county);

  return { trial, bucket, hits, nearby };
}
