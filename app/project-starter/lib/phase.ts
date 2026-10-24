/** ClinicalTrials.gov phase codes for people: "PHASE1;PHASE2" -> "Phase 1/2", "EARLY_PHASE1" -> "Early phase 1", "NA" -> "". */
export function formatPhase(raw: string): string {
  const parts = raw
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p && p.toUpperCase() !== "NA");
  if (!parts.length) return "";
  const early = parts.every((p) => /^EARLY_PHASE\d$/i.test(p));
  const nums = parts.map((p) => p.replace(/^(?:EARLY_)?PHASE/i, "").replace(/_/g, " ").trim());
  return `${early ? "Early phase" : "Phase"} ${nums.join("/")}`;
}
