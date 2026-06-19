/**
 * Database query functions for the `rounds` table.
 * Call these from server components (app/**) and server actions only.
 * Never import this file from components/ — use actions/ for mutations.
 */

import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { withRetry } from "@/lib/supabase/retry";
import { RoundRowSchema, type RoundRow } from "@/lib/schemas/round";
import { getDataScopeUserId } from "@/lib/auth/scope";

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
  const supabase = createServerClient();
  const userId = await getDataScopeUserId();

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
}
