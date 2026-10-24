import exclusionRowsMock from "./mock/exclusion-rows.json";
import { parseCsv, readProcessedText } from "./readProcessedFile";

export type ExclusionRow = {
  category: string;
  phase: string;
  sponsor: string;
  source_text: string;
};

export type ExclusionRowsData = {
  rows: ExclusionRow[];
  source: "mock" | "processed";
};

function loadFromProcessed(): ExclusionRow[] | null {
  const exclusionsText = readProcessedText("exclusions.csv");
  const trialsText = readProcessedText("trials.csv");
  if (!exclusionsText || !trialsText) {
    return null;
  }

  const exclusions = parseCsv(exclusionsText);
  const trials = parseCsv(trialsText);
  const trialByNct = new Map(trials.map((t) => [t.nct_id, t]));

  return exclusions
    .map((ex) => {
      const trial = trialByNct.get(ex.nct_id);
      if (!trial) {
        return null;
      }
      return {
        category: ex.category,
        phase: trial.phase || "Unknown",
        sponsor: trial.lead_sponsor || "Unknown",
        source_text: ex.source_text,
      };
    })
    .filter((row): row is ExclusionRow => row !== null);
}

export function loadExclusionRows(): ExclusionRowsData {
  const processed = loadFromProcessed();
  if (processed && processed.length > 0) {
    return { rows: processed, source: "processed" };
  }
  return {
    rows: exclusionRowsMock as ExclusionRow[],
    source: "mock",
  };
}
