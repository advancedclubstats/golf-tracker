/**
 * Database reads for the practice-game tables.
 *
 * Call from Server Components and server actions only (reads live in lib/db/,
 * mutations in actions/). Scoped by `user_id` like rounds/shots, so the owner
 * and each sandbox visitor see only their own practice sessions.
 *
 * WALLED OFF (DL-022): this is the ONLY data path that touches `practice_*`, and
 * it never reads `shots` / `rounds`. Conversely, no real-round analytic reads
 * these tables — verify in review.
 */

import { z } from "zod";
import { unstable_cache } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { withRetry } from "@/lib/supabase/retry";
import { getDataScopeUserId, userDataTag } from "@/lib/auth/scope";
import {
  PracticeSessionRowSchema,
  PracticeResultRowSchema,
  type PracticeResultRow,
} from "@/lib/schemas/practice";

/** A session plus its raw per-ball results. */
export interface PracticeSessionWithResults {
  id: string;
  game_id: string;
  played_on: string;
  created_at: string;
  results: PracticeResultRow[];
}

const SessionRowsSchema = z.array(PracticeSessionRowSchema);
const ResultRowsSchema = z.array(PracticeResultRowSchema);

/**
 * Every session (with results) the caller has logged for one game, newest
 * first. Two scoped queries (sessions, then their results) joined in memory —
 * the volume is tiny (a handful of sessions × 9 balls).
 */
export async function getPracticeSessions(
  gameId: string,
): Promise<PracticeSessionWithResults[]> {
  const userId = await getDataScopeUserId();
  return getPracticeSessionsCached(userId, gameId);
}

function getPracticeSessionsCached(
  userId: string,
  gameId: string,
): Promise<PracticeSessionWithResults[]> {
  return unstable_cache(
    async () => {
      const supabase = createServerClient();

      const { data: sessionData, error: sessionErr } = await withRetry(() =>
        supabase
          .from("practice_sessions")
          .select("*")
          .eq("user_id", userId)
          .eq("game_id", gameId)
          .order("played_on", { ascending: false })
          .order("created_at", { ascending: false }),
      );
      if (sessionErr) {
        throw new Error(`Failed to fetch practice sessions: ${sessionErr.message}`);
      }
      const sessions = SessionRowsSchema.parse(sessionData);
      if (sessions.length === 0) return [];

      const ids = sessions.map((s) => s.id);
      const { data: resultData, error: resultErr } = await withRetry(() =>
        supabase.from("practice_results").select("*").in("session_id", ids),
      );
      if (resultErr) {
        throw new Error(`Failed to fetch practice results: ${resultErr.message}`);
      }
      const results = ResultRowsSchema.parse(resultData);

      const bySession = new Map<string, PracticeResultRow[]>();
      for (const r of results) {
        const list = bySession.get(r.session_id) ?? [];
        list.push(r);
        bySession.set(r.session_id, list);
      }

      return sessions.map((s) => ({
        id: s.id,
        game_id: s.game_id,
        played_on: s.played_on,
        created_at: s.created_at,
        results: bySession.get(s.id) ?? [],
      }));
    },
    ["practice-sessions", userId, gameId],
    { tags: [userDataTag(userId)], revalidate: 60 },
  )();
}
