// Rule-based linter for the Linter tab. It runs in the browser with no API key: each
// line of the pasted criteria is checked against keyword rules for the 13 README
// categories. The model-based extractor (pipeline/extract) built the Landscape data
// offline; this is the fast, explainable stand-in for live demos.

export type LintFlag = {
  category: string;
  threshold: string;
  absolute: boolean;
  section: "inclusion" | "exclusion";
  source_text: string;
  suggestion: string;
  suggestion_source: string;
};

export type LintResult = {
  flags: LintFlag[];
};

// Copied from pipeline/extract/suggest.py (keep in sync). An empty source means no
// FDA or ASCO-Friends guidance covers the category, so none is cited.
const SUGGESTIONS: Record<string, [string, string]> = {
  brain_mets: [
    "Allow patients with treated/stable or asymptomatic CNS metastases rather than excluding all brain metastases; define activity and stability criteria.",
    "FDA 2020 (Brain Metastases); ASCO-Friends 2017",
  ],
  hiv: [
    "Allow HIV-positive patients on effective antiretroviral therapy with adequate CD4 count instead of a blanket HIV exclusion.",
    "FDA 2020 (HIV/HBV/HCV); ASCO-Friends 2017",
  ],
  renal: [
    "Set renal thresholds to the level actually required for drug safety and allow calculated creatinine clearance; avoid cutoffs stricter than needed.",
    "FDA 2020 (Organ Dysfunction) & Laboratory Values; ASCO-Friends 2017/2021",
  ],
  hepatic: [
    "Set hepatic thresholds (bilirubin, AST/ALT) to what drug safety requires and allow for liver metastases or Gilbert's; avoid overly strict caps.",
    "FDA 2020 (Organ Dysfunction) & Laboratory Values; ASCO-Friends 2017/2021",
  ],
  cardiac: [
    "Use objective, drug-specific cardiac criteria (e.g. LVEF, recent-MI window) rather than broad 'clinically significant cardiac disease' exclusions.",
    "FDA 2020 (Organ Dysfunction); ASCO-Friends 2017",
  ],
  prior_malignancy: [
    "Exclude a prior malignancy only when it could confound safety/efficacy; otherwise allow it, rather than a blanket 'cancer within X years' rule.",
    "FDA 2020 (Prior/Concurrent Malignancies); ASCO-Friends 2017",
  ],
  age: [
    "Avoid arbitrary upper age caps and lower the minimum age where the science allows; justify any age limit by a specific safety or pharmacology concern.",
    "FDA 2020 (Minimum Age); ASCO-Friends 2017",
  ],
  performance_status: [
    "Consider including ECOG 2 (or the equivalent) when patients are otherwise clinically stable, instead of restricting to ECOG 0-1.",
    "FDA 2024 (Performance Status); ASCO-Friends 2021",
  ],
  diabetes: [
    "No specific FDA/ASCO guidance. Review whether excluding diabetes is scientifically necessary; consider allowing controlled diabetes with a documented HbA1c ceiling rather than a blanket exclusion.",
    "",
  ],
  bmi: [
    "No specific FDA/ASCO guidance. Review whether the BMI or weight cap is scientifically necessary (e.g. a scanner limit) or could be relaxed.",
    "",
  ],
  smoking: [
    "No specific FDA/ASCO guidance. Review whether the restriction is necessary; consider excluding only active use within a defined window rather than all current or former users.",
    "",
  ],
  language: [
    "No specific FDA/ASCO guidance. Consider offering translated consent and patient-reported-outcome materials rather than an English-only requirement, which can disproportionately exclude limited-English communities.",
    "",
  ],
  pregnancy: [
    "No specific FDA/ASCO guidance. Where the investigational agent allows, consider contraception requirements rather than a broad exclusion of all people who could become pregnant.",
    "",
  ],
};

/** A comparison with a number and unit, e.g. ">= 60 mL/min" or "> 8%". */
const COMPARISON =
  /(?:>=|<=|≥|≤|>|<)\s*\d+(?:\.\d+)?\s*(?:%|mL\/min(?:\/1\.73\s*m(?:2|²))?|mg\/dL|kg\/m(?:2|²)|x\s*ULN|×\s*ULN|ms(?:ec)?\b)?/i;

function firstComparison(line: string): string {
  return line.match(COMPARISON)?.[0].trim() ?? "";
}

type Rule = {
  category: string;
  /** Returns the threshold ("" if none) when the line restricts this category, else null. */
  match: (line: string) => string | null;
};

const when =
  (pattern: RegExp, threshold: (line: string) => string = firstComparison, unless?: RegExp) =>
  (line: string) =>
    pattern.test(line) && !(unless && unless.test(line)) ? threshold(line) : null;

