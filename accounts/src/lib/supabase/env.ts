// Read directly so Next.js can inline them at build time. Set in .env.local (see .env.example)
// and in the Vercel project's environment variables.
export const RAW_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const RAW_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Strip what sneaks in when a value is pasted into a dashboard: a whole .env line
 * ("NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ..."), quotes, or spaces. A real URL or key never
 * starts with "NAME=", so this can't damage a correct value. /api/health still warns.
 */
export function cleanEnvValue(value: string | undefined): string | undefined {
  const cleaned = value
    ?.trim()
    .replace(/^[A-Z][A-Z0-9_]*=/, "")
    .replace(/^["']|["']$/g, "")
    .trim();
  return cleaned || undefined;
}

export const SUPABASE_URL = cleanEnvValue(RAW_SUPABASE_URL)!;
export const SUPABASE_ANON_KEY = cleanEnvValue(RAW_SUPABASE_ANON_KEY)!;
