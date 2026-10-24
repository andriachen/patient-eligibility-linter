/**
 * Base URL of the accounts app (accounts/). On Vercel it shares our domain at
 * /account (see root vercel.json). Locally it runs as a separate server on port 3000
 * (accounts' `npm run dev`); NEXT_PUBLIC_ACCOUNTS_URL overrides either default.
 */
export const ACCOUNTS_URL =
  process.env.NEXT_PUBLIC_ACCOUNTS_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:3000/account" : "/account");

export const LOGIN_URL = `${ACCOUNTS_URL}/login`;
