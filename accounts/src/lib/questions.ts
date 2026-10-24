// Profile questions. The first one picks the role; the rest branch on it.
//
// Saved answers are {question key: option value}. Values are stable codes for
// matching; labels are only for display. Health conditions use the README
// category names (diabetes, renal, hepatic, ...) so they line up with
// exclusions.csv. Keep keys and values stable: saved profiles depend on them.

import townCounties from "@/data/ma-towns.json";

export const ROLES = ["patient", "caregiver", "trial_designer"] as const;
export type Role = (typeof ROLES)[number];
export const PATIENT_ROLES: readonly Role[] = ["patient", "caregiver"];

export type Home = { town: string; county: string | null; county_fips: string | null };
export type Body = { height_in: number; weight_lb: number; bmi: number };
export type AnswerValue = string | number | string[] | Home | Body;
export type Answers = Record<string, AnswerValue>;

export type Option = { value: string | number; label: string };
export type QuestionKind = "single" | "multi" | "number" | "text" | "town" | "body";

export type Question = {
  key: string;
  prompt: string;
  kind: QuestionKind;
  options?: Option[];
  help?: string;
  optional?: boolean;
  columns?: 1 | 2;
  min?: number;
  max?: number;
  showIf?: (answers: Answers) => boolean;
};

export const OUTSIDE_MA = "Outside Massachusetts";

export const COUNTY_FIPS: Record<string, string> = {
  Barnstable: "25001", Berkshire: "25003", Bristol: "25005", Dukes: "25007",
  Essex: "25009", Franklin: "25011", Hampden: "25013", Hampshire: "25015",
  Middlesex: "25017", Nantucket: "25019", Norfolk: "25021", Plymouth: "25023",
  Suffolk: "25025", Worcester: "25027",
};

/** {town: county} for all 351 MA municipalities, from P1's crosswalk. */
export const TOWN_COUNTIES: Record<string, string> = townCounties;

export function homeFor(town: string): Home {
  const county = TOWN_COUNTIES[town] ?? null;
  return { town, county, county_fips: county ? COUNTY_FIPS[county] : null };
}

const CANCER_TYPES: Option[] = [
  { value: "breast", label: "Breast" },
  { value: "lung", label: "Lung" },
  { value: "colorectal", label: "Colon or rectal" },
  { value: "prostate", label: "Prostate" },
  { value: "blood", label: "Blood cancer (leukemia, lymphoma, myeloma)" },
  { value: "skin", label: "Melanoma or other skin cancer" },
  { value: "pancreatic", label: "Pancreatic" },
  { value: "gynecologic", label: "Ovarian, uterine or cervical" },
  { value: "brain", label: "Brain or spinal cord" },
  { value: "kidney_bladder", label: "Kidney or bladder" },
  { value: "head_neck", label: "Head and neck" },
  { value: "liver_stomach", label: "Liver, stomach or esophagus" },
  { value: "other", label: "Other" },
];

const isPatient = (a: Answers) => PATIENT_ROLES.includes(a.role as Role);
const isDesigner = (a: Answers) => a.role === "trial_designer";
const mayBePregnant = (a: Answers) =>
  isPatient(a) && a.sex !== "male" && (typeof a.age !== "number" || a.age < 55);

