"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getDataScopeUserId, userDataTag } from "@/lib/auth/scope";
import { createServerClient } from "@/lib/supabase/server";
import {
  PracticeSessionInsertSchema,
  type PracticeSessionInsert,
} from "@/lib/schemas/practice";
import { getPracticeGame } from "@/lib/practice/games";

/**
 * Create a practice-game session and its per-ball results.
 *
 * Scoped to the caller like rounds/shots (owner → real data; visitor → their
 * sandbox): no owner gate, so a logged-out visitor logs into their own isolated,
 * ephemeral copy — the same full-app sandbox they get for rounds. Validates the
 * payload, checks the game exists in the code registry, then writes the session
 * + results. Throws on any failure — never silent.
 *
 * Walled off: writes ONLY to `practice_*`, never `shots` / `rounds`.
 */
export async function createPracticeSession(
  data: PracticeSessionInsert,
): Promise<{ id: string }> {
  const userId = await getDataScopeUserId();
  const validated = PracticeSessionInsertSchema.parse(data);

  // The game must exist in the code registry (D-02): no free-text game ids.
  if (!getPracticeGame(validated.game_id)) {
    throw new Error(`Unknown practice game: ${validated.game_id}`);
  }

  const supabase = createServerClient();

  const { data: session, error: sessionErr } = await supabase
    .from("practice_sessions")
    .insert({
      user_id: userId,
      game_id: validated.game_id,
      played_on: validated.played_on,
    })
    .select("id")
    .single();
  if (sessionErr) {
    throw new Error(`Failed to create practice session: ${sessionErr.message}`);
  }

  const rows = validated.results.map((r) => ({
    session_id: session.id,
    station_index: r.station_index,
    ball_index: r.ball_index,
    strokes: r.strokes,
    putts: r.putts ?? null,
    finish: r.finish ?? null,
  }));
  const { error: resultErr } = await supabase.from("practice_results").insert(rows);
  if (resultErr) {
    // Best-effort cleanup so a half-written session can't pollute the leaderboard.
    await supabase.from("practice_sessions").delete().eq("id", session.id);
    throw new Error(`Failed to save practice results: ${resultErr.message}`);
  }

  // Practice reads are cached under the scope's userDataTag; bust it so the new
  // session shows immediately. (Same tag as rounds/shots — practice lives in the
  // same scope, just different tables.)
  revalidateTag(userDataTag(userId), { expire: 0 });
  revalidatePath("/practice");
  revalidatePath(`/practice/${validated.game_id}`);

  return { id: session.id };
}
