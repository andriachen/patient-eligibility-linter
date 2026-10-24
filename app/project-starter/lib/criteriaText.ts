// Helpers for ClinicalTrials.gov eligibility text, which arrives with HTML entities
// ("&gt;") and Markdown escapes ("\>", "\[") that make quotes hard to read and search.

/** Decode entities first, then drop backslashes before punctuation (the order matters). */
export function normalizeCriteria(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\\([^\w\s])/g, "$1");
}

export type QuoteSpan = { start: number; end: number };

/**
 * Where a quote sits in the normalized text. Tries an exact match, then a match that
 * ignores case and runs of whitespace (the extractor sometimes reflows lines).
 */
export function locateQuote(text: string, quote: string): QuoteSpan | null {
  const q = normalizeCriteria(quote).trim();
  if (!q) return null;
  const exact = text.indexOf(q);
  if (exact !== -1) return { start: exact, end: exact + q.length };

  // Folded copy of the text, remembering where each folded character came from.
  let folded = "";
  const origin: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (folded.endsWith(" ")) continue;
      folded += " ";
    } else {
      folded += ch.toLowerCase();
    }
    origin.push(i);
  }
  const fq = q.replace(/\s+/g, " ").toLowerCase();
  const at = folded.indexOf(fq);
  if (at === -1) return null;
  return { start: origin[at], end: origin[at + fq.length - 1] + 1 };
}
