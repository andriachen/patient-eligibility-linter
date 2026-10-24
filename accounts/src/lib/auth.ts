import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type User = { id: string; email: string };

/** The signed-in user, or null. Checks the token, so it's safe to use for access decisions. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});
