/**
 * Target-direction dispersion by club category — the target_offset payoff
 * (migration 020). Sibling of `shotShape.ts`: same club buckets, same gating,
 * but over the *outcome* axis instead of the cause.
 *
 * A shot's `target_offset` is a 3×3 pin-relative cell (long/short × left/right,
 * center = at the target). We decompose it into two independent reads:
 *   - distance control (short ↔ long) — the signal nothing else captures; the
 *     headline, because "you leave it short" maps straight to a fix.
 *   - lateral (left ↔ right) — secondary; partly overlaps the curve read.
 * Plus the at-pin rate (how often you finish dead at it).
 *
 * Diagnostic only — does NOT feed Strokes Gained (SG already prices the leave via
 * the next shot's distance). See docs/design/flight_and_target_offset_brief.md.
 *
 * Rates are over shots with a tagged offset (its own `n`), gated by `gates.ts`
 * exactly like the rest of the engine. Layer rules (D-05): plain `ShotRow[]` in,
 * plain data out, no Supabase imports, independently testable.
 */

import { TARGET_OFFSETS, type StartLie, type TargetOffset } from "@/lib/constants";
import { tierFor, type SampleTier } from "@/lib/analytics/gates";
import {
  CLUB_CATEGORIES,
  clubCategory,
  type ClubCategory,
} from "@/lib/analytics/shotShape";
import type { ShotRow } from "@/lib/schemas/shot";

/** Which distance band (row) a cell sits in. */
const OFFSET_ROW: Record<TargetOffset, "long" | "mid" | "short"> = {
  LongLeft: "long",
  Long: "long",
  LongRight: "long",
  Left: "mid",
  Center: "mid",
  Right: "mid",
  ShortLeft: "short",
  Short: "short",
  ShortRight: "short",
};

/** Which lateral band (column) a cell sits in. */
const OFFSET_COL: Record<TargetOffset, "left" | "mid" | "right"> = {
  LongLeft: "left",
  Long: "mid",
  LongRight: "right",
  Left: "left",
  Center: "mid",
  Right: "right",
  ShortLeft: "left",
  Short: "mid",
  ShortRight: "right",
};

/**
 * A bias read is "one-way" when, among the shots that missed *on that axis*, one
 * side is ≥55% and the other ≤20% — the same thresholds as the shape read, so a
 * "leaves it short" tendency reads with the same confidence as a one-way curve.
 */
const ONE_WAY_HEAVY = 0.55;
const ONE_WAY_LIGHT = 0.2;

/**
 * Off-the-tee drives capture side only (no long/short), so they carry no
 * distance signal and must not count toward the distance axis — otherwise a
 * drive's lateral cell (the pin-high row) reads as perfect distance control.
 * Mirrors `offsetIsSideOnly` in the entry flow (Tee && par ≥ 4); par-3 tee shots
 * are approaches and DO carry distance. Lateral still counts every tagged shot.
 */
function sideOnly(lie: StartLie | null, par: number | null): boolean {
  return lie === "Tee" && (par ?? 0) >= 4;
}

export interface TargetDispersionRow {
  category: ClubCategory;
  /** Non-putter full shots in this category. */
  shots: number;
  /** Shots with a tagged target_offset (denominator for lateral + at-pin). */
  offsetN: number;
  /** Tagged shots that carry a distance signal (excludes side-only tee drives;
   *  the denominator for the distance axis). */
  distanceN: number;
  /** Raw count per cell. */
  cells: Record<TargetOffset, number>;
  /** Distance-axis shares over distanceN (null when distanceN = 0). */
  shortPct: number | null;
  pinHighPct: number | null;
  longPct: number | null;
  /** Lateral-axis shares over offsetN (null when offsetN = 0). */
  leftPct: number | null;
  onLinePct: number | null;
  rightPct: number | null;
  /** Share that finished dead at the target (center cell). */
  atPinPct: number | null;
  /** Dominant distance miss when one-way; null when two-way / insufficient. */
  distanceBias: "Short" | "Long" | null;
  /** Dominant lateral miss when one-way; null when two-way / insufficient. */
  lateralBias: "Left" | "Right" | null;
  /** Sample tier on the offset `n` (club threshold). `early` below 15. */
  tier: SampleTier;
}

