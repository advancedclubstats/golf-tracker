"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { RoundInsertSchema, type RoundInsert } from "@/lib/schemas/round";
import { createServerClient } from "@/lib/supabase/server";
import { getDataScopeUserId, userDataTag } from "@/lib/auth/scope";

/**
 * Create a new round. Validates input with RoundInsertSchema before touching
 * the DB. Throws on validation failure or DB error — never returns silently.
 *
 * Cache: revalidates '/' so the dashboard reflects the new round immediately.
 */
export async function createRound(data: RoundInsert): Promise<{ id: string }> {
  // Scope to the caller (owner → real data; visitor → their sandbox). No owner
  // gate: visitors create rounds in their own isolated copy.
  const userId = await getDataScopeUserId();
  // Validate first — throws ZodError if input is malformed.
  const validated = RoundInsertSchema.parse(data);

  const supabase = createServerClient();

  const { data: round, error } = await supabase
    .from("rounds")
    .insert({ ...validated, user_id: userId })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create round: ${error.message}`);
  }

  revalidatePath("/");
  // Bust this scope's cached rounds/shots so the new round shows immediately.
  revalidateTag(userDataTag(userId), { expire: 0 });

  return { id: round.id };
}

/**
 * Delete a round and all of its shots. Shots are removed by the
 * `on delete cascade` FK (migration 002), so this is a single delete.
 * Throws on DB error. Cache: revalidates '/' (dashboard) and '/rounds'.
 */
export async function deleteRound(id: string): Promise<void> {
  // The user_id filter scopes the delete to the caller's own rows, so a visitor
  // can only delete their sandbox rounds (never the owner's).
  const userId = await getDataScopeUserId();
  const supabase = createServerClient();

  const { error } = await supabase
    .from("rounds")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete round: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/rounds");
  // Bust this scope's cached rounds/shots so the deletion is reflected at once.
  revalidateTag(userDataTag(userId), { expire: 0 });
}
