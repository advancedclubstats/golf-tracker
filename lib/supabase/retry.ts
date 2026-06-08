/**
 * Retry wrapper for Supabase reads.
 *
 * Why this exists: a server action re-renders the current route's server
 * components when it completes. The shot-entry log page is `force-dynamic`, so
 * that re-render re-runs its DB reads on every save. A single transient blip
 * during that refetch (connection-pool exhaustion, free-tier cold start, a
 * dropped mobile request) used to throw an uncaught error mid-render, which
 * surfaced as the raw "An error occurred in the Server Components render"
 * overlay — even though the shot itself had already saved. Wrapping reads in a
 * short retry lets those blips self-heal before they ever reach a throw.
 *
 * Only transient failures are retried; logical errors (missing row, constraint
 * violation, bad query) are returned immediately so callers handle them as they
 * always have.
 */

import type { PostgrestError } from "@supabase/supabase-js";

/** Postgres / PostgREST error codes that are worth retrying. */
const TRANSIENT_CODES = new Set([
  "PGRST002", // PostgREST schema cache not loaded yet (server starting up)
  "08000", // connection_exception
  "08001", // sqlclient_unable_to_establish_sqlconnection
  "08003", // connection_does_not_exist
  "08004", // sqlserver_rejected_establishment_of_sqlconnection
  "08006", // connection_failure
  "53300", // too_many_connections
  "57P01", // admin_shutdown
  "57P03", // cannot_connect_now
  "XX000", // internal_error (commonly transient under load)
]);

const TRANSIENT_MESSAGE =
  /fetch failed|network|timeout|timed out|econn|socket hang up|temporarily|503|502|504/i;

function isTransient(error: PostgrestError | null): boolean {
  if (!error) return false;
  if (error.code && TRANSIENT_CODES.has(error.code)) return true;
  // supabase-js surfaces fetch/network failures as a PostgrestError with no
  // (or an empty) code — treat those as transient and retry.
  if (!error.code) return true;
  return TRANSIENT_MESSAGE.test(error.message ?? "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RetryOptions {
  /** Total attempts, including the first. */
  tries?: number;
  /** Base delay; backs off exponentially (150, 300, …). */
  baseDelayMs?: number;
}

/**
 * Run a Supabase query thunk, retrying on transient failures with exponential
 * backoff. Returns the final `{ data, error }` so callers keep their existing
 * error handling (the descriptive throw, the PGRST116 → null check, etc).
 */
export async function withRetry<T>(
  run: () => PromiseLike<{ data: T; error: PostgrestError | null }>,
  { tries = 3, baseDelayMs = 150 }: RetryOptions = {},
): Promise<{ data: T; error: PostgrestError | null }> {
  let result!: { data: T; error: PostgrestError | null };

  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      result = await run();
    } catch (e) {
      // The query layer normally returns errors rather than throwing, but a
      // hard fetch failure can throw — treat it as transient.
      if (attempt === tries) throw e;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
      continue;
    }

    if (!isTransient(result.error) || attempt === tries) return result;
    await sleep(baseDelayMs * 2 ** (attempt - 1));
  }

  return result;
}
