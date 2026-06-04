/**
 * Database query functions for the user's club bag (reads).
 * Call from Server Components and server actions only.
 */

import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { ClubRowSchema, type ClubRow } from "@/lib/schemas/club";
import { CLUBS, V1_USER_ID } from "@/lib/constants";

const ClubRowsSchema = z.array(ClubRowSchema);

/** The user's club bag, in bag order. */
export async function getClubs(): Promise<ClubRow[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("user_id", V1_USER_ID)
    .order("sort_order", { ascending: true });
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