export const QUESTIONS: Question[] = [
  {
    key: "role",
    prompt: "First, which best describes you?",
    kind: "single",
    options: [
      { value: "patient", label: "I have cancer, or I'm being checked for it" },
      { value: "caregiver", label: "I'm helping a family member or friend with cancer" },
      { value: "trial_designer", label: "I design, run or study clinical trials" },
    ],
  },

  // Patient and caregiver path. Caregivers answer for the person they help.
  { key: "age", prompt: "How old are you?", kind: "number", min: 0, max: 120, showIf: isPatient },
  {
    key: "sex",
    prompt: "What sex were you assigned at birth?",
    kind: "single",
    options: [
      { value: "female", label: "Female" },
      { value: "male", label: "Male" },
      { value: "prefer_not", label: "Prefer not to say" },
    ],
    help: "Some trials only enroll one sex, for example prostate or ovarian cancer trials.",
    showIf: isPatient,
  },
  {
    key: "home",
    prompt: "Where do you live?",
    kind: "town",
    help: "Start typing your city or town. We use it to find trial sites near you.",
    showIf: isPatient,
  },
  {
    key: "travel",
    prompt: "How far could you travel for trial visits?",
    kind: "single",
    options: [
      { value: "near", label: "Only close to home (about 30 minutes)" },
      { value: "hour", label: "Up to about an hour" },
      { value: "state", label: "Anywhere in Massachusetts, including Boston" },
    ],
    showIf: isPatient,
  },
  {
    key: "cancer_type",
    prompt: "What type of cancer is it?",
    kind: "single",
    columns: 2,
    options: [...CANCER_TYPES, { value: "not_sure", label: "Not sure yet" }],
    showIf: isPatient,
  },
  {
    key: "cancer_stage",
    prompt: "How far has it spread?",
    kind: "single",
    options: [
      { value: "early", label: "Early stage (stage 0 to 2)" },
      { value: "locally_advanced", label: "Locally advanced (stage 3)" },
      { value: "metastatic", label: "Spread to other parts of the body (stage 4)" },
      { value: "not_sure", label: "Not sure" },
    ],
    showIf: isPatient,
  },
  {
    key: "treatment_status",
    prompt: "Where are you with treatment?",
    kind: "single",
    options: [
      { value: "not_started", label: "Recently diagnosed, not treated yet" },
      { value: "in_treatment", label: "Getting treatment now" },
      { value: "finished", label: "Finished treatment" },
      { value: "recurred", label: "The cancer came back after treatment" },
    ],
    showIf: isPatient,
  },
  {
    key: "conditions",
    prompt: "Do you have any of these health conditions?",
    kind: "multi",
    options: [
      { value: "diabetes", label: "Diabetes" },
      { value: "renal", label: "Kidney disease or reduced kidney function" },
      { value: "hepatic", label: "Liver disease, including hepatitis B or C" },
      { value: "cardiac", label: "Heart failure, a heart attack or an irregular heartbeat" },
      { value: "hiv", label: "HIV" },
      { value: "brain_mets", label: "Cancer that has spread to the brain" },
      { value: "prior_malignancy", label: "A different cancer in the last 5 years" },
      { value: "none", label: "None of these" },
    ],
    help: "Pick all that apply. These are the conditions trials most often exclude.",
    showIf: isPatient,
  },
  {
    key: "diabetes_control",
    prompt: "Is your diabetes under control?",
    kind: "single",
    options: [
      { value: "controlled", label: "Yes, it's well controlled" },
      { value: "uncontrolled", label: "No, it's hard to control" },
      { value: "not_sure", label: "Not sure" },
    ],
    showIf: (a) => isPatient(a) && Array.isArray(a.conditions) && a.conditions.includes("diabetes"),
  },
  {
    key: "body",
    prompt: "What's your height and weight?",
    kind: "body",
    help: "We use this to work out your BMI, since some trials set a limit.",
    optional: true,
    showIf: isPatient,
  },
  {
    key: "smoking",
    prompt: "Do you smoke, vape or use other nicotine?",
    kind: "single",
    options: [
      { value: "never", label: "Never" },
      { value: "former", label: "I used to, but I quit" },
      { value: "current", label: "Yes, currently" },
    ],
    showIf: isPatient,
  },
  {
    key: "activity",
    prompt: "Which best describes your usual day?",
    kind: "single",
    // Values are the ECOG performance status (0 to 4).
    options: [
      { value: 0, label: "Fully active, same as before I got sick" },
      { value: 1, label: "I can't do hard physical activity, but I can do light work" },
      { value: 2, label: "Up and about more than half the day. I can look after myself but can't work" },
      { value: 3, label: "In bed or a chair more than half the day" },
      { value: 4, label: "Mostly in bed, and I need help looking after myself" },
    ],
    showIf: isPatient,
  },
  {
    key: "pregnancy",
    prompt: "Are you pregnant, breastfeeding or planning a pregnancy?",
    kind: "single",
    options: [
      { value: "pregnant", label: "Pregnant" },
      { value: "breastfeeding", label: "Breastfeeding" },
      { value: "planning", label: "Planning a pregnancy" },
      { value: "no", label: "None of these" },
      { value: "prefer_not", label: "Prefer not to say" },
    ],
    showIf: mayBePregnant,
  },
  {
    key: "language",
    prompt: "What language do you prefer for medical conversations?",
    kind: "single",
    columns: 2,
    options: [
      { value: "english", label: "English" },
      { value: "spanish", label: "Spanish" },
      { value: "portuguese", label: "Portuguese" },
      { value: "haitian_creole", label: "Haitian Creole" },
      { value: "chinese", label: "Chinese" },
      { value: "vietnamese", label: "Vietnamese" },
      { value: "other", label: "Other" },
    ],
    showIf: isPatient,
  },
  {
    key: "english_reading",
    prompt: "How comfortable are you reading consent forms in English?",
    kind: "single",
    options: [
      { value: "comfortable", label: "Comfortable" },
      { value: "with_help", label: "OK with some help" },
      { value: "not_comfortable", label: "Not comfortable" },
    ],
    showIf: (a) => isPatient(a) && a.language !== undefined && a.language !== "english",
  },
  {
    key: "notes",
    prompt: "Anything else a trial team should know?",
    kind: "text",
    help: "For example, treatments you've already had or what matters most to you.",
    optional: true,
    showIf: isPatient,
  },

  // Trial designer path.
  {
    key: "org_type",
    prompt: "What kind of organization do you work for?",
    kind: "single",
    options: [
      { value: "biotech", label: "Biotech or pharma company" },
      { value: "academic", label: "Academic medical center" },
      { value: "cro", label: "Contract research organization (CRO)" },
      { value: "community", label: "Community hospital" },
      { value: "advocacy", label: "Patient advocacy group" },
      { value: "other", label: "Other" },
    ],
    showIf: isDesigner,
  },
  { key: "org_name", prompt: "What's your organization called?", kind: "text", optional: true, showIf: isDesigner },
  {
    key: "job",
    prompt: "What's your role on trials?",
    kind: "single",
    options: [
      { value: "protocol_author", label: "Protocol author or medical writer" },
      { value: "investigator", label: "Principal investigator" },
      { value: "clin_ops", label: "Clinical operations" },
      { value: "biostat", label: "Biostatistician" },
      { value: "regulatory", label: "Regulatory affairs" },
      { value: "other", label: "Other" },
    ],
    showIf: isDesigner,
  },
  {
    key: "cancer_focus",
    prompt: "Which cancers do your trials focus on?",
    kind: "multi",
    options: CANCER_TYPES,
    help: "Pick all that apply.",
    showIf: isDesigner,
  },
  {
    key: "phases",
    prompt: "Which trial phases do you work on?",
    kind: "multi",
    options: [
      { value: "phase1", label: "Phase 1" },
      { value: "phase2", label: "Phase 2" },
      { value: "phase3", label: "Phase 3" },
      { value: "phase4", label: "Phase 4" },
    ],
    showIf: isDesigner,
  },
  {
    key: "counties",
    prompt: "Which Massachusetts counties do you recruit in?",
    kind: "multi",
    options: Object.keys(COUNTY_FIPS).map((county) => ({ value: county, label: county })),
    showIf: isDesigner,
  },
  {
    key: "goals",
    prompt: "What do you want from this tool?",
    kind: "multi",
    options: [
      { value: "broaden", label: "Broaden eligibility criteria" },
      { value: "diversity", label: "Enroll a more diverse population" },
      { value: "speed", label: "Enroll faster" },
      { value: "fda", label: "Follow FDA guidance on eligibility" },
    ],
    showIf: isDesigner,
  },
  { key: "designer_notes", prompt: "Anything else we should know?", kind: "text", optional: true, showIf: isDesigner },
];

export function visibleQuestions(answers: Answers): Question[] {
  return QUESTIONS.filter((q) => !q.showIf || q.showIf(answers));
}

/** Human-readable version of a saved answer. */
export function answerLabel(q: Question, value: AnswerValue | undefined): string {
  if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return "Skipped";
  const label = (v: string | number) => q.options?.find((o) => o.value === v)?.label ?? String(v);
  if (q.kind === "multi" && Array.isArray(value)) return value.map(label).join(", ");
  if (q.kind === "town" && typeof value === "object" && "town" in value) {
    return value.county ? `${value.town} (${value.county} County)` : value.town;
  }
  if (q.kind === "body" && typeof value === "object" && "bmi" in value) {
    const feet = Math.floor(value.height_in / 12);
    return `${feet} ft ${value.height_in % 12} in, ${value.weight_lb} lb (BMI ${value.bmi})`;
  }
  return label(value as string | number);
}

export function bmi(heightIn: number, weightLb: number): number {
  return Math.round((703 * weightLb * 10) / heightIn ** 2) / 10;
}
