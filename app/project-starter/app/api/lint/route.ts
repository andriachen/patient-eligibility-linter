// Live Linter: sends pasted criteria to Claude with the pipeline's extraction prompt,
// then applies the pipeline's checks (verbatim quote, noise guards, one row per
// category) so a draft is read exactly like the 1,011 trials behind Landscape and Map.
// Without ANTHROPIC_API_KEY it answers 503 and the Linter falls back to keyword rules.

import { createHash } from "crypto";

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { cleanRecords, normalize, type RawRecord } from "@/lib/extraction/logic";
import { CATEGORIES, EXTRACT_TOOL, PROMPT_VERSION, SYSTEM_PROMPT } from "@/lib/extraction/prompt";
import { SUGGESTIONS, type LintFlag } from "@/lib/mockLint";

export const runtime = "nodejs";
export const maxDuration = 60;
// Everything (retries included) must finish before the function limit, so a slow or
// rate-limited model still gets a JSON "busy" answer instead of a platform timeout.
const DEADLINE_MS = 50_000;

// Same default as pipeline/extract/llm.py, so live flags match the measured extraction.
const MODEL = process.env.LINT_MODEL || process.env.P2_MODEL || "claude-haiku-5-5";
const MAX_TOKENS = 4096;
// The longest recruiting MA trial's criteria are about 20,000 characters.
const MAX_CHARS = 25_000;
// A long text with no restrictions at all is usually a misread; the pipeline retries once.
const LONG_CRITERIA_CHARS = 3000;
const RATE_LIMIT = { requests: 30, windowMs: 10 * 60_000 };

export type LintApiResponse = {
  engine: "model";
  model: string;
  promptVersion: string;
  flags: LintFlag[];
};

type LintApiError = { error: "not_configured" | "too_long" | "empty" | "rate_limited" | "busy" | "failed" };

const VALID = new Set<string>(CATEGORIES);

/** The key as pasted into a dashboard can carry its own name or quotes; keep only the value. */
function apiKey(): string | null {
  const raw = (process.env.ANTHROPIC_API_KEY ?? "").trim().replace(/^ANTHROPIC_API_KEY\s*=\s*/, "");
  const key = raw.replace(/^["']|["']$/g, "").trim();
  return key || null;
}

let client: Anthropic | null = null;
function getClient(key: string) {
  client ??= new Anthropic({ apiKey: key, timeout: 25_000, maxRetries: 1 });
  return client;
}

// Best-effort, per server instance: repeat runs of the same text are instant and free,
// and one visitor can't run up the bill.
const cache = new Map<string, LintApiResponse>();
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT.requests;
}

/** Pull the records out of the forced tool call (the model sometimes sends the array as a JSON string). */
function toolRecords(message: Anthropic.Message): RawRecord[] {
  const block = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!block) return [];
  let items = (block.input as { exclusions?: unknown }).exclusions;
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(items)) return [];
  return items.filter(
    (it): it is RawRecord => typeof it === "object" && it !== null && VALID.has((it as RawRecord).category),
  );
}

async function extract(key: string, text: string, signal: AbortSignal): Promise<RawRecord[]> {
  for (let attempt = 0; ; attempt++) {
    const message = await getClient(key).messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: [EXTRACT_TOOL],
        tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
        messages: [{ role: "user", content: text }],
      },
      { signal },
    );
    if (message.stop_reason === "refusal") throw new Error("refusal");
    const records = toolRecords(message);
    if (records.length || text.length < LONG_CRITERIA_CHARS || attempt > 0 || signal.aborted) return records;
  }
}

const fail = (error: LintApiError["error"], status: number) => NextResponse.json<LintApiError>({ error }, { status });

/** Whether the live model is available, so the page can say which engine it will use. */
export function GET() {
  return NextResponse.json({ configured: apiKey() !== null, model: MODEL, promptVersion: PROMPT_VERSION });
}

export async function POST(request: Request) {
  const key = apiKey();
  if (!key) return fail("not_configured", 503);

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text : "";
  if (!text.trim()) return fail("empty", 400);
  if (text.length > MAX_CHARS) return fail("too_long", 413);

  const cacheKey = createHash("sha256").update(`${MODEL}\n${PROMPT_VERSION}\n${text}`).digest("hex");
  const cached = cache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return fail("rate_limited", 429);

  let records: ReturnType<typeof cleanRecords>;
  try {
    records = cleanRecords(await extract(key, text, AbortSignal.timeout(DEADLINE_MS)), text);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return fail("not_configured", 503);
    }
    if (
      error instanceof Anthropic.RateLimitError ||
      error instanceof Anthropic.InternalServerError ||
      error instanceof Anthropic.APIConnectionTimeoutError ||
      error instanceof Anthropic.APIUserAbortError
    ) {
      return fail("busy", 503);
    }
    console.error("[api/lint]", error);
    return fail("failed", 502);
  }

  // Show flags in the order their sentences appear in the draft.
  const folded = normalize(text);
  records.sort((a, b) => folded.indexOf(normalize(a.source_text)) - folded.indexOf(normalize(b.source_text)));

  const response: LintApiResponse = {
    engine: "model",
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    flags: records.map((r) => {
      const [suggestion, suggestion_source] = SUGGESTIONS[r.category];
      return {
        category: r.category,
        threshold: r.threshold ?? "",
        absolute: r.absolute,
        section: r.section === "inclusion" ? "inclusion" : "exclusion",
        source_text: r.source_text,
        suggestion,
        suggestion_source,
      };
    }),
  };
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, response);
  return NextResponse.json(response);
}
