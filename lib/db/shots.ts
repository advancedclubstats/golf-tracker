/**
 * Database query functions for the `shots` table (reads).
 *
 * Call these from Server Components and server actions only. Reads live in
 * `lib/db/` (mutations live in `actions/`). Never import this file from a
 * client component.
 */

import { z } from "zod";
import { unstable_cache } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { withRetry } from "@/lib/supabase/retry";
import { ShotRowSchema, type ShotRow } from "@/lib/schemas/shot";
import { getDataScopeUserId, userDataTag } from "@/lib/auth/scope";
import { V1_USER_ID } from "@/lib/constants";

const ShotRowsSchema = z.array(ShotRowSchema);

/**
 * Total shots the OWNER has logged — always `V1_USER_ID`, regardless of the
 * caller's scope. Used by the welcome splash credential ("N shots logged from
 * memory"), which is a fact about Matt's real usage, not the visitor's mutable
 * sandbox. A head-only `count` (no rows fetched). Returns 0 on error so the
 * chip degrades silently rather than breaking the landing.
 */
export async function getOwnerShotCount(): Promise<number> {
  try {
    const supabase = createServerClient();
    // head + count: a row-count only, no rows fetched. Not wrapped in withRetry
    // (it surfaces `count`, which the wrapper's typed result doesn't) — this is
    // a cosmetic credential, so any failure just hides the chip.
    const { count, error } = await supabase
      .from("shots")
      .select("*", { count: "exact", head: true })
      .eq("user_id", V1_USER_ID);
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Fetch every shot for the v1 user, ordered for determinism
 * (round → hole → shot number). The analytics layer re-groups and re-sorts as
 * needed, so callers can pass the result straight to `lib/analytics/`.
 *
 * Throws on DB or validation error — never returns a partial/silent result.
 */
export async function getAllShots(): Promise<ShotRow[]> {
  // Resolve the scope (reads cookies) OUTSIDE the cache, then hand the plain
  // user_id to the cached body — unstable_cache can't read cookies/headers. The
  // user_id is part of the cache key, so owner and each sandbox stay isolated.
  const userId = await getDataScopeUserId();
  return getAllShotsCached(userId);
}

/**
 * Cached body of getAllShots, keyed by scope `user_id`. The shots table is read
 * on every analytics page; the rows only change when this scope writes a shot,
 * so we cache and bust via `userDataTag(userId)` from the shot write actions.
 * The 60s revalidate is a backstop for out-of-band writes (the direct-DB sheet
 * import, which can't call revalidateTag) — app writes refresh instantly.
 */
function getAllShotsCached(userId: string): Promise<ShotRow[]> {
  return unstable_cache(
    async () => {
      const supabase = createServerClient();
      const { data, error } = await withRetry(() =>
        supabase
          .from("shots")
          .select("*")
          .eq("user_id", userId)
          .order("round_id", { ascending: true })
          .order("hole", { ascending: true })
          .order("shot_no", { ascending: true }),
      );

      if (error) {
        throw new Error(`Failed to fetch shots: ${error.message}`);
      }

      return ShotRowsSchema.parse(data);
    },
    ["all-shots", userId],
    { tags: [userDataTag(userId)], revalidate: 60 },
  )();
}

/**
 * Fetch all shots for a single round, ordered hole → shot number.
 * Throws on DB or validation error.
 */
export async function getShotsByRound(roundId: string): Promise<ShotRow[]> {
  const supabase = createServerClient();
  const userId = await getDataScopeUserId();

  const { data, error } = await withRetry(() =>
    supabase
      .from("shots")
      .select("*")
      .eq("round_id", roundId)
      .eq("user_id", userId)
      .order("hole", { ascending: true })
      .order("shot_no", { ascending: true }),
  );

  if (error) {
    throw new Error(`Failed to fetch shots for round: ${error.message}`);
  }

  return ShotRowsSchema.parse(data);
}
