/**
 * Birdie board — which holes you've birdied *this season* and which are still
 * open. Hayden Lake is seasonal (opens April, closes end of October), so "this
 * year" is one season; the caller passes the season year (a calendar year is
 * enough — the course is never played out of season).
 *
 * A hole counts as birdied if any completed, non-conceded play of it this season
 * came in **under par** (strokes ≤ par − 1) — an eagle counts as birdied too.
 * The par and the full 18-hole list are derived from *all-history* shots (every
 * hole has been played before), so a hole not yet played this season still
 * appears — flagged distinctly from a played-but-not-birdied hole.
 *
 * Pure over plain arrays; zero Supabase imports (D-05). Reuses core aggregation.
 */

import { aggregateByRoundHole, enrichRoundHole } from "@/lib/analytics/core";
import type { ShotRow } from "@/lib/schemas/shot";
import type { RoundRow } from "@/lib/schemas/round";

export interface HoleBirdie {
  hole: number;
  par: number;
  /** Completed, non-conceded plays of this hole this season. */
  played: number;
  /** Plays that came in under par (birdie or better). */
  birdies: number;
  /** birdies / played, or null when unplayed this season. */
  rate: number | null;
  /** True once at least one birdie has landed this season. */
  birdied: boolean;
}

export interface BirdieBoard {
  /** The season this board covers, or null for all-time (every season). */
  year: number | null;
  holes: HoleBirdie[];
  /** Holes birdied this season. */
  birdied: number;
  /** Holes on the course (from all-history). */
  total: number;
  /** Holes not yet birdied this season (played or not). */
  remaining: number;
}

const yearOf = (date: string): number => Number(date.slice(0, 4));

export function computeBirdieBoard(
  shots: readonly ShotRow[],
  rounds: readonly Pick<RoundRow, "id" | "date">[],
  year: number | null,
): BirdieBoard {
  // Par + the full hole list from all-history (every hole has been played).
  const parByHole = new Map<number, number>();
  for (const s of shots) if (!parByHole.has(s.hole)) parByHole.set(s.hole, s.par);

  // The window's completed, non-conceded holes. `year === null` → all-time.
  const windowRoundIds = new Set(
    rounds.filter((r) => year === null || yearOf(r.date) === year).map((r) => r.id),
  );
  const seasonShots = shots.filter((s) => windowRoundIds.has(s.round_id));

  const played = new Map<number, number>();
  const birdies = new Map<number, number>();
  for (const rh of aggregateByRoundHole(seasonShots)) {
    if (!rh.complete || rh.conceded) continue;
    const strokes = enrichRoundHole(rh).strokes;
    played.set(rh.hole, (played.get(rh.hole) ?? 0) + 1);
    if (strokes <= rh.par - 1) birdies.set(rh.hole, (birdies.get(rh.hole) ?? 0) + 1);
  }

  const holes: HoleBirdie[] = [...parByHole.keys()]
    .sort((a, b) => a - b)
    .map((hole) => {
      const p = played.get(hole) ?? 0;
      const b = birdies.get(hole) ?? 0;
      return {
        hole,
        par: parByHole.get(hole)!,
        played: p,
        birdies: b,
        rate: p > 0 ? b / p : null,
        birdied: b > 0,
      };
    });

  const birdied = holes.filter((h) => h.birdied).length;
  return {
    year,
    holes,
    birdied,
    total: holes.length,
    remaining: holes.length - birdied,
  };
}
