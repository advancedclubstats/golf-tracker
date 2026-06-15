/**
 * Analytics core (P2-T1).
 *
 * Pure, typed port of the *shared computation primitives* from
 * `docs/golf_stats.gs`. The `.gs` file is the source of truth; these functions
 * must produce identical outputs on the same logical inputs.
 *
 * Scope (per P2-T1): the shared helpers + round-hole aggregation + per-hole
 * enrichment that every summary/dashboard view depends on. The four table
 * builders (Hole / Club / Distance / Dashboard) live in later P2 tickets and
 * consume what's here.
 *
 * Layer rules:
 *   - D-05: ZERO Supabase imports. These functions accept plain typed arrays so
 *     they're testable without a DB connection. Importing the `ShotRow` *type*
 *     from the Zod schema is fine — it's a compile-time type, not a runtime dep.
 *   - Bucket boundaries and putt conversion come from `lib/constants.ts` — never
 *     redefined here (single-source-of-truth hard rule).
 *
 * Field mapping from the sheet model to our schema:
 *   RoundID→round_id, ShotNo→shot_no, MissDirection→miss_direction, etc.
 *   `Date` is round-level in our model (on `rounds`, not `shots`), so nothing
 *   here is date-dependent. `penalty` is a real int column, so the `.gs`
 *   string-coercion helpers collapse to near-trivial checks.
 */

import { PUTT_BUCKETS, PUTT_YD_TO_FT } from "@/lib/constants";
import type { Result } from "@/lib/constants";
import type { ShotRow } from "@/lib/schemas/shot";

// ─── Bucket finders ───────────────────────────────────────────────────────────

/** A yardage bucket with half-open `[min, max)` bounds. */
export interface RangeBucket {
  readonly label: string;
  readonly min: number;
  readonly max: number;
}

/** A putt bucket with upper-inclusive `(minExc, maxInc]` bounds (in feet). */
export interface PuttBucket {
  readonly label: string;
  readonly minExc: number;
  readonly maxInc: number;
}

/**
 * Find the putt bucket (in feet) a distance falls into.
 * Upper-inclusive: a 6-ft putt is in "3–6 ft" (matches `.gs` puttBucketOf).
 */
export function puttBucketOf(ft: number): PuttBucket | null {
  for (const b of PUTT_BUCKETS) {
    if (ft > b.minExc && ft <= b.maxInc) return b;
  }
  return null;
}

/**
 * Find the half-open `[min, max)` bucket a value falls into.
 * Generic over the ATG / approach bucket arrays in `lib/constants.ts`
 * (matches `.gs` bucketOf).
 */
export function bucketOf<T extends RangeBucket>(
  buckets: readonly T[],
  value: number,
): T | null {
  for (const b of buckets) {
    if (value >= b.min && value < b.max) return b;
  }
  return null;
}

/** Convert a putt yardage to feet for bucketing (×3 per `.gs` convention). */
export function puttYardsToFeet(yards: number): number {
  return yards * PUTT_YD_TO_FT;
}

// ─── Penalty helpers ──────────────────────────────────────────────────────────

/** Penalty strokes recorded on a single shot (0 if absent/negative). */
export function penaltyOf(shot: ShotRow): number {
  const p = shot.penalty ?? 0;
  return p > 0 ? p : 0;
}

/** Total penalty strokes across all shots on a hole. */
export function totalPenalties(shots: readonly ShotRow[]): number {
  let t = 0;
  for (const s of shots) t += penaltyOf(s);
  return t;
}

/**
 * Penalty strokes incurred on shots *before* the first putter.
 * Used by the GIR fallback for legacy untagged approaches (D-04).
 */
export function penaltiesBeforeFirstPutt(shots: readonly ShotRow[]): number {
  let t = 0;
  for (const s of shots) {
    if (s.club === "Putter") break;
    t += penaltyOf(s);
  }
  return t;
}

// ─── Putt classification ──────────────────────────────────────────────────────

/**
 * A "real putt" = a stroke played with the ball already on the green. This is
 * the PGA-Tour definition and it is **club-agnostic**: a putter used from the
 * fringe/fairway is NOT a putt, and a stroke from the green IS one (even the
 * rare non-putter). The signal is the lie, never the club (D-12).
 *
 * Primary: the captured `start_lie === 'Green'`. Legacy rows logged before lie
 * capture (D-04 era) carry a null `start_lie`; for those we fall back to the old
 * club+result proxy — a Putter whose own `result` is NOT 'Green' (the shot that
 * *reaches* the green, e.g. a Texas wedge, is tagged 'Green' and excluded).
 */
export function isRealPutt(shot: ShotRow): boolean {
  if (shot.start_lie != null) return shot.start_lie === "Green";
  return shot.club === "Putter" && shot.result !== "Green";
}

// ─── Round-hole aggregation ───────────────────────────────────────────────────

/** All shots for one (round, hole), grouped and ordered by `shot_no`. */
export interface RoundHole {
  roundId: string;
  hole: number;
  par: number;
  /** Shots on this hole, ascending by `shot_no`. */
  shots: ShotRow[];
  /** Highest `shot_no` seen (robust to gaps in the sequence). */
  lastShotNo: number;
  /** `result` of the highest-`shot_no` shot. */
  lastShotResult: Result | null;
  /** A hole "counts" only if its last shot's result is 'Make'. */
  complete: boolean;
  /**
   * The hole was picked up / conceded (any shot flagged conceded). Such holes
   * are not `complete` (no Make) so they stay excluded from scoring — this only
   * distinguishes an intentional pickup from a data-entry gap for labelling.
   */
  conceded: boolean;
}

