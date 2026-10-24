// Regenerates src/data/ma-towns.json ({town: county}) from P1's crosswalk.
// Run from accounts/: npm run towns
// The app keeps its own copy because Vercel only deploys the accounts/ folder.
import { readFileSync, writeFileSync } from "node:fs";

const csv = readFileSync(new URL("../../data/processed/ma_town_county.csv", import.meta.url), "utf8");
const [header, ...rows] = csv.trim().split(/\r?\n/);
if (header !== "town,county,county_fips") throw new Error(`Unexpected columns: ${header}`);

const towns = Object.fromEntries(rows.map((row) => row.split(",").slice(0, 2)));
writeFileSync(new URL("../src/data/ma-towns.json", import.meta.url), JSON.stringify(towns, null, 1) + "\n");
console.log(`Wrote ${Object.keys(towns).length} towns`);
