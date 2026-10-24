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

/** Split CSV text into rows of cells. Handles quoted fields with commas, "" and newlines. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** CSV parse: first row = headers. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text.replace(/^﻿/, ""));
  if (rows.length < 2) {
    return [];
  }
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = (cells[i] ?? "").trim();
    });
    return row;
  });
}
