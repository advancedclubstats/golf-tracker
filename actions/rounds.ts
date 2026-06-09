"use server";

import { revalidatePath } from "next/cache";
import { RoundInsertSchema, type RoundInsert } from "@/lib/schemas/round";
import { V1_USER_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Create a new round. Validates input with RoundInsertSchema before touching
 * the DB. Throws on validation failure or DB error — never returns silently.
 *
 * Cache: revalidates '/' so the dashboard reflects the new round immediately.
 */
export async function createRound(data: RoundInsert): Promise<{ id: string }> {
  // Validate first — throws ZodError if input is malformed.
  const validated = RoundInsertSchema.parse(data);

  const supabase = createServerClient();

  const { data: round, error } = await supabase
    .from("rounds")
    .insert({ ...validated, user_id: V1_USER_ID })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create round: ${error.message}`);
  }

  revalidatePath("/");

  return { id: round.id };
}

/**
 * Delete a round and all of its shots. Shots are removed by the
 * `on delete cascade` FK (migration 002), so this is a single delete.
 * Throws on DB error. Cache: revalidates '/' (dashboard) and '/rounds'.
 */
export async function deleteRound(id: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase
    .from("rounds")
    .delete()
    .eq("id", id)
    .eq("user_id", V1_USER_ID);

  if (error) {
    throw new Error(`Failed to delete round: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/rounds");
}