/** An upper age cap, or a minimum age above 18 (the README's definition of an age restriction). */
function ageThreshold(raw: string): string | null {
  const line = raw.replace(/\\([<>=])/g, "$1"); // CT.gov escapes: "\<" -> "<"
  if (!/\bage[ds]?\b|years? (?:old|of age|at (?:the )?time)|\d\s*(?:years|yrs)\s*(?:or|and)\s*(?:older|over|above|younger|under|below)/i.test(line)) return null;
  // Age used to define something else (menopause, pregnancy testing, QT risk), not who can enroll.
  if (/children are excluded|menopaus|menses|pregnan|childbearing|child-bearing|sudden death|early[- ]onset/i.test(line)) return null;
  // Only numbers tied to an age count, so "ECOG ≤ 1" or "(140 - Age)" can't become an age limit.
  const Y = String.raw`\s*(?:years?|yrs?)\b`;
  const num = (m: RegExpMatchArray | null) => (m ? Number(m.slice(1).find((g) => g !== undefined)) : undefined);
  let min: number | undefined;
  let max: number | undefined;
  const range =
    line.match(new RegExp(String.raw`(\d{1,3})\s*(?:-|–|to)\s*(\d{1,3})${Y}`, "i")) ??
    line.match(new RegExp(String.raw`between\s*(\d{1,3})\s*and\s*(\d{1,3})${Y}`, "i")) ??
    line.match(/\bage[ds]?[\s:]*(\d{1,3})\s*(?:-|–|to)\s*(\d{1,3})\b/i);
  if (range) [min, max] = [Number(range[1]), Number(range[2])];
  const GE = "(?:≥|>=|>|at least|older than|over|(?:greater|more) than(?: or equal to)?)";
  const LE = "(?:≤|<=|=<|<|up to|younger than|under|no older than|not older than|less than(?: or equal to)?)";
  const atLeast = num(
    line.match(
      new RegExp(
        String.raw`\bage[ds]?(?:\s+of)?[\s:]*${GE}\s*(\d{1,3})|${GE}\s*(\d{1,3})${Y}|(\d{1,3})${Y}(?:\s*old)?(?:\s*of age)?\s*(?:or|and)\s*(?:older|over|above)|\bage[ds]?\s*(\d{1,3})\s*(?:\+|(?:or|and)\s*(?:older|over|above))`,
        "i",
      ),
    ),
  );
  if (atLeast !== undefined) min = atLeast;
  const atMost = num(
    line.match(
      new RegExp(
        String.raw`\bage[ds]?(?:\s+of)?[\s:]*${LE}\s*(\d{1,3})|${LE}\s*(\d{1,3})${Y}|(\d{1,3})${Y}(?:\s*old)?(?:\s*of age)?\s*(?:or|and)\s*(?:younger|under|below)|\bage[ds]?\s*(\d{1,3})\s*(?:or|and)\s*(?:younger|under|below)`,
        "i",
      ),
    ),
  );
  if (atMost !== undefined) max = atMost;

  const parts = [];
  if (min !== undefined && min > 18) parts.push(`age ≥ ${min}`);
  // A lone "< 18" / "under 18" excludes children (a minimum age of 18), not an upper cap.
  const lower =
    min !== undefined ||
    /(?:≥|>=|>|at least|from)\s*\d+\s*(?:months?|weeks?|days?)|\d+\s*(?:months?|weeks?|days?)\s*(?:to|-|–|and|up to)/i.test(line);
  if (max !== undefined && max < 120 && (max > 18 || lower)) parts.push(`age ≤ ${max}`);
  return parts.length ? parts.join(", ") : null;
}

function performanceThreshold(line: string): string {
  const m = line.match(
    /\b(ECOG|Zubrod|Karnofsky|KPS|Lansky)\b[^0-9≤≥<>]{0,40}?((?:[≤≥<>]=?\s*)?\d{1,3}\s*%?(?:\s*(?:,\s*or|,|-|–|to|or)\s*\d{1,3}\s*%?)*)/i,
  );
  return m ? `${m[1]} ${m[2].replace(/\s+/g, " ").trim()}` : "";
}

function withinYears(line: string): string {
  const m = line.match(/within\s+(?:the\s+)?(?:past\s+|last\s+|prior\s+|previous\s+)?(\d+|one|two|three|four|five)\s+years?/i);
  return m ? `within ${m[1]} years` : "";
}

