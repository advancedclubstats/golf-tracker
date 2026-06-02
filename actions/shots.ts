"use server";

import { revalidatePath } from "next/cache";
import { ShotInsertSchema, type ShotInsert } from "@/lib/schemas/shot";
import { V1_USER_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Save a single shot. Validates with ShotInsertSchema before touching the DB.
 * Throws on validation failure or DB error — never returns silently.
 *
 * Cache: revalidates both '/' (dashboard) and '/rounds/[id]' (round detail).
 */
export async function createShot(data: ShotInsert): Promise<{ id: string }> {
  const validated = ShotInsertSchema.parse(data);

  const supabase = createServerClient();

  const { data: shot, error } = await supabase
    .from("shots")
    .insert({ ...validated, user_id: V1_USER_ID })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to save shot: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath(`/rounds/${validated.round_id}`);

  return { id: shot.id };
}
