"use client";

import { useSyncExternalStore } from "react";

/**
 * The accounts app (Supabase SSR) stores its session in `sb-<project>-auth-token`
 * cookies on path "/", so they are visible to this app on the same host. This only
 * checks that a session cookie exists: use it for showing Log in vs Account, never
 * for access decisions.
 */
const SESSION_COOKIE = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=[^;]+/;

function readSignedIn() {
  return SESSION_COOKIE.test(document.cookie);
}

function subscribe(onChange: () => void) {
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/** true / false once known in the browser; null during server render and hydration. */
export function useAccountSession(): boolean | null {
  return useSyncExternalStore(subscribe, readSignedIn, () => null);
}