const RULES: Rule[] = [
  { category: "age", match: ageThreshold },
  { category: "performance_status", match: when(/\becog\b|karnofsky|\bkps\b|performance status|\bzubrod\b|lansky/i, performanceThreshold) },
  {
    category: "renal",
    // Kidney eGFR/GFR, but not the EGFR gene in lung-cancer trials: capital "EGFR" only
    // counts when a comparison or number follows. "\brenal" keeps "adrenal" out.
    match: (line) =>
      /\beGFR\b|\bGFR\b/.test(line) || /\bEGFR\s*(?:\\?[<>]|[≥≤=]|of\s*\d)/.test(line)
        ? firstComparison(line)
        : when(
            /creatinine|\bcrcl\b|glomerular filtration|kidney (?:disease|function|failure|impairment)|\brenal (?:function|failure|impairment|insufficiency|disease)|dialysis/i,
          )(line),
  },
  {
    category: "hepatic",
    match: (line) =>
      /bilirubin|transaminase|hepatic (?:function|impairment|insufficiency|disease)|liver (?:function|disease|failure|impairment)|cirrhosis|child-pugh/i.test(line) ||
      /\b(?:AST|ALT|SGOT|SGPT)\b/.test(line)
        ? firstComparison(line)
        : null,
  },
  {
    category: "cardiac",
    match: when(
      /\bnyha\b|new york heart association|\bqtc|qt interval|myocardial infarction|heart failure|\blvef\b|ejection fraction|unstable angina|cardiac (?:disease|arrhythmia|failure|event)|cardiovascular (?:disease|dysfunction|abnormalit|condition|event)|heart disease|arrhythmia|cardiomyopathy/i,
    ),
  },
  { category: "hiv", match: when(/\bhiv\b|human immunodeficiency virus/i, () => "") },
  {
    category: "brain_mets",
    match: when(
      /(?:brain|\bcns|central nervous system(?:\s*\(cns\))?|meningeal|intracranial|spinal cord)\s+(?:or\s+\w+\s+)?metast|\b(?:cns|central nervous system(?:\s*\(cns\))?)\s+(?:disease|involvement|lesions?|leukemia|lymphoma)|metastatic cns|leptomening|carcinomatous meningitis/i,
      () => "",
    ),
  },
  {
    category: "prior_malignancy",
    match: (line) =>
      /(?:prior|previous|other|another|second|secondary|concurrent|additional|different|synchronous|co-?existing)\s+(?:(?:active|invasive|primary|known|current|type of|or\s+\w+)\s+){0,2}(?:malignan\w*|cancers?)(?!\s*(?:-?directed|therap|treatment|drug))/i.test(line) ||
      /(?<!family )history of (?:an?\s+|any\s+)?(?:\w+\s+){0,2}?(?:malignan|cancer\b)|malignan\w*\s+other than|\bactive (?:\w+[- ])?malignanc(?:y|ies)|\b(?:invasive )?malignanc(?:y|ies) within/i.test(line)
        ? withinYears(line)
        : null,
  },
  {
    category: "diabetes",
    match: (line) => {
      if (!/diabet|hba1c|hemoglobin a1c|\ba1c\b|glycemic control|fasting (?:plasma |blood )?glucose/i.test(line)) return null;
      // Text that lets these patients in (common immunotherapy boilerplate), or diabetes insipidus.
      const letsIn =
        /diabetes insipidus|\b(?:are|is)\s+(?:also\s+)?(?:eligible|permitted|allowed|acceptable|accepted)\b|will not be excluded|(?:can|may) be included|with the exception of|exceptions? include|except\b[^.;]{0,60}diabet|insulin for|not considered/i;
      const restricts = /(?:uncontrolled|poorly controlled) (?:diabet|blood glucose)|hba1c|\ba1c\b|glucose\s*(?:\\?[>≥]|above)/i;
      return letsIn.test(line) && !restricts.test(line) ? null : firstComparison(line);
    },
  },
  { category: "bmi", match: when(/\bbmi\b|body mass index/i) },
  { category: "smoking", match: when(/smok|tobacco|nicotine|cigarette|\bvap(?:e|es|ing)\b/i, () => "") },
  {
    category: "language",
    match: when(
      /\benglish\b|\bspanish\b|\bportuguese\b|\bmandarin\b|\bcantonese\b|interpreter|literacy|\billiterate\b|\blanguages?\b/i,
      () => "",
      // Not a restriction: language impairments, or text that welcomes other languages.
      /impair|aphasi|encourag|are eligible|may (?:also )?participate|will be provided/i,
    ),
  },
  // "\blactat(ing|ion)" so lactate dehydrogenase (LDH) lab limits don't count.
  { category: "pregnancy", match: when(/pregnan|breast-?feed|\blactat(?:ing|ion)\b/i, () => "") },
];

/**
 * Words that make a restriction conditional (README: absolute = false), including text
 * that lets some of these patients in ("on effective therapy are eligible").
 */
