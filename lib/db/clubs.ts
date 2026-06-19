/**
 * Database query functions for the user's club bag (reads).
 * Call from Server Components and server actions only.
 */

import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { withRetry } from "@/lib/supabase/retry";
import { ClubRowSchema, type ClubRow } from "@/lib/schemas/club";
import { CLUBS } from "@/lib/constants";
import { getDataScopeUserId } from "@/lib/auth/scope";

const ClubRowsSchema = z.array(ClubRowSchema);

/** The user's club bag, in bag order. */
export async function getClubs(): Promise<ClubRow[]> {
  const supabase = createServerClient();
  const userId = await getDataScopeUserId();
  const { data, error } = await withRetry(() =>
    supabase
      .from("clubs")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true }),
  );
  if (error) throw new Error(`Failed to fetch clubs: ${error.message}`);
  return ClubRowsSchema.parse(data);
}

/**
 * The club bag as a plain ordered name list for the entry/edit selectors.
 * Falls back to the default `CLUBS` if the bag is somehow empty, so the entry
 * flow never renders an empty club list.
 */
export async function getClubNames(): Promise<string[]> {
  const clubs = await getClubs();
  return clubs.length > 0 ? clubs.map((c) => c.name) : [...CLUBS];
}
