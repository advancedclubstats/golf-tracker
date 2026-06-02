/**
 * Round list summary (P3-T3).
 *
 * Per-round rollup for the round browser. Unlike the dashboard (which only
 * counts complete holes), this lists EVERY round — including empty/partial ones
 * — so the browser can show rounds still being logged.
 *
 * Layer rules: zero Supabase imports; pure over plain arrays; reuses core.
 */

import { aggregateByRoundHole, enrichRoundHole } from "@/lib/analytics/core";
import type { ShotRow } from "@/lib/schemas/shot";
import type { RoundRow } from "@/lib/schemas/round";
import type { SessionType } from "@/lib/constants";

export interface RoundListItem {
  id: string;
  date: string;
  sessionType: SessionType;
  /** Total shots logged on the round (any hole, complete or not). */
  shotCount: number;
  /** Number of complete holes (last shot 'Make'). */
  completeHoles: number;
  /** Strokes summed over complete holes only. */
  strokes: number;
  /** Par summed over complete holes only. */
  par: number;
  /** `strokes - par` over complete holes. */
  vsPar: number;
}

/**
 * Build the round list. Output preserves the order of `rounds` (callers pass
 * them newest-first). Rounds with no shots appear with zeroed stats.
 */
export function computeRoundList(
  shots: readonly ShotRow[],
  rounds: readonly Pick<RoundRow, "id" | "date" | "session_type">[],
): RoundListItem[] {
  const shotCount = new Map<string, number>();
  for (const s of shots) {
    shotCount.set(s.round_id, (shotCount.get(s.round_id) ?? 0) + 1);
  }

  interface Agg {
    holes: number;
    strokes: number;
    par: number;
  }
  const statsByRound = new Map<string, Agg>();
  for (const e of aggregateByRoundHole(shots)
    .filter((r) => r.complete)
    .map(enrichRoundHole)) {
    let a = statsByRound.get(e.roundId);
    if (!a) {
      a = { holes: 0, strokes: 0, par: 0 };
      statsByRound.set(e.roundId, a);
    }
    a.holes++;
    a.strokes += e.strokes;
    a.par += e.par;
  }

  return rounds.map((r) => {
    const a = statsByRound.get(r.id);
    const strokes = a?.strokes ?? 0;
    const par = a?.par ?? 0;
    return {
      id: r.id,
      date: r.date,
      sessionType: r.session_type,
      shotCount: shotCount.get(r.id) ?? 0,
      completeHoles: a?.holes ?? 0,
      strokes,
      par,
      vsPar: strokes - par,
    };
  });
}
