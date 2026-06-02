/**
 * Server-side Supabase client.
 * Import this in server actions and server components only — never in client components.
 *
 * v1: uses the anon key directly (no auth/cookies). Post-v1, swap to
 * createServerClient from @supabase/ssr with cookie handling.
 */

import { createClient } from "@supabase/supabase-js";

export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Check your .env.local file."
    );
  }

  return createClient(url, key);
}
