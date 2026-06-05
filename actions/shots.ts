"use server";

import { revalidatePath } from "next/cache";
import {
  ShotInsertSchema,
  ShotUpdateSchema,
  type ShotInsert,
  type ShotUpdate,
} from "@/lib/schemas/shot";
import { V1_USER_ID } from "@/lib/constants";
import { createServerClient } from "@/lib/supabase/server";
import { renumberContiguous } from "@/lib/shots/sequence";

/** Revalidate the views that depend on shot data (cache hard rule). */
function revalidateShotViews(roundId: string) {
  revalidatePath("/");
  revalidatePath(`/rounds/${roundId}`);
}

/**
 * Re-derive the start-lie chain for a hole after its shot positions change
 * (insert / delete). The carry-forward logic lives in the Postgres function so
 * there's a single source of truth (see migration 007).
 */
async function recomputeHoleStartLie(
  supabase: ReturnType<typeof createServerClient>,
  roundId: string,
  hole: number,
): Promise<void> {
  const { error } = await supabase.rpc("recompute_hole_start_lie", {
    p_round: roundId,
    p_hole: hole,
  });
  if (error) throw new Error(`Failed to recompute start lies: ${error.message}`);
}

/**
 * Save a single shot. Validates with ShotInsertSchema before touching the DB.
 * Throws on validation failure or DB error — never returns silently.
 *
 * Cache: revalidates both '/' (dashboard) and '/rounds/[id]' (round detail).
 */
export async function createShot(data: ShotInsert): Promise<{ id: string }> {
  const validated = ShotInsertSchema.parse(data);

  const supabase = createServerClient();

  // Idempotent on the (round_id, hole, shot_no) unique key. On a flaky mobile
  // connection the row can commit while the action's response is lost — the
  // client then sees an error, never advances its shot counter, and re-taps the
  // same shot_no, which would 409 forever and trap the user on that shot. Upsert
  // makes the retry update the existing slot to the on-screen values instead, so
  // the flow advances. It's also race-safe against a double-tap.
  const { data: shot, error } = await supabase
    .from("shots")
    .upsert(
      { ...validated, user_id: V1_USER_ID },
      { onConflict: "round_id,hole,shot_no" },
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to save shot: ${error.message}`);
  }

  revalidateShotViews(validated.round_id);

  return { id: shot.id };
}

/**
 * Insert a shot at a given position on a hole, shifting the shot at that
 * position and everything after it up by one (so shot numbers stay a
 * contiguous 1..n sequence). `data.shot_no` is the target slot. Used by the
 * round-detail "+ shot" control to drop in a missed shot.
 *
 * Cache: revalidates '/' and '/rounds/[id]'.
 */
export async function insertShot(data: ShotInsert): Promise<{ id: string }> {
  const validated = ShotInsertSchema.parse(data);
  const supabase = createServerClient();

  // Shift existing shots at/after the target slot up by one. Apply descending
  // so each move lands in a free slot (never colliding on the unique key).
  const { data: toShift, error: listErr } = await supabase
    .from("shots")
    .select("id, shot_no")
    .eq("round_id", validated.round_id)
    .eq("hole", validated.hole)
    .gte("shot_no", validated.shot_no)
    .order("shot_no", { ascending: false });
  if (listErr) {
    throw new Error(`Failed to load hole shots: ${listErr.message}`);
  }

  for (const s of toShift ?? []) {
    const { error: bumpErr } = await supabase
      .from("shots")
      .update({ shot_no: s.shot_no + 1 })
      .eq("id", s.id);
    if (bumpErr) {
      throw new Error(`Failed to renumber shot: ${bumpErr.message}`);
    }
  }

  const { data: shot, error } = await supabase
    .from("shots")
    .insert({ ...validated, user_id: V1_USER_ID })
    .select("id")
    .single();
  if (error) {
    throw new Error(`Failed to insert shot: ${error.message}`);
  }

  // Positions shifted → re-derive the hole's start-lie chain (carry-forward).
  await recomputeHoleStartLie(supabase, validated.round_id, validated.hole);

  revalidateShotViews(validated.round_id);
  return { id: shot.id };
}

/**
 * Update a shot's descriptive fields (not its position). Validates with
 * ShotUpdateSchema. Throws on validation or DB error.
 *
 * `roundId` is passed so we can revalidate the round view without a second
 * fetch. Cache: revalidates '/' and '/rounds/[id]'.
 */
export async function updateShot(
  id: string,
  roundId: string,
  data: ShotUpdate,
): Promise<void> {
  const validated = ShotUpdateSchema.parse(data);

  const supabase = createServerClient();

  const { error } = await supabase.from("shots").update(validated).eq("id", id);

  if (error) {
    throw new Error(`Failed to update shot: ${error.message}`);
  }

  revalidateShotViews(roundId);
}

/**
 * Delete a shot and renumber the remaining shots on its hole so shot numbers
 * stay a contiguous 1..n sequence (a gap would inflate the hole's score).
 * Throws on DB error. Cache: revalidates '/' and '/rounds/[id]'.
 */
export async function deleteShot(id: string, roundId: string): Promise<void> {
  const supabase = createServerClient();

  // Need the hole to find siblings to renumber.
  const { data: shot, error: findErr } = await supabase
    .from("shots")
    .select("hole")
    .eq("id", id)
    .single();
  if (findErr) {
    throw new Error(`Failed to load shot: ${findErr.message}`);
  }

  const { error: delErr } = await supabase.from("shots").delete().eq("id", id);
  if (delErr) {
    throw new Error(`Failed to delete shot: ${delErr.message}`);
  }

  const { data: remaining, error: listErr } = await supabase
    .from("shots")
    .select("id, shot_no")
    .eq("round_id", roundId)
    .eq("hole", shot.hole)
    .order("shot_no", { ascending: true });
  if (listErr) {
    throw new Error(`Failed to load hole shots: ${listErr.message}`);
  }

  // Apply ascending so each target slot is free before we move into it.
  for (const update of renumberContiguous(remaining ?? [])) {
    const { error: renumErr } = await supabase
      .from("shots")
      .update({ shot_no: update.shot_no })
      .eq("id", update.id);
    if (renumErr) {
      throw new Error(`Failed to renumber shot: ${renumErr.message}`);
    }
  }

  // Positions shifted → re-derive the hole's start-lie chain (carry-forward).
  await recomputeHoleStartLie(supabase, roundId, shot.hole);

  revalidateShotViews(roundId);
}

/**
 * Mark a hole as picked up / conceded by flagging its last shot. The hole stays
 * excluded from scoring (no Make), but is labelled "Picked up" rather than
 * "In progress". Requires at least one logged shot on the hole.
 * Cache: revalidates '/' and '/rounds/[id]'.
 */
export async function concedeHole(roundId: string, hole: number): Promise<void> {
  const supabase = createServerClient();

  const { data: last, error: findErr } = await supabase
    .from("shots")
    .select("id")
    .eq("round_id", roundId)
    .eq("hole", hole)
    .order("shot_no", { ascending: false })
    .limit(1);
  if (findErr) {
    throw new Error(`Failed to load hole shots: ${findErr.message}`);
  }
  if (!last || last.length === 0) {
    throw new Error("Cannot pick up a hole with no shots logged.");
  }

  const { error: updErr } = await supabase
    .from("shots")
    .update({ conceded: true })
    .eq("id", last[0].id);
  if (updErr) {
    throw new Error(`Failed to pick up hole: ${updErr.message}`);
  }

  revalidateShotViews(roundId);
}
