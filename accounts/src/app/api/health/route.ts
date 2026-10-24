import { RAW_SUPABASE_ANON_KEY, RAW_SUPABASE_URL } from "@/lib/supabase/env";
import { checkSupabase } from "@/lib/supabase/health";

/**
 * GET /account/api/health: whether this deployment's Supabase settings work.
 * Never returns the key itself, only its type, project and shape.
 */
export async function GET() {
  const report = await checkSupabase(RAW_SUPABASE_URL, RAW_SUPABASE_ANON_KEY);
  return Response.json(report, {
    status: report.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
