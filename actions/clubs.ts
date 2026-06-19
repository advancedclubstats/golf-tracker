"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { ClubNameSchema } from "@/lib/schemas/club";
import { getDataScopeUserId } from "@/lib/auth/scope";

/**
 * Revalidate everywhere the club bag is rendered: the Setup editor, the
 * new-shot entry flow, and the round detail edit sheet. The log/detail pages
 * are force-dynamic, but revalidating keeps any cached segments fresh.
 */
function revalidateClubViews() {
  revalidatePath("/courses");
  revalidatePath("/rounds", "layout");
}

/** Add a club to the bag at the end. Bag names are unique (DB constraint). */
export async function addClub(name: string): Promise<{ id: string }> {
  // Scope to the caller (owner → real bag; visitor → their sandbox bag).
  const userId = await getDataScopeUserId();
  const validName = ClubNameSchema.parse(name);
  const supabase = createServerClient();

  // Place new clubs after the current max sort_order.
  const { data: last } = await supabase
    .from("clubs")
    .select("sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("clubs")
    .insert({ name: validName, sort_order: sortOrder, user_id: userId })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error(`"${validName}" is already in your bag.`);
    throw new Error(`Failed to add club: ${error.message}`);
  }
  revalidateClubViews();
  return { id: data.id };
}

export async function renameClub(id: string, name: string): Promise<void> {
  const userId = await getDataScopeUserId();
  const validName = ClubNameSchema.parse(name);
  const supabase = createServerClient();
  const { error } = await supabase
    .from("clubs")
    .update({ name: validName })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    if (error.code === "23505") throw new Error(`"${validName}" is already in your bag.`);
    throw new Error(`Failed to rename club: ${error.message}`);
  }
  revalidateClubViews();
}

/**
 * Remove a club from the bag. Does NOT affect logged shots — `shots.club` is a
 * free string with no FK, so historical shots keep their club and analytics are
 * unchanged. This only stops the club appearing in the entry selector.
 */
export async function deleteClub(id: string): Promise<void> {
  const userId = await getDataScopeUserId();
  const supabase = createServerClient();
  const { error } = await supabase
    .from("clubs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to remove club: ${error.message}`);
  revalidateClubViews();
}

/** Persist a new bag order (array of club ids, front to back). */
export async function reorderClubs(orderedIds: string[]): Promise<void> {
  const userId = await getDataScopeUserId();
  const supabase = createServerClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("clubs")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("user_id", userId);
    if (error) throw new Error(`Failed to reorder clubs: ${error.message}`);
  }
  revalidateClubViews();
}
