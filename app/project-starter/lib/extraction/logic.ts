// Port of pipeline/extract/logic.py: quote verification, the deterministic noise
// guards and the one-row-per-category dedupe. The live Linter runs the model's raw
// records through these exactly as the pipeline did when it wrote exclusions.csv.
// scripts/check-extraction-parity.ts compares the two on every cached trial.

export type RawRecord = {
  category: string;
  threshold?: string | null;
  absolute?: boolean;
  section?: string;
  source_text?: string;
};

export type ExtractedRecord = {
  category: string;
  threshold: string | null;
  absolute: boolean;
  section: string;
  source_text: string;
};

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'", nbsp: " " };

/** Python's html.unescape for the entities that occur in ClinicalTrials.gov text. */
function unescapeHtml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code)) return whole;
      // Like html.unescape: code points that can't exist become U+FFFD instead of throwing.
      if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return "\ufffd";
      return String.fromCodePoint(code);
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

// ClinicalTrials.gov escapes markdown-ish punctuation ("\[C1D1\]", "\>75"); the model
// quotes the clean form.
const ESCAPED_PUNCT = /\\([[\]<>*_()#.+\-^`!~={}|])/g;

/** Decode entities, drop escapes, collapse whitespace, lowercase (logic.normalize). */
export function normalize(s: string): string {
  return unescapeHtml(s ?? "")
    .replace(ESCAPED_PUNCT, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** True if the quote appears in the criteria after normalization. */
export function isValid(sourceText: string, eligibilityText: string): boolean {
  const needle = normalize(sourceText);
  return needle !== "" && normalize(eligibilityText).includes(needle);
}

const AGE_NUM = /(?<![\w.])(\d{1,3})(?!\w|\.\d)\s*(?:years?|yrs?|yo\b|y\/o\b)?/gi;
const AGE_UPPER_HINT = /(<|≤|=<|under|up to|maximum|younger than|no older|between|-\s*\d)/i;
const AGE_RANGE = /\d{1,3}\s*(?:months?|years?|yrs?)?\s*(?:to|-|–|—)\s*(\d{1,3})\b/i;
const AGE_CHILD_BOILERPLATE =
  /(because|since).{0,80}(not|no).{0,40}(available|data).{0,80}(patients?|children).{0,40}(<|less than|under)\s*18/i;
const AGE_CHILD_EXCLUDED = /(children|pediatric|patients?\s*(<|less than|under)\s*18).{0,60}(excluded|not eligible)/i;

/** True if an age quote only says "adults only" (an 18+ floor or child-exclusion boilerplate). */
export function isBareAdultFloor(sourceText: string): boolean {
  const text = normalize(sourceText);
  if (!text) return false;
  const ages = [...text.matchAll(AGE_NUM)].map((m) => Number(m[1])).filter((n) => n > 0 && n <= 120);
  if (ages.some((n) => n > 18)) return false;
  if (AGE_RANGE.test(text)) return false;
  if (AGE_CHILD_BOILERPLATE.test(text) || AGE_CHILD_EXCLUDED.test(text)) return true;
  if (AGE_UPPER_HINT.test(text)) return false;
  if (ages.length === 0) return false;
  return Math.max(...ages) <= 18;
}

// Each category's quote must contain one of these, mirroring the prompt's triggers.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  diabetes: ["diabet", "hba1c", "a1c", "glycemic", "glycaemic", "glucose", "insulin"],
  bmi: ["bmi", "body mass", "kg/m", "body weight", "weight >", "weight <", "lbs", "kg)"],
  smoking: ["smok", "tobacco", "nicotine", "cigarette", "vap"],
  renal: ["kidney", "renal", "creatinine", "clearance", "crcl", "egfr", "gfr", "glomerular", "dialysis", "nephr"],
  hepatic: [
    "liver", "hepat", "bilirubin", "ast", "alt", "sgot", "sgpt", "inr", "cirrhosis", "child-pugh", "transaminase",
    "aminotransferase",
  ],
  cardiac: [
    "cardiac", "heart", "nyha", "myocardial", "mi", "lvef", "ef", "ejection fraction", "qtc", "qt interval",
    "arrhythmi", "chf", "congestive", "cardiovascular", "angina", "stroke",
  ],
  hiv: ["hiv", "human immunodeficiency", "aids", "cd4", "antiretroviral", "anti-retroviral"],
  brain_mets: ["cns", "central nervous", "brain", "leptomening", "intracranial", "cerebral"],
  prior_malignancy: ["malignan", "cancer", "carcinoma", "tumor", "tumour", "neoplasm"],
  performance_status: [
    "ecog", "karnofsky", "lansky", "performance status", "performance score", "eastern cooperative",
    "eastern oncology",
  ],
  language: ["english", "spanish", "language", "speak", "read", "fluent", "interpreter", "literacy"],
  pregnancy: ["pregnan", "breastfeed", "breast-feed", "lactat", "nursing"],
};

// Short keywords match whole words only ("ast" must not fire inside "breast").
const WHOLE_WORD = new Set(["ast", "alt", "mi", "ef", "gfr", "cns", "aids", "cd4", "a1c", "bmi", "chf", "hiv", "inr"]);

const keywordIn = (keyword: string, text: string) =>
  WHOLE_WORD.has(keyword) ? new RegExp(`\\b${keyword}\\b`).test(text) : text.includes(keyword);

/** True if the quote mentions something its category requires (age is checked numerically). */
export function quoteMatchesCategory(category: string, sourceText: string): boolean {
  if (category === "age") return true;
  const keys = CATEGORY_KEYWORDS[category];
  if (!keys) return true;
  const text = normalize(sourceText);
  return keys.some((k) => keywordIn(k, text));
}

/** Drop "adults only" age rows and rows whose quote is about another category. */
export function dropNoise<T extends RawRecord>(records: T[]): T[] {
  return records.filter((r) => {
    const quote = r.source_text ?? "";
    if (r.category === "age" && isBareAdultFloor(quote)) return false;
    return quoteMatchesCategory(r.category, quote);
  });
}

/** One row per category, first in document order; an absolute restriction beats a conditional one. */
export function dedupe(records: RawRecord[]): ExtractedRecord[] {
  const groups = new Map<string, RawRecord[]>();
  for (const r of records) {
    if (!r.category) continue;
    const group = groups.get(r.category);
    if (group) group.push(r);
    else groups.set(r.category, [r]);
  }
  return [...groups.values()].map((group) => {
    const absolutes = group.filter((r) => r.absolute === true);
    const chosen = (absolutes.length ? absolutes : group)[0];
    return {
      category: chosen.category,
      threshold: chosen.threshold ?? null,
      absolute: Boolean(chosen.absolute),
      section: chosen.section ?? "",
      source_text: chosen.source_text ?? "",
    };
  });
}

/** The pipeline's write path: keep verifiable quotes, drop noise, one row per category. */
export function cleanRecords(raw: RawRecord[], eligibilityText: string): ExtractedRecord[] {
  return dedupe(dropNoise(raw.filter((r) => isValid(r.source_text ?? "", eligibilityText))));
}