const CONDITIONAL =
  /\b(?:uncontrolled|unless|stable|controlled|active|symptomatic|untreated|progressive|clinically significant|requiring|except)\b|\b(?:are|is|will be) (?:eligible|allowed|permitted)\b|\bmay (?:enroll|be eligible|participate)\b/i;
const ALWAYS = /treated (?:or|and) untreated|regardless/i;
// HIV text says "active" or "known" for a plain exclusion, so only these make it conditional.
const HIV_CONDITIONAL =
  /\b(?:unless|except|(?:un)?controlled|undetectable|cd4)\b|detectable viral load|\b(?:are|is|will be) (?:eligible|allowed|permitted)\b|\bmay (?:enroll|be eligible|participate)\b/i;

function sectionHeader(line: string): { section: "inclusion" | "exclusion"; rest: string } | null {
  const m =
    line.match(/^\s*(?:key\s+)?(inclusion|exclusion)s?(?:\s+criteria)?\s*(?::\s*(.*)|$)/i) ??
    line.match(/^\s*(?:key\s+)?(inclusion|exclusion)s?\s+criteria\b\W*(.*)$/i);
  if (m) return { section: m[1].toLowerCase() as "inclusion" | "exclusion", rest: (m[2] ?? "").trim() };
  // "Patients are excluded if they have:" style headers.
  if (/^(?:patients|participants|subjects)\s+(?:are|will be)\s+(?:excluded|ineligible)\b.*:\s*$/i.test(line)) {
    return { section: "exclusion", rest: "" };
  }
  if (/^(?:patients|participants|subjects)\s+(?:are|will be)\s+(?:eligible|included)\b.*:\s*$/i.test(line)) {
    return { section: "inclusion", rest: "" };
  }
  return null;
}

/** Without a header, guess from the wording; restrictive text is usually an exclusion. */
function guessSection(line: string): "inclusion" | "exclusion" {
  if (/\bexclu|not eligible|ineligible|must not|\bno (?:known|history|prior)\b|^known\b/i.test(line)) return "exclusion";
  if (/\bmust\b|\brequired?\b|\beligible\b|at least|≥|>=/i.test(line)) return "inclusion";
  return "exclusion";
}

const BULLET = /^\s*(?:[-*•·◦▪]|\d{1,2}[.)]|[a-z][.)])\s+/i;

/** Lines of criteria, split further on ";" and between sentences. */
function clauses(text: string): { text: string; section: "inclusion" | "exclusion" | null }[] {
  const out: { text: string; section: "inclusion" | "exclusion" | null }[] = [];
  let section: "inclusion" | "exclusion" | null = null;
  // Also break before a header in the middle of a pasted paragraph.
  for (const rawLine of text.split(/\r\n?|\n|(?=\b(?:INCLUSION|EXCLUSION|Inclusion|Exclusion) (?:CRITERIA|Criteria|criteria)\s*:)/)) {
    let line = rawLine.replace(BULLET, "").trim();
    if (!line) continue;
    const header = sectionHeader(line);
    if (header) {
      section = header.section;
      line = header.rest;
      if (!line) continue;
    }
    // (?<=\S) keeps the bullet split fast on long runs of spaces.
    for (const part of line.split(/;\s*|(?<=\.)\s+(?=[A-Z(])|(?<=\S)\s+[*•]\s+(?=\S)/)) {
      const clause = part.replace(BULLET, "").trim();
      if (clause.length > 2) out.push({ text: clause, section });
    }
  }
  return out;
}

const quote = (text: string) => (text.length > 280 ? `${text.slice(0, 277)}...` : text);

/** Flag restrictive criteria, one flag per category (an absolute restriction wins over a conditional one). */
export function mockLintCriteria(text: string): LintResult {
  const byCategory = new Map<string, LintFlag>();
  for (const clause of clauses(text)) {
    for (const rule of RULES) {
      const threshold = rule.match(clause.text);
      if (threshold === null) continue;
      const conditional = rule.category === "hiv" ? HIV_CONDITIONAL : CONDITIONAL;
      const absolute = ALWAYS.test(clause.text) || !conditional.test(clause.text);
      const existing = byCategory.get(rule.category);
      if (existing && (existing.absolute || !absolute)) continue;
      const [suggestion, suggestion_source] = SUGGESTIONS[rule.category];
      byCategory.set(rule.category, {
        category: rule.category,
        threshold,
        absolute,
        section: clause.section ?? guessSection(clause.text),
        source_text: quote(clause.text),
        suggestion,
        suggestion_source,
      });
    }
  }
  return { flags: [...byCategory.values()] };
}
