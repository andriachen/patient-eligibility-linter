"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";

import { button, card, input } from "@/components/styles";

import { type AuthState, authenticate } from "./actions";

type Mode = "login" | "signup";

export function LoginForm({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [state, formAction, pending] = useActionState<AuthState, FormData>(authenticate, {});
  const signup = mode === "signup";

  return (
    <div className={`${card} mx-auto max-w-md`}>
      <h1 className="text-2xl font-semibold tracking-tight">{signup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-1 text-sm text-muted">
        {signup ? "Your answers are saved to your account." : "Log in to pick up where you left off."}
      </p>

      <div role="group" aria-label="Log in or sign up" className="mt-6 grid grid-cols-2 rounded-lg bg-background p-1">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md py-2 text-sm font-medium transition ${
              mode === m ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            {m === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="mode" value={mode} />
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={6}
            required
            className={input}
          />
          {signup && <p className="mt-1.5 text-xs text-muted">At least 6 characters.</p>}
        </div>

        {state.error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
            {state.message}
          </p>
        )}

        <button type="submit" disabled={pending} className={`${button.primary} w-full`}>
          {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {signup ? "Create account" : "Log in"}
        </button>
      </form>
    </div>
  );
}
