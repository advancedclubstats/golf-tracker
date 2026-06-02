/**
 * Browser-side Supabase client.
 * Import this in client components that need to read from Supabase directly.
 *
 * In v1, mutations always go through server actions in actions/ — the browser
 * client is here for future use (e.g. real-time subscriptions post-v1).
 */

import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;

export function createBrowserClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  client = createClient(url, key);
  return client;
}
