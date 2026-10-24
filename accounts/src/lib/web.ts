// The Threshold web app (app/project-starter). On Vercel it shares this domain at "/";
// in `npm run dev` it's a separate server on port 3010 (override with NEXT_PUBLIC_WEB_URL).
// Link to it with a plain <a>: next/link would put this app's /account base path in front.
const WEB_URL = (
  process.env.NEXT_PUBLIC_WEB_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3010" : "")
)
  .trim()
  .replace(/\/$/, "");

export const webHref = (path = "/") => `${WEB_URL}${path}`;
