/**
 * Database query functions for the `rounds` table.
 * Call these from server components (app/**) and server actions only.
 * Never import this file from components/ — use actions/ for mutations.
 */

import { z } from "zod";
import { unstable_cache } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { withRetry } from "@/lib/supabase/retry";
import { RoundRowSchema, type RoundRow } from "@/lib/schemas/round";
import { getDataScopeUserId, userDataTag } from "@/lib/auth/scope";

const RoundRowsSchema = z.array(RoundRowSchema);

/**
 * Fetch a single round by ID. Returns null if not found.
 * Throws on unexpected DB errors.
 */
export async function getRound(id: string): Promise<RoundRow | null> {
  const supabase = createServerClient();
  const userId = await getDataScopeUserId();

  // Scope by user_id too: a round only resolves within the caller's scope, so a
  // visitor can't load the owner's round by id (and vice-versa).
  const { data, error } = await withRetry(() =>
    supabase.from("rounds").select("*").eq("id", id).eq("user_id", userId).single(),
  );

  if (error) {
    // PGRST116 = no rows returned by .single()
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch round: ${error.message}`);
  }

  return RoundRowSchema.parse(data);
}

/**
 * Fetch all rounds for the v1 user, newest first. Used by the dashboard (for
 * round-level dates) and the round browser.
 *
 * Throws on DB or validation error.
 */
export async function getAllRounds(): Promise<RoundRow[]> {
  // Scope (cookie read) resolved outside the cache; user_id keys the entry so
  // owner and sandbox visitors never share a cache entry. See getAllShots.
  const userId = await getDataScopeUserId();
  return getAllRoundsCached(userId);
}

/**
 * Cached body of getAllRounds, keyed by scope `user_id`. Busted via
 * `userDataTag(userId)` from the round write actions (create/delete) and the
 * sandbox seed; the 60s revalidate backstops out-of-band writes.
 */
function getAllRoundsCached(userId: string): Promise<RoundRow[]> {
  return unstable_cache(
    async () => {
      const supabase = createServerClient();
      const { data, error } = await withRetry(() =>
        supabase
          .from("rounds")
          .select("*")
          .eq("user_id", userId)
          .order("date", { ascending: false }),
      );

      if (error) {
        throw new Error(`Failed to fetch rounds: ${error.message}`);
      }

      return RoundRowsSchema.parse(data);
    },
    ["all-rounds", userId],
    { tags: [userDataTag(userId)], revalidate: 60 },
  )();
}
