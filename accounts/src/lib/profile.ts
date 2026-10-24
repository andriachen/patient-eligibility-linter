import { createClient } from "@/lib/supabase/server";
import type { SavedProfile } from "@/lib/wizard";

/** The user's row in public.profiles (see schema.sql), or null if they haven't started. */
export async function getProfile(userId: string): Promise<SavedProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("answers, completed")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
