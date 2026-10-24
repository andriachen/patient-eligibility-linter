"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

const MIN_PASSWORD = 6; // Supabase's default minimum

/** Log in or sign up, depending on the form's "mode" field. Redirects to /profile on success. */
export async function authenticate(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const mode = formData.get("mode") === "signup" ? "signup" : "login";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < MIN_PASSWORD) {
    return { error: `Enter your email and a password of at least ${MIN_PASSWORD} characters.` };
  }

  const supabase = await createClient();
  if (mode === "login") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    // "Confirm email" is still on in the Supabase project.
    if (!data.session) return { message: "Check your inbox to confirm your email, then log in." };
  }

  revalidatePath("/", "layout");
  redirect("/profile");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
