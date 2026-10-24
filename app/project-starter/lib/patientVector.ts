// Aim 1 / Sub-Aim 3 — the deterministic patient matcher (no inference).
// Design: docs/patient-matching.md. Pure functions; unit-testable. Rules shared with
// the Map's funnel live in ./traitRules.

import { categoryLabel } from "./categories";
import { ECOG_LEVEL, barsTreatedBrainMets, ecogCap, isBrainTumorTrial } from "./traitRules";

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
  /** ECOG 0, 1, 2 and 3+ (see ECOG_LEVEL). */
  performance_status?: "fully_active" | "restricted_but_mobile" | "limited" | "very_limited" | "unknown";
  language?: "english_ok" | "english_limited" | "unknown";
  pregnancy?: "no" | "yes" | "unknown";
  county?: string;
  /** Free-text cancer type (e.g. "breast", "lung"). Used to filter + to spare a
   *  trial's own target condition from a matching barrier (e.g. brain_mets on a
   *  brain-cancer trial). Empty/undefined = don't filter by condition. */
  cancer_type?: string;
};

/**
 * Cancer types: the names a patient might type (or an accounts-wizard code) and the
 * words that identify a trial for it. Single cancers come before the accounts wizard's
 * combined groups, so "multiple myeloma" stays myeloma instead of all blood cancers;
 * exact codes such as "kidney_bladder" are looked up by name first.
 */
const CANCER_TYPES: { names: string[]; keywords: string[] }[] = [
  { names: ["breast"], keywords: ["breast"] },
  { names: ["lung"], keywords: ["lung", "nsclc", "sclc"] },
  { names: ["prostate"], keywords: ["prostate"] },
  { names: ["colorectal"], keywords: ["colorectal", "colon", "rectal", "crc"] },
  { names: ["lymphoma"], keywords: ["lymphoma"] },
  // "ALL" (acute lymphoblastic leukemia) is matched by name; as a word it would match "all".
  { names: ["leukemia", "all"], keywords: ["leukemia", "leukaemia", "lymphoblastic", "aml", "cml", "cll"] },
  { names: ["melanoma"], keywords: ["melanoma"] },
  { names: ["brain"], keywords: ["brain", "glioma", "glioblastoma", "cns", "central nervous", "astrocytoma"] },
  { names: ["pancreatic"], keywords: ["pancrea"] },
  { names: ["ovarian"], keywords: ["ovarian", "ovary"] },
  { names: ["myeloma"], keywords: ["myeloma"] },
  { names: ["kidney"], keywords: ["kidney", "renal cell", "rcc"] },
  { names: ["bladder"], keywords: ["bladder", "urothelial"] },
  { names: ["liver"], keywords: ["liver", "hepatocellular", "hcc"] },
  { names: ["kidney_bladder"], keywords: ["kidney", "renal cell", "rcc", "bladder", "urothelial"] },
  {
    names: ["liver_stomach"],
    keywords: ["liver", "hepatocellular", "hcc", "stomach", "gastric", "gastroesophageal", "esophag"],
  },
  {
    names: ["head_neck", "head and neck"],
    keywords: ["head and neck", "hnscc", "oropharyn", "laryn", "nasophar", "oral cavity"],
  },
  {
    names: ["blood"],
    keywords: [
      "leukemia", "leukaemia", "lymphoma", "myeloma", "myelodysplastic", "lymphoblastic", "aml", "cml", "cll",
    ],
  },
  { names: ["skin"], keywords: ["melanoma", "skin", "merkel", "cutaneous", "basal cell"] },
  {
    names: ["gynecologic"],
    keywords: ["ovarian", "ovary", "uterine", "endometri", "cervical cancer", "cervix", "fallopian", "vulva"],
  },
];

/** Answers that name no cancer type, so nothing is filtered. */
const NO_CANCER_TYPE = new Set(["", "other", "not_sure", "not sure", "unknown"]);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `keyword` at the start of a word: "pancrea" matches "pancreatic", "all" won't match "small". */
const wordHit = (text: string, keyword: string) => new RegExp(`(?<![a-z])${escapeRegExp(keyword)}`).test(text);

/**
 * Keywords for the patient's cancer type (free text or an accounts code). A term we
 * don't recognise is matched anywhere in a word, so "sarcoma" finds "osteosarcoma".
 */
function cancerKeywords(cancerType?: string): { keywords: string[]; anywhere: boolean } {
  const t = (cancerType ?? "").toLowerCase().trim();
  if (NO_CANCER_TYPE.has(t)) return { keywords: [], anywhere: false };
  const exact = CANCER_TYPES.find((c) => c.names.includes(t));
  if (exact) return { keywords: exact.keywords, anywhere: false };
  const loose = CANCER_TYPES.find(
    (c) => c.names.some((n) => wordHit(t, n)) || c.keywords.some((k) => wordHit(t, k)),
  );
  return loose ? { keywords: loose.keywords, anywhere: false } : { keywords: [t], anywhere: true };
}

