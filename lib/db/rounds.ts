/**
 * Database query functions for the `rounds` table.
 * Call these from server components (app/**) and server actions only.
 * Never import this file from components/ — use actions/ for mutations.
 */

import { createServerClient } from "@/lib/supabase/server";
import { RoundRowSchema, type RoundRow } from "@/lib/schemas/round";

/**
 * Fetch a single round by ID. Returns null if not found.
 * Throws on unexpected DB errors.
 */
export async function getRound(id: string): Promise<RoundRow | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("rounds")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    // PGRST116 = no rows returned by .single()
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch round: ${error.message}`);
  }

  return RoundRowSchema.parse(data);
}
