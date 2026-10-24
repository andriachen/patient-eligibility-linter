import fs from "fs";
import path from "path";

import statsMock from "./mock/stats.json";

export type CategoryStat = {
  category: string;
  label: string;
  pctExcluded: number;
  trialCount: number;
};

export type LandscapeStats = {
  totalTrials: number;
  defaultCategory: string;
  /** Full headline sentence and source line from eval/build_stats.py (optional). */
  headline?: string;
  headlineNote?: string;
  categories: CategoryStat[];
  source: "mock" | "processed";
};

type StatsFile = Omit<LandscapeStats, "source">;

// Prefer the in-app copy (bundled by Vercel via scripts/copy-data.mjs); fall back
// to the repo-root path for local dev before the copy has run.
function resolveStatsPath(): string {
  const inApp = path.join(process.cwd(), "data", "processed", "stats.json");
  if (fs.existsSync(inApp)) return inApp;
  return path.join(process.cwd(), "..", "..", "data", "processed", "stats.json");
}

function readProcessedStats(): StatsFile | null {
  const p = resolveStatsPath();
  if (!fs.existsSync(p)) {
    return null;
  }
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw) as StatsFile;
}

/** Landscape summary stats: real file if present, otherwise lib/mock/stats.json */
export function loadLandscapeStats(): LandscapeStats {
  const processed = readProcessedStats();
  if (processed) {
    return { ...processed, source: "processed" };
  }
  return { ...(statsMock as StatsFile), source: "mock" };
}

export function getCategoryStat(
  stats: LandscapeStats,
  categoryKey: string,
): CategoryStat | undefined {
  return stats.categories.find((c) => c.category === categoryKey);
}
