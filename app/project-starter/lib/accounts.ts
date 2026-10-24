/**
 * Base URL of the accounts app (accounts/). On Vercel it shares our domain at
 * /account (see root vercel.json). Locally it runs as a separate server, so set
 * NEXT_PUBLIC_ACCOUNTS_URL=http://localhost:3000/account in .env.local.
 */
export const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL ?? "/account";

export const LOGIN_URL = `${ACCOUNTS_URL}/login`;
