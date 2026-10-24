// Checks that lib/extraction/logic.ts filters the model's output exactly like the
// pipeline: for every cached trial in data/cache, cleanRecords(raw, criteria) must
// reproduce that trial's rows in data/processed/exclusions.csv.
// Run from app/project-starter: npx tsx scripts/check-extraction-parity.ts

import fs from "fs";
import path from "path";

import { cleanRecords, type RawRecord } from "../lib/extraction/logic";
import { parseCsv } from "../lib/readProcessedFile";

const root = path.join(process.cwd(), "..", "..");
const texts = new Map(
  parseCsv(fs.readFileSync(path.join(root, "data/processed/trials.csv"), "utf-8")).map((t) => [
    t.nct_id,
    t.eligibility_text,
  ]),
);
const expected = new Map<string, string[]>();
for (const row of parseCsv(fs.readFileSync(path.join(root, "data/processed/exclusions.csv"), "utf-8"))) {
  const key = [row.category, row.threshold, row.absolute, row.section, row.source_text].join(" | ");
  expected.set(row.nct_id, [...(expected.get(row.nct_id) ?? []), key]);
}

let trials = 0;
let mismatched = 0;
for (const file of fs.readdirSync(path.join(root, "data/cache")).filter((f) => f.endsWith(".json"))) {
  const cached = JSON.parse(fs.readFileSync(path.join(root, "data/cache", file), "utf-8")) as {
    nct_id: string;
    exclusions: RawRecord[];
  };
  const text = texts.get(cached.nct_id);
  if (text === undefined) continue;
  trials++;
  const got = cleanRecords(cached.exclusions, text)
    .map((r) => [r.category, r.threshold ?? "", String(r.absolute), r.section, r.source_text].join(" | "))
    .sort();
  const want = (expected.get(cached.nct_id) ?? []).sort();
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    mismatched++;
    if (mismatched <= 5) console.log(cached.nct_id, { got, want });
  }
}
console.log(`${trials} trials checked, ${mismatched} differ from exclusions.csv`);
process.exitCode = mismatched ? 1 : 0;
