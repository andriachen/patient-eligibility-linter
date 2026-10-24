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
  /** LLM-tagged fixed cancer categories (tag_trials.py), e.g. ["breast"] or
   *  ["solid_tumor_basket"]. Drives deterministic cancer matching. */
  cancer_types: string[];
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

// Cancer matching uses the LLM-tagged `trial.cancer_types` (fixed vocabulary from
// tag_trials.py / the accounts wizard) — NOT keyword guessing. The patient picks a
// type from the same fixed list (a dropdown), so matching is a deterministic set test.
//
// Patient-facing types: breast, lung, colorectal, prostate, blood, skin, pancreatic,
// gynecologic, brain, kidney_bladder, head_neck, liver_stomach, other.
// Trial-only baskets: solid_tumor_basket, blood_cancer_basket, any_cancer.

/** Human labels for the fixed cancer-type codes (for "this trial is for X" copy). */
const CANCER_TYPE_LABELS: Record<string, string> = {
  breast: "breast cancer",
  lung: "lung cancer",
  colorectal: "colon/rectal cancer",
  prostate: "prostate cancer",
  blood: "blood cancer",
  skin: "melanoma/skin cancer",
  pancreatic: "pancreatic cancer",
  gynecologic: "ovarian/uterine/cervical cancer",
  brain: "brain/spinal cancer",
  kidney_bladder: "kidney/bladder cancer",
  head_neck: "head & neck cancer",
  liver_stomach: "liver/stomach/esophageal cancer",
  other: "another cancer type",
};

export type CancerFit = "exact" | "basket" | "none";

/** How well a trial's tagged types fit the patient's chosen cancer type.
 *  "exact"  = the trial names this specific cancer
 *  "basket" = a solid/blood-tumor basket, OR "any_cancer"/"unknown" — likely but
 *             unconfirmed, so surfaced as "ask about it", NOT a clean match
 *  "none"   = a different, named cancer */
export function cancerFit(trial: EnrichedTrial, cancerType?: string): CancerFit {
  if (!cancerType) return "exact"; // no type chosen -> don't filter
  const tags = trial.cancer_types ?? [];
  if (tags.includes(cancerType)) return "exact"; // trial NAMES this cancer
  // any_cancer / unknown (missing or failed tag) = "ask", never an exact match for
  // everyone — a depression study tagged any_cancer shouldn't read as "worth it"
  // for a breast patient without a caveat.
  if (tags.includes("any_cancer") || tags.includes("unknown")) return "basket";
  const patientIsBlood = cancerType === "blood";
  if (patientIsBlood && tags.includes("blood_cancer_basket")) return "basket";
  if (!patientIsBlood && tags.includes("solid_tumor_basket")) return "basket";
  return "none";
}

/** Convenience: does the trial plausibly fit the patient's cancer type at all? */
export function trialMatchesCancer(trial: EnrichedTrial, cancerType?: string): boolean {
  return cancerFit(trial, cancerType) !== "none";
}

/** Is `category` the trial's OWN target disease? A brain_mets exclusion on a PRIMARY
 *  brain-cancer trial (tagged "brain") is a disease definition, not a barrier. */
function categoryIsTrialTarget(category: string, trial: EnrichedTrial): boolean {
  if (category === "brain_mets") {
    return (trial.cancer_types ?? []).includes("brain");
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
      // An ABSOLUTE ("outright") HIV exclusion like "Known HIV infection" has no
      // carve-out -> hard even for controlled patients. Only a CONDITIONAL row
      // (absolute=false, e.g. "unless CD4 > 350 / undetectable viral load") is
      // "ask about it". Matches main's "follow the outright definition" fix.
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
  const fit = cancerFit(trial, patient.cancer_type);
  const cancerMatch = fit !== "none";
  if (fit === "none") {
    // #4: explain WHY a trial is ruled out — it's for a different cancer.
    const named = (trial.cancer_types ?? [])
      .filter((c) => !["unknown", "any_cancer", "solid_tumor_basket", "blood_cancer_basket"].includes(c))
      .map((c) => CANCER_TYPE_LABELS[c] ?? c);
    hits.push({
      category: "cancer_type",
      label: "Cancer type",
      severity: "hard",
      source_text: named.length
        ? `This trial is for ${named.join(", ")}, not your cancer type.`
        : "This trial is for a different cancer type.",
      threshold: null,
    });
  } else if (fit === "basket") {
    // "ask about it" — but the reason differs: a tumor-type basket vs. a trial that
    // isn't cancer-type-specific at all (any_cancer / unknown tag). #2
    const tags = trial.cancer_types ?? [];
    const nonSpecific = tags.includes("any_cancer") || tags.includes("unknown");
    hits.push({
      category: "cancer_type",
      label: "Cancer type",
      severity: "soft",
      source_text: nonSpecific
        ? "Open to any cancer, or not specific to a cancer type — check whether it applies to you."
        : "This trial enrolls several tumor types rather than naming yours — confirm yours is included.",
      threshold: null,
    });
  }
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
