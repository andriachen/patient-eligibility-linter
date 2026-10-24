// What the user has typed or ticked on the current screen, before it becomes an answer.

import {
  type AnswerValue,
  type Body,
  type Home,
  OUTSIDE_MA,
  type Question,
  TOWN_COUNTIES,
  bmi,
  homeFor,
} from "@/lib/questions";

export type BodyDraft = { feet: string; inches: string; weight: string };
export type TownDraft = { query: string; selected: string | null };
export type Draft = string | number | string[] | TownDraft | BodyDraft | undefined;

export function toDraft(q: Question, value: AnswerValue | undefined): Draft {
  switch (q.kind) {
    case "multi":
      return Array.isArray(value) ? value : [];
    case "number":
      return typeof value === "number" ? String(value) : "";
    case "text":
      return typeof value === "string" ? value : "";
    case "town": {
      const town = (value as Home | undefined)?.town ?? null;
      return { query: town ?? "", selected: town };
    }
    case "body": {
      const body = value as Body | undefined;
      if (!body) return { feet: "", inches: "", weight: "" };
      return {
        feet: String(Math.floor(body.height_in / 12)),
        inches: String(body.height_in % 12),
        weight: String(body.weight_lb),
      };
    }
    default:
      return value as string | number | undefined;
  }
}

/** Turn a draft into the answer to save, or an error to show. */
export function fromDraft(q: Question, draft: Draft): { value?: AnswerValue; error?: string } {
  switch (q.kind) {
    case "number": {
      const text = (draft as string).trim();
      if (!text) return {};
      const n = Number(text);
      return Number.isFinite(n) ? { value: n } : { error: "Enter a number." };
    }
    case "text": {
      const text = (draft as string).trim();
      return text ? { value: text } : {};
    }
    case "town": {
      const { query, selected } = draft as TownDraft;
      if (selected) return { value: homeFor(selected) };
      if (!query.trim()) return {};
      const match = findTown(query);
      return match ? { value: homeFor(match) } : { error: "Pick your town from the list." };
    }
    case "body": {
      const { feet, inches, weight } = draft as BodyDraft;
      if (!feet && !inches && !weight) return {};
      const [ft, inch, lb] = [Number(feet), Number(inches || 0), Number(weight)];
      if (!feet || !weight) return { error: "Enter both height and weight, or skip this question." };
      if (!(ft >= 3 && ft <= 8 && inch >= 0 && inch <= 11 && lb >= 50 && lb <= 700)) {
        return { error: "Check the numbers: height 3 to 8 ft, 0 to 11 in, weight 50 to 700 lb." };
      }
      const heightIn = Math.round(ft) * 12 + Math.round(inch);
      return { value: { height_in: heightIn, weight_lb: Math.round(lb), bmi: bmi(heightIn, Math.round(lb)) } };
    }
    default:
      return { value: draft as AnswerValue | undefined };
  }
}

const TOWNS = Object.keys(TOWN_COUNTIES).sort();

/** Exact (case-insensitive) town name, including "Outside Massachusetts". */
export function findTown(query: string): string | null {
  const q = query.trim().toLowerCase();
  return [...TOWNS, OUTSIDE_MA].find((t) => t.toLowerCase() === q) ?? null;
}

/** Towns starting with the query first, then towns containing it. */
export function searchTowns(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = TOWNS.filter((t) => t.toLowerCase().startsWith(q));
  const contains = TOWNS.filter((t) => !t.toLowerCase().startsWith(q) && t.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit);
}

/** Tick or untick an option. "None of these" can't be ticked alongside anything else. */
export function toggleOption(selected: string[], value: string): string[] {
  if (selected.includes(value)) return selected.filter((v) => v !== value);
  if (value === "none") return ["none"];
  return [...selected.filter((v) => v !== "none"), value];
}
