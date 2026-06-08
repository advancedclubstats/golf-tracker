/**
 * Database query functions for the `shots` table (reads).
 *
 * Call these from Server Components and server actions only. Reads live in
 * `lib/db/` (mutations live in `actions/`). Never import this file from a
 * client component.
 */

import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { withRetry } from "@/lib/supabase/retry";
import { ShotRowSchema, type ShotRow } from "@/lib/schemas/shot";
import { V1_USER_ID } from "@/lib/constants";

const ShotRowsSchema = z.array(ShotRowSchema);

/**
 * Fetch every shot for the v1 user, ordered for determinism
 * (round → hole → shot number). The analytics layer re-groups and re-sorts as
 * needed, so callers can pass the result straight to `lib/analytics/`.
 *
 * Throws on DB or validation error — never returns a partial/silent result.
 */
export async function getAllShots(): Promise<ShotRow[]> {
  const supabase = createServerClient();

  const { data, error } = await withRetry(() =>
    supabase
      .from("shots")
      .select("*")
      .eq("user_id", V1_USER_ID)
      .order("round_id", { ascending: true })
      .order("hole", { ascending: true })
      .order("shot_no", { ascending: true }),
  );

  if (error) {
    throw new Error(`Failed to fetch shots: ${error.message}`);
  }

  return ShotRowsSchema.parse(data);
}

/**
 * Fetch all shots for a single round, ordered hole → shot number.
 * Throws on DB or validation error.
 */
export async function getShotsByRound(roundId: string): Promise<ShotRow[]> {
  const supabase = createServerClient();

  const { data, error } = await withRetry(() =>
    supabase
      .from("shots")
      .select("*")
      .eq("round_id", roundId)
      .order("hole", { ascending: true })
      .order("shot_no", { ascending: true }),
  );

  if (error) {
    throw new Error(`Failed to fetch shots for round: ${error.message}`);
  }

  return ShotRowsSchema.parse(data);
}
