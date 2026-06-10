/**
 * Server-side Supabase client.
 * Import this in server actions and server components only. There is NO
 * client-side database access in this app (the browser bundle never contains
 * the Supabase key — verified), so every query goes through here.
 *
 * v1: uses the anon key directly (no auth/cookies). The data is kept private by
 * the app-level password gate (`proxy.ts`) plus the key never being published.
 * If we ever want defense-in-depth, enable RLS and switch this to a service_role
 * key — see docs/DEPLOY.md. Post-v1, swap to Supabase Auth + `auth.uid()` RLS.
 */

import { createClient } from "@supabase/supabase-js";

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Check your .env.local file.",
    );
  }

  return createClient(url, key);
}