interface Acc {
  shots: number;
  offsetN: number;
  cells: Record<TargetOffset, number>;
  /** Distance counts among distance-bearing (non-side-only) tagged shots. */
  distN: number;
  distShort: number;
  distPinHigh: number;
  distLong: number;
}

function newAcc(): Acc {
  return {
    shots: 0,
    offsetN: 0,
    cells: Object.fromEntries(TARGET_OFFSETS.map((o) => [o, 0])) as Record<
      TargetOffset,
      number
    >,
    distN: 0,
    distShort: 0,
    distPinHigh: 0,
    distLong: 0,
  };
}

/**
 * Compute per-category target dispersion. One row per category with at least one
 * non-putter shot, in canonical category order.
 */
export function computeTargetDispersion(
  shots: readonly ShotRow[],
): TargetDispersionRow[] {
  const cats = new Map<ClubCategory, Acc>();

  for (const row of shots) {
    if (!row.club || !row.shot_no) continue;
    const cat = clubCategory(row.club);
    if (cat === null) continue;

    let a = cats.get(cat);
    if (!a) {
      a = newAcc();
      cats.set(cat, a);
    }
    a.shots++;

    if (row.target_offset != null) {
      a.offsetN++;
      a.cells[row.target_offset]++;
      // Distance axis: only shots that were actually asked long/short.
      if (!sideOnly(row.start_lie, row.par)) {
        a.distN++;
        const band = OFFSET_ROW[row.target_offset];
        if (band === "short") a.distShort++;
        else if (band === "long") a.distLong++;
        else a.distPinHigh++;
      }
    }
  }

  const pctOf = (n: number, d: number): number | null => (d > 0 ? n / d : null);

  /** One-way read over the two off-axis sides (mirrors the shape miss read). */
  function bias<T extends string>(
    a: number,
    b: number,
    aLabel: T,
    bLabel: T,
  ): T | null {
    const off = a + b;
    if (off === 0) return null;
    const aShare = a / off;
    const bShare = b / off;
    if (aShare >= ONE_WAY_HEAVY && bShare <= ONE_WAY_LIGHT) return aLabel;
    if (bShare >= ONE_WAY_HEAVY && aShare <= ONE_WAY_LIGHT) return bLabel;
    return null;
  }

  const rows: TargetDispersionRow[] = [];
  for (const category of CLUB_CATEGORIES) {
    const a = cats.get(category);
    if (!a) continue;

    // Lateral axis: over every tagged shot (a drive that leaks left counts).
    let left = 0;
    let onLine = 0;
    let right = 0;
    for (const o of TARGET_OFFSETS) {
      const n = a.cells[o];
      if (n === 0) continue;
      if (OFFSET_COL[o] === "left") left += n;
      else if (OFFSET_COL[o] === "right") right += n;
      else onLine += n;
    }

    rows.push({
      category,
      shots: a.shots,
      offsetN: a.offsetN,
      distanceN: a.distN,
      cells: a.cells,
      shortPct: pctOf(a.distShort, a.distN),
      pinHighPct: pctOf(a.distPinHigh, a.distN),
      longPct: pctOf(a.distLong, a.distN),
      leftPct: pctOf(left, a.offsetN),
      onLinePct: pctOf(onLine, a.offsetN),
      rightPct: pctOf(right, a.offsetN),
      atPinPct: pctOf(a.cells.Center, a.offsetN),
      distanceBias: bias(a.distShort, a.distLong, "Short", "Long"),
      lateralBias: bias(left, right, "Left", "Right"),
      tier: tierFor("club", a.offsetN),
    });
  }

  return rows;
}
