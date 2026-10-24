import { CATEGORY_KEYS } from "./categories";

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
  countyImpact: { county: string; affectedTrialsPct: number }[];
};

const RULES: {
  category: string;
  pattern: RegExp;
  suggestion: string;
}[] = [
  {
    category: "diabetes",
    pattern: /diabet|hba1c|a1c|glycemic/i,
    suggestion:
      "Consider allowing stable, controlled diabetes with a documented HbA1c ceiling instead of blanket exclusion.",
  },
  {
    category: "bmi",
    pattern: /bmi|body mass|kg\/m/i,
    suggestion:
      "Consider a higher BMI cap or comorbidity-based exceptions where safety allows.",
  },
  {
    category: "smoking",
    pattern: /smok|tobacco|nicotine|cigarette|vap/i,
    suggestion:
      "Consider excluding only active use within a short window rather than all former smokers.",
  },
  {
    category: "language",
    pattern: /english|speak|read.*language|interpreter/i,
    suggestion:
      "Offer translated consent and PRO instruments; avoid English-only literacy requirements when possible.",
  },
  {
    category: "pregnancy",
    pattern: /pregnan|breastfeed|childbearing/i,
    suggestion:
      "Use contraception requirements rather than broad exclusion where the investigational agent allows.",
  },
  {
    category: "performance_status",
    pattern: /ecog|karnofsky|performance status/i,
    suggestion:
      "Consider ECOG 2 when patients are otherwise clinically stable and monitoring is feasible.",
  },
  {
    category: "renal",
    pattern: /creatinine|egfr|crcl|kidney|renal/i,
    suggestion:
      "Align renal thresholds with standard of care and allow consultation for borderline function.",
  },
  {
    category: "cardiac",
    pattern: /nyha|qtc|myocardial|heart failure|lvef/i,
    suggestion:
      "Specify objective cardiac criteria and stability windows instead of broad cardiac exclusions.",
  },
];

export function mockLintCriteria(text: string): LintResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { flags: [], countyImpact: [] };
  }

  const flags: LintFlag[] = [];
  for (const rule of RULES) {
    if (rule.pattern.test(trimmed)) {
      const snippet =
        trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
      flags.push({
        category: rule.category,
        threshold: "",
        absolute: true,
        section: "exclusion",
        source_text: snippet,
        suggestion: rule.suggestion,
        suggestion_source: "mock protocol playbook",
      });
    }
  }

  if (flags.length === 0) {
    flags.push({
      category: CATEGORY_KEYS[0],
      threshold: "",
      absolute: false,
      section: "exclusion",
      source_text: trimmed.slice(0, 160),
      suggestion:
        "No strong keyword match in mock linter — review manually with the protocol team.",
      suggestion_source: "mock fallback",
    });
  }

  const countyImpact = [
    { county: "Suffolk", affectedTrialsPct: 41 },
    { county: "Middlesex", affectedTrialsPct: 38 },
    { county: "Hampden", affectedTrialsPct: 35 },
    { county: "Worcester", affectedTrialsPct: 33 },
    { county: "Norfolk", affectedTrialsPct: 31 },
  ];

  return { flags, countyImpact };
}
