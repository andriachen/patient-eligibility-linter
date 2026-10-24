// Read directly so Next.js can inline them at build time. Set in .env.local (see .env.example)
// and in the Vercel project's environment variables.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
