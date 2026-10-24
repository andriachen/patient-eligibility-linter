"use server";

import { getCurrentUser } from "@/lib/auth";
import { type Answers, ROLES, type Role } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import { finalAnswers } from "@/lib/wizard";

export type SaveResult = { error?: string };

const MAX_ANSWERS_LENGTH = 20_000;

/** Upsert the signed-in user's profile. Called after every question and on the final save. */
export async function saveProfile(answers: Answers, completed: boolean): Promise<SaveResult> {
  // Re-check the session here: a Server Action is a public endpoint.
  const user = await getCurrentUser();
  if (!user) return { error: "You've been logged out. Log in again to keep saving." };
  if (!ROLES.includes(answers?.role as Role)) return { error: "Answer the first question before saving." };
  if (JSON.stringify(answers).length > MAX_ANSWERS_LENGTH) return { error: "That's more text than we can save." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      role: answers.role,
      answers: completed ? finalAnswers(answers) : answers,
      completed,
    },
    { onConflict: "user_id" },
  );
  return error ? { error: error.message } : {};
}
