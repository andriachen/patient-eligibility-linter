import { type CountyRecord, loadCounties } from "./loadCounties";
import { allEligibilityTexts } from "./loadTrialDetails";
import { loadTrialsIndex } from "./loadTrialsIndex";
import { mockLintCriteria } from "./mockLint";
import { loadLandscapeStats } from "./loadStats";

/** Real data the Linter's Impact tab shows next to each flag. Built on the server. */
export type LintContext = {
  totalTrials: number;
  /** Share of recruiting MA cancer trials with a restriction in each category. */
  trialPctByCategory: Record<string, number>;
  /** County population measures for the categories that have one, highest first. */
  population: Record<string, { measure: string; source: string; counties: { county: string; pct: number }[] }>;
  /** flagHistogram[n] = how many trials the same keyword rules flag in n categories. */
  flagHistogram: number[];
  /** modelHistogram[n] = how many trials the model's extraction (exclusions.csv) restricts in n categories. */
  modelHistogram: number[];
  source: "mock" | "processed";
};

// Each measure is separate: CDC PLACES gives prevalence per condition, not overlap, so
// these are never combined.
const POPULATION_MEASURES: Record<string, { measure: string; source: string; pick: (c: CountyRecord) => number }> = {
  diabetes: { measure: "Adults with diabetes", source: "CDC PLACES 2023", pick: (c) => c.places.diabetes },
  bmi: {
    measure: "Adults with obesity (BMI 30+, an upper bound for caps above 30)",
    source: "CDC PLACES 2023",
    pick: (c) => c.places.obesity,
  },
  smoking: { measure: "Adults who smoke", source: "CDC PLACES 2023", pick: (c) => c.places.smoking },
  language: {
    measure: "Limited-English households in environmental-justice areas",
    source: "MassGIS EJ 2020",
    pick: (c) => c.ej.ej_limited_english_pct,
  },
};

export function loadLintContext(): LintContext {
  const stats = loadLandscapeStats();
  const { counties, source } = loadCounties();
  const population: LintContext["population"] = {};
  for (const [category, { measure, source: dataSource, pick }] of Object.entries(POPULATION_MEASURES)) {
    population[category] = {
      measure,
      source: dataSource,
      counties: counties
        .map((c) => ({ county: c.county, pct: pick(c) }))
        .filter((c) => c.pct > 0)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 5),
    };
  }
  // Compare a draft like for like: keyword flags against the same rules run on every
  // trial, model flags against the model's extraction of every trial.
  const flagHistogram: number[] = [];
  for (const text of allEligibilityTexts()) {
    const n = mockLintCriteria(text).flags.length;
    flagHistogram[n] = (flagHistogram[n] ?? 0) + 1;
  }
  const modelHistogram: number[] = [];
  for (const trial of loadTrialsIndex().trials) {
    const n = new Set(trial.exclusions.map((e) => e.category)).size;
    modelHistogram[n] = (modelHistogram[n] ?? 0) + 1;
  }

  return {
    totalTrials: stats.totalTrials,
    flagHistogram: Array.from(flagHistogram, (v) => v ?? 0),
    modelHistogram: Array.from(modelHistogram, (v) => v ?? 0),
    trialPctByCategory: Object.fromEntries(stats.categories.map((c) => [c.category, c.pctExcluded])),
    population,
    source: stats.source === "processed" && source === "processed" ? "processed" : "mock",
  };
}