/** Does this trial target the patient's cancer type? (conditions + title) */
export function trialMatchesCancer(trial: EnrichedTrial, cancerType?: string): boolean {
  const { keywords, anywhere } = cancerKeywords(cancerType);
  if (keywords.length === 0) return true; // no cancer type given -> don't filter
  const hay = (trial.conditions.join(" ") + " " + trial.title).toLowerCase();
  return keywords.some((k) => (anywhere ? hay.includes(k) : wordHit(hay, k)));
}

export type Severity = "hard" | "soft" | null;

/**
 * Does the patient's value for `category` conflict with this exclusion row?
 * Returns "hard" (absolute exclusion tripped), "soft" (conditional / discuss), or
 * null (no conflict). See docs/patient-matching.md §3.
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
      // Conditional HIV rules admit only controlled HIV, so uncontrolled is always a barrier.
      if (value === "positive_uncontrolled") return "hard";
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
      // treated_stable is decided in classifyTrial, which can read the rule's wording.
      if (value === "active") return hard;
      if (value === "treated_stable") return "soft";
      return null;
    case "performance_status":
      // classifyTrial reads the rule's ECOG cap instead (see severity()).
      if (value === "limited" || value === "very_limited") return hard;
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
  notScreened: boolean; // no extracted rows: none of the 13 found, or (rarely) a misread
};

/**
 * A "BMI 30 or more" patient against one BMI/weight rule. Upper limits at or below 30
 * turn them away; higher limits, lower limits above 30 and weight limits depend on their
 * exact BMI, so they're worth asking about; lower limits at or below 30 never apply.
 */
function bmiSeverity(ex: Exclusion): Severity {
  const t = (ex.threshold ?? ex.source_text).replace(/\\/g, "").replace(/≥/g, ">=").replace(/≤/g, "<=");
  const results: Severity[] = [];
  // In an exclusion "BMI > 40" is an upper limit; in an inclusion "BMI < 35" is.
  const isUpper = (op: string) => (ex.section === "exclusion" ? op.startsWith(">") : op.startsWith("<"));
  for (const m of t.matchAll(/\b(BMI|weight)\b[^<>\d]{0,12}(>=|<=|>|<)\s*(\d+(?:\.\d+)?)/gi)) {
    const [, kind, op, num] = m;
    const n = Number(num);
    if (kind.toLowerCase() === "weight") results.push(isUpper(op) ? "soft" : null);
    else if (isUpper(op)) results.push(n <= 30 ? "hard" : "soft");
    else results.push(n > 30 ? "soft" : null);
  }
  for (const m of t.matchAll(/\bBMI\b[^\d]{0,12}(\d+(?:\.\d+)?)\s*(?:-|–|to|and)\s*(\d+(?:\.\d+)?)/gi)) {
    if (ex.section === "inclusion") results.push(Number(m[2]) <= 30 ? "hard" : "soft");
  }
  if (results.includes("hard")) return "hard";
  if (results.includes("soft") || results.length === 0) return "soft";
  return null;
}

/** How a patient answer meets one rule, for the rules that need more than the absolute flag. */
function severity(ex: Exclusion, value: string | undefined): Severity {
  if (ex.category === "bmi" && value === "yes") return bmiSeverity(ex);
  if (ex.category === "performance_status" && value !== undefined && value in ECOG_LEVEL) {
    // Same test as the funnel: a readable ECOG cap below the patient's level turns them
    // away. A cap we can't read is worth asking about, never a firm no.
    const cap = ecogCap(ex.threshold, ex.section);
    if (cap !== null) return ECOG_LEVEL[value] > cap ? "hard" : null;
    return value === "fully_active" ? null : "soft";
  }
  if (ex.category === "brain_mets" && value === "treated_stable") {
    return barsTreatedBrainMets(ex) ? "hard" : "soft";
  }
  return trips(ex.category, value, ex.absolute);
}

/** Classify one trial against the patient vector. */
export function classifyTrial(
  patient: PatientVector,
  trial: EnrichedTrial,
): MatchedTrial {
  const hits: Hit[] = [];
  const cancerMatch = trialMatchesCancer(trial, patient.cancer_type);
  // #4: 112 trials have no extracted rows. Mostly none of the 13 barriers were found,
  // plus the few long trials the model misreads (eval/results.md), so we say so.
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
    // #3: a brain_mets row on a brain-tumor trial describes the disease being
    // studied, not a barrier for this patient.
    if (ex.category === "brain_mets" && isBrainTumorTrial(trial)) continue;
    const value = (patient as Record<string, string | number | undefined>)[
      ex.category
    ] as string | undefined;
    const sev = severity(ex, value);
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
