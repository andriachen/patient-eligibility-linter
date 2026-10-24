import countiesMock from "./mock/counties.json";
import { parseCsv, readProcessedText } from "./readProcessedFile";
import { CATEGORY_KEYS } from "./categories";

export type PlacesMeasures = {
  diabetes: number;
  obesity: number;
  smoking: number;
  mental_distress: number;
  checkup: number;
};

export type EjMetrics = {
  ej_block_groups: number;
  ej_minority_pct: number;
  ej_limited_english_pct: number;
};

export type CountyRecord = {
  county: string;
  county_fips: string;
  trialSites: number;
  /** Distinct trials with at least one recruiting site in the county. */
  trials: number;
  /** Share of those trials with a restriction in each category (exclusions.csv). */
  trialsWithCategoryPct: Record<string, number>;
  places: PlacesMeasures;
  ej: EjMetrics;
};

export type CountiesData = {
  counties: CountyRecord[];
  source: "mock" | "processed";
};

const PLACE_KEYS: (keyof PlacesMeasures)[] = [
  "diabetes",
  "obesity",
  "smoking",
  "mental_distress",
  "checkup",
];

function emptyPlaces(): PlacesMeasures {
  return {
    diabetes: 0,
    obesity: 0,
    smoking: 0,
    mental_distress: 0,
    checkup: 0,
  };
}

function loadFromProcessed(): CountyRecord[] | null {
  const metricsText = readProcessedText("county_metrics.csv");
  const ejText = readProcessedText("county_ej.csv");
  const sitesText = readProcessedText("trial_sites.csv");
  if (!metricsText) {
    return null;
  }

  const exclusionsText = readProcessedText("exclusions.csv");
  const metrics = parseCsv(metricsText);
  const ejRows = ejText ? parseCsv(ejText) : [];
  const sites = sitesText ? parseCsv(sitesText) : [];
  const exclusions = exclusionsText ? parseCsv(exclusionsText) : [];

  const byCounty = new Map<string, CountyRecord>();

  for (const row of metrics) {
    const key = row.county_fips || row.county;
    if (!key) continue;
    let rec = byCounty.get(key);
    if (!rec) {
      rec = {
        county: row.county,
        county_fips: row.county_fips,
        trialSites: 0,
        trials: 0,
        trialsWithCategoryPct: Object.fromEntries(
          CATEGORY_KEYS.map((c) => [c, 0]),
        ),
        places: emptyPlaces(),
        ej: {
          ej_block_groups: 0,
          ej_minority_pct: 0,
          ej_limited_english_pct: 0,
        },
      };
      byCounty.set(key, rec);
    }
    const measure = row.measure_key as keyof PlacesMeasures;
    if (PLACE_KEYS.includes(measure)) {
      rec.places[measure] = Number(row.pct) || 0;
    }
  }

  for (const row of ejRows) {
    const key = row.county_fips || row.county;
    const rec = key ? byCounty.get(key) : undefined;
    if (!rec) continue;
    rec.ej = {
      ej_block_groups: Number(row.ej_block_groups) || 0,
      ej_minority_pct: Number(row.ej_minority_pct) || 0,
      ej_limited_english_pct: Number(row.ej_limited_english_pct) || 0,
    };
  }

  const siteCounts = new Map<string, number>();
  const trialsByCounty = new Map<string, Set<string>>();
  for (const row of sites) {
    const fips = row.county_fips;
    if (!fips) continue;
    siteCounts.set(fips, (siteCounts.get(fips) ?? 0) + 1);
    if (row.nct_id) {
      const trials = trialsByCounty.get(fips) ?? new Set<string>();
      trials.add(row.nct_id);
      trialsByCounty.set(fips, trials);
    }
  }

  const categoriesByTrial = new Map<string, Set<string>>();
  for (const row of exclusions) {
    if (!row.nct_id || !row.category) continue;
    const categories = categoriesByTrial.get(row.nct_id) ?? new Set<string>();
    categories.add(row.category);
    categoriesByTrial.set(row.nct_id, categories);
  }

  for (const rec of byCounty.values()) {
    rec.trialSites = siteCounts.get(rec.county_fips) ?? rec.trialSites;
    // Percentages are of distinct trials, not site rows: a trial with three Boston
    // sites still counts once for Suffolk.
    const trials = trialsByCounty.get(rec.county_fips) ?? new Set<string>();
    rec.trials = trials.size;
    for (const category of CATEGORY_KEYS) {
      let hits = 0;
      for (const id of trials) {
        if (categoriesByTrial.get(id)?.has(category)) hits++;
      }
      rec.trialsWithCategoryPct[category] = trials.size ? Math.round((1000 * hits) / trials.size) / 10 : 0;
    }
  }

  const list = [...byCounty.values()];
  return list.length > 0 ? list : null;
}

export function loadCounties(): CountiesData {
  const processed = loadFromProcessed();
  if (processed) {
    return { counties: processed, source: "processed" };
  }
  // The mock file predates the `trials` field; treat each mock site as one trial.
  const mock = (countiesMock as { counties: Omit<CountyRecord, "trials">[] }).counties;
  return {
    counties: mock.map((c) => ({ ...c, trials: c.trialSites })),
    source: "mock",
  };
}
