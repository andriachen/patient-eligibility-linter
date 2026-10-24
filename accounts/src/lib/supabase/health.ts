// Describes this deployment's Supabase settings without revealing the key, and asks
// Supabase whether it accepts them. Backs GET /account/api/health.

import { cleanEnvValue } from "./env";

export type KeyInfo = {
  kind: "legacy-jwt" | "publishable" | "secret" | "missing" | "unknown";
  length: number;
  hasWhitespace: boolean;
  hasQuotes: boolean;
  hasVariableName: boolean; // the value itself starts with "SOME_NAME=", e.g. a pasted .env line
  partLengths?: number[]; // JWT header, payload and signature lengths (a valid anon key is about 36/127/43)
  projectRef?: string; // legacy JWT keys name their project
  role?: string;
};

export type UrlInfo = {
  valid: boolean;
  host?: string;
  projectRef?: string;
  hasWhitespace: boolean;
  hasQuotes: boolean;
  hasVariableName: boolean;
};

export type HealthReport = {
  ok: boolean;
  problems: string[]; // stop the app from working
  warnings: string[]; // worked around by cleanEnvValue, but worth fixing at the source
  url: UrlInfo;
  key: KeyInfo;
  supabase: { status: number | null; message?: string };
};

const QUOTED = /^["']|["']$/;
const VARIABLE_NAME = /^[A-Z][A-Z0-9_]*=/;

export function describeKey(key: string | undefined): KeyInfo {
  const value = key ?? "";
  const info: KeyInfo = {
    kind: "unknown",
    length: value.length,
    hasWhitespace: /\s/.test(value),
    hasQuotes: QUOTED.test(value),
    hasVariableName: VARIABLE_NAME.test(value.trim()),
  };
  const bare = value.trim().replace(VARIABLE_NAME, "").replace(/^["']|["']$/g, "");
  if (!bare) return { ...info, kind: "missing" };
  if (bare.startsWith("sb_publishable_")) return { ...info, kind: "publishable" };
  if (bare.startsWith("sb_secret_")) return { ...info, kind: "secret" };
  const parts = bare.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      return {
        ...info,
        kind: "legacy-jwt",
        partLengths: parts.map((p) => p.length),
        projectRef: payload.ref,
        role: payload.role,
      };
    } catch {
      // Three dot-separated parts but not a JWT: leave it as "unknown".
    }
  }
  return info;
}

export function describeUrl(url: string | undefined): UrlInfo {
  const value = url ?? "";
  const info: UrlInfo = {
    valid: false,
    hasWhitespace: /\s/.test(value),
    hasQuotes: QUOTED.test(value),
    hasVariableName: VARIABLE_NAME.test(value.trim()),
  };
  try {
    const { protocol, host } = new URL(value);
    if (protocol !== "https:" && protocol !== "http:") return info;
    const projectRef = host.endsWith(".supabase.co") ? host.split(".")[0] : undefined;
    return { ...info, valid: true, host, projectRef };
  } catch {
    return info;
  }
}

/**
 * Check the URL and key the app was built with (as set, before cleaning), then ask
 * Supabase whether it accepts the cleaned values the app actually uses.
 */
export async function checkSupabase(rawUrl: string | undefined, rawKey: string | undefined): Promise<HealthReport> {
  const url = cleanEnvValue(rawUrl);
  const key = cleanEnvValue(rawKey);
  const urlInfo = { ...describeUrl(url), ...pasteFlags(rawUrl) };
  const keyInfo = { ...describeKey(key), ...pasteFlags(rawKey), length: rawKey?.length ?? 0 };
  const problems: string[] = [];
  const warnings: string[] = [];

  if (!urlInfo.valid) problems.push("NEXT_PUBLIC_SUPABASE_URL is missing or isn't a URL.");
  if (keyInfo.kind === "missing") problems.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.");
  if (urlInfo.hasWhitespace || urlInfo.hasQuotes || keyInfo.hasWhitespace || keyInfo.hasQuotes) {
    warnings.push("A value has spaces, line breaks or quotes in it. The app strips them, but paste the bare value.");
  }
  if (urlInfo.hasVariableName || keyInfo.hasVariableName) {
    warnings.push(
      "A value starts with its variable name (like NEXT_PUBLIC_SUPABASE_ANON_KEY=...). The app strips it, " +
        "but set the value to only the part after the =.",
    );
  }
  if (keyInfo.kind === "secret" || keyInfo.role === "service_role") {
    problems.push("The key is a secret (service_role) key. Use the anon / publishable key.");
  }
  if (keyInfo.projectRef && urlInfo.projectRef && keyInfo.projectRef !== urlInfo.projectRef) {
    problems.push(`The key belongs to project ${keyInfo.projectRef}, but the URL points to ${urlInfo.projectRef}.`);
  }

  let supabase: HealthReport["supabase"] = { status: null };
  if (urlInfo.valid && keyInfo.kind !== "missing") {
    try {
      const res = await fetch(new URL("/auth/v1/settings", url), {
        headers: { apikey: key as string },
        cache: "no-store",
      });
      const body = res.ok ? null : await res.json().catch(() => null);
      supabase = { status: res.status, message: body?.message };
      if (!res.ok) problems.push(`Supabase rejected these settings (${res.status}${body?.message ? `: ${body.message}` : ""}).`);
    } catch (error) {
      supabase = { status: null, message: (error as Error).message };
      problems.push(`Couldn't reach Supabase: ${(error as Error).message}`);
    }
  }

  return { ok: problems.length === 0, problems, warnings, url: urlInfo, key: keyInfo, supabase };
}

/** How the value was pasted, judged on the raw value before cleaning. */
function pasteFlags(raw: string | undefined) {
  const value = raw ?? "";
  return {
    hasWhitespace: /\s/.test(value),
    hasQuotes: QUOTED.test(value.trim()),
    hasVariableName: VARIABLE_NAME.test(value.trim()),
  };
}
