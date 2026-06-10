/**
 * Server-side Supabase client.
 * Import this in server actions and server components only — never in client
 * components. (There is no client-side DB access in this app.)
 *
 * Key choice (security): prefers the **service_role** key, which bypasses Row
 * Level Security. With RLS enabled on every table (deny-all for the public anon
 * key), this is what lets the server still read/write while the anon key — the
 * only key shipped to the browser — can touch nothing. The service_role key is a
 * secret: it must NEVER be `NEXT_PUBLIC_*` and never reaches the client bundle.
 *
 * Falls back to the anon key when `SUPABASE_SERVICE_ROLE_KEY` is unset, so local
 * dev keeps working before the key is configured. NOTE: once RLS is enabled, the
 * anon fallback will be denied — set `SUPABASE_SERVICE_ROLE_KEY` in every
 * environment (`.env.local` and Vercel). See docs/DEPLOY.md.
 *
 * v1: no auth/cookies (single hardcoded user). Post-v1, swap to Supabase Auth +
 * `auth.uid()` RLS policies and drop the service_role usage.
 */

import { createClient } from "@supabase/supabase-js";

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase key " +
        "(SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY as fallback). " +
        "Check your .env.local file.",
    );
  }

  // Server-only client: no session persistence / token refresh needed.
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
