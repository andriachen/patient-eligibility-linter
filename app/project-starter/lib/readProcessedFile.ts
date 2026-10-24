import fs from "fs";
import path from "path";

const PROCESSED_DIR = path.join(process.cwd(), "..", "..", "data", "processed");

export function processedFilePath(filename: string): string {
  return path.join(PROCESSED_DIR, filename);
}

export function readProcessedText(filename: string): string | null {
  const fullPath = processedFilePath(filename);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, "utf-8");
}

/** Minimal CSV parse: first row = headers, comma-separated (no quoted commas). */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return [];
  }
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? "";
    });
    return row;
  });
}