/** A round-hole enriched with derived per-hole stats (complete holes only). */
export interface EnrichedRoundHole extends RoundHole {
  /** `max(shot_no) + sum(penalty)` — see SPEC "Stroke-counting rule". */
  strokes: number;
  /** Count of real putts (post-green Putter strokes). */
  putts: number;
  /** Green in regulation: `strokesToReachGreen <= par - 2`. */
  gir: boolean;
  /** Result of the tee shot (shot 1). */
  teeResult: Result | null;
  /** Sum of execution ratings over non-putter shots (for shot quality). */
  nonPuttExecSum: number;
  /** Count of non-putter shots with a positive execution rating. */
  nonPuttExecCount: number;
}

/**
 * Group raw shot rows into round-holes, sort each hole's shots by `shot_no`,
 * and flag completeness (last shot's result is 'Make'). Matches `.gs`
 * aggregateByRoundHole, but returns an array of values rather than a keyed map.
 *
 * Rows with a missing round id, hole, or shot number are skipped (defensive —
 * the typed schema makes these unreachable for app data, but import data
 * (P6) may be messier).
 */
export function aggregateByRoundHole(shots: readonly ShotRow[]): RoundHole[] {
  const byKey = new Map<string, RoundHole>();

  for (const row of shots) {
    const rid = row.round_id;
    const hole = row.hole;
    const sn = row.shot_no;
    if (!rid || hole == null || !sn) continue;

    const key = `${rid}||${hole}`;
    let rh = byKey.get(key);
    if (!rh) {
      rh = {
        roundId: rid,
        hole,
        par: row.par,
        shots: [],
        lastShotNo: 0,
        lastShotResult: null,
        complete: false,
        conceded: false,
      };
      byKey.set(key, rh);
    }
    rh.shots.push(row);
    if (sn > rh.lastShotNo) {
      rh.lastShotNo = sn;
      rh.lastShotResult = row.result ?? null;
    }
  }

  const out: RoundHole[] = [];
  for (const rh of byKey.values()) {
    rh.shots.sort((a, b) => a.shot_no - b.shot_no);
    rh.complete = rh.lastShotResult === "Make";
    rh.conceded = rh.shots.some((s) => s.conceded === true);
    out.push(rh);
  }
  return out;
}

// ─── Strokes to reach the green (GIR basis) ───────────────────────────────────

/**
 * Total strokes (including penalties) to put the ball on the green.
 * Three-path fallback, locked by D-04 — must match `.gs` exactly:
 *
 *   1. Primary: first shot tagged `result = 'Green'` →
 *      `shot_no + penalties_through_that_shot`.
 *   2. Fallback A (legacy untagged approach): no 'Green' tag, but a Putter
 *      exists whose result is NOT 'Make' → use the shot before that first
 *      Putter as the reach: `(firstPutter.shot_no - 1) + penaltiesBeforeFirstPutt`.
 *   3. Fallback B (chip-in / Texas-wedge hole-out): otherwise → total `strokes`.
 *
 * Takes the round-hole's shots plus its already-computed `strokes` (the `.gs`
 * caller sets `r.strokes` before calling this — see rebuildHoleSummary).
 */
export function strokesToReachGreen(rh: {
  shots: readonly ShotRow[];
  strokes: number;
}): number {
  const { shots, strokes } = rh;

  // Path 1 — first shot that reached the green.
  for (let i = 0; i < shots.length; i++) {
    if (shots[i].result === "Green") {
      let pen = 0;
      for (let j = 0; j <= i; j++) pen += penaltyOf(shots[j]);
      return shots[i].shot_no + pen;
    }
  }

  // Path 2 — legacy fallback to the shot before the first (non-holing) putter.
  const firstPutterIdx = shots.findIndex((s) => s.club === "Putter");
  if (firstPutterIdx !== -1) {
    const firstPutter = shots[firstPutterIdx];
    if (firstPutter.result !== "Make") {
      return firstPutter.shot_no - 1 + penaltiesBeforeFirstPutt(shots);
    }
  }

  // Path 3 — chip-in / hole-out from off the green.
  return strokes;
}

// ─── Per-hole enrichment ──────────────────────────────────────────────────────

/**
 * Derive per-hole stats shared by the Hole Summary and Dashboard views.
 * Intended for *complete* round-holes (the only ones the `.gs` enriches).
 *
 * Mirrors the enrichment blocks in rebuildHoleSummary (lines ~196–216) and
 * rebuildDashboard (lines ~668–683).
 */
export function enrichRoundHole(rh: RoundHole): EnrichedRoundHole {
  const strokes = rh.lastShotNo + totalPenalties(rh.shots);
  const putts = rh.shots.filter(isRealPutt).length;
  const gir = strokesToReachGreen({ shots: rh.shots, strokes }) <= rh.par - 2;
  const teeResult = rh.shots.length > 0 ? rh.shots[0].result ?? null : null;

  let nonPuttExecSum = 0;
  let nonPuttExecCount = 0;
  for (const s of rh.shots) {
    if (s.club === "Putter") continue;
    const e = s.execution;
    if (typeof e === "number" && e > 0) {
      nonPuttExecSum += e;
      nonPuttExecCount++;
    }
  }

  return {
    ...rh,
    strokes,
    putts,
    gir,
    teeResult,
    nonPuttExecSum,
    nonPuttExecCount,
  };
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

/** Round to 2 decimal places (matches `.gs` r2). */
export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
