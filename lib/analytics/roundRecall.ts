/**
 * Per-round recall: the hole-by-hole story for the `/rounds/[id]` page.
 *
 * This is the round-scoped sibling of `holeAttribution.ts` (which aggregates a
 * hole across ALL rounds). Here we walk a single round's holes in order and,
 * for each, surface what actually happened: the score vs par, where the strokes
 * went (per-category SG), the dominant losing link, and whether any shot was a
 * flagged bad decision. Pure over plain arrays (D-05); reuses core + sg.
 *
 * Honesty carries over from the rest of the engine:
 *   - Holes the player didn't finish (in-progress, picked up/conceded) have a
 *     null score — never a fabricated number.
 *   - SG only reads on holes whose every shot is *covered* (both ends resolve
 *     to a baseline). A coverage gap (e.g. a missing distance breaking the
 *     chain) sets `sgCovered = false` so the UI can avoid implying precision.
 *
 * `roundTakeaway` turns the cross-round breakdown (`roundCard.ts`) into one
 * conservative headline; below the comparison floor it returns a raw,
 * non-comparative line (a fact, not an invented delta).
 */

import { aggregateByRoundHole, enrichRoundHole } from "@/lib/analytics/core";
import {
  perShotSG,
  SG_CATEGORIES,
  type SgCategory,
} from "@/lib/analytics/sg";
import { computeFirstDominoes } from "@/lib/analytics/firstDomino";
import type { RoundBreakdown } from "@/lib/analytics/roundCard";
import type { ShotRow } from "@/lib/schemas/shot";

const MINUS = "−"; // typographic minus, matches RoundChips / the GapChip

export interface RoundRecallHole {
  hole: number;
  par: number;
  /** `max(shot_no) + penalties` — null until the hole is complete. */
  strokes: number | null;
  /** strokes − par; null until complete. */
  vsPar: number | null;
  /** Per-category SG for this hole (only categories with a covered shot). */
  sgByCategory: Partial<Record<SgCategory, number>>;
  /** The biggest-losing category on the hole, or null if nothing lost. */
  worstCategory: SgCategory | null;
  /** Any shot on the hole flagged `decision_quality === "Bad"`. */
  hasBadDecision: boolean;
  /** The hole was picked up / conceded (intentional, not a data gap). */
  conceded: boolean;
  /** Every shot on the hole produced SG — false signals a coverage gap. */
  sgCovered: boolean;
  /**
   * First-domino read (blow-up holes only): the shot the round turned on. Null
   * on a routine hole, a coverage gap, or a blow-up with no single domino.
   */
  rootCauseShotNo: number | null;
  /** SG category of the root-cause shot, for the "turned on …" phrasing. */
  rootCauseCategory: SgCategory | null;
  /** Shot numbers after the root cause — the forced recoveries to de-emphasize. */
  recoveryShotNos: number[];
}

/**
 * The hole-by-hole recall for one round, ascending by hole. Pass
 * tee-distance-filled shots (see `getEnrichedShots`) so off-the-tee SG is
 * computable. Holes with no shots simply don't appear.
 */
export function roundRecall(
  shots: readonly ShotRow[],
  roundId: string,
): RoundRecallHole[] {
  const mine = shots.filter((s) => s.round_id === roundId);

  // SG per (hole, category) for this round, plus a covered-shot tally so we can
  // tell a full chain from one with a gap.
  const sgByHole = new Map<number, Map<SgCategory, number>>();
  const coveredByHole = new Map<number, number>();
  for (const { shot, sg, category } of perShotSG(mine).entries) {
    let m = sgByHole.get(shot.hole);
    if (!m) {
      m = new Map();
      sgByHole.set(shot.hole, m);
    }
    m.set(category, (m.get(category) ?? 0) + sg);
    coveredByHole.set(shot.hole, (coveredByHole.get(shot.hole) ?? 0) + 1);
  }

  // First-domino read per blow-up hole (routine holes are absent from the map).
  const dominoByHole = new Map(
    computeFirstDominoes(mine).map((d) => [d.hole, d]),
  );

  const out: RoundRecallHole[] = [];
  for (const rh of aggregateByRoundHole(mine)) {
    const strokes = rh.complete ? enrichRoundHole(rh).strokes : null;

    const catMap = sgByHole.get(rh.hole) ?? new Map<SgCategory, number>();
    const sgByCategory: Partial<Record<SgCategory, number>> = {};
    let worstCategory: SgCategory | null = null;
    let worstSg = 0;
    for (const c of SG_CATEGORIES) {
      if (!catMap.has(c)) continue;
      const v = catMap.get(c) as number;
      sgByCategory[c] = v;
      if (v < worstSg) {
        worstSg = v;
        worstCategory = c;
      }
    }

    out.push({
      hole: rh.hole,
      par: rh.par,
      strokes,
      vsPar: strokes == null ? null : strokes - rh.par,
      sgByCategory,
      worstCategory,
      hasBadDecision: rh.shots.some((s) => s.decision_quality === "Bad"),
      conceded: rh.conceded,
      // Full coverage = every shot on the hole produced SG.
      sgCovered:
        rh.shots.length > 0 &&
        (coveredByHole.get(rh.hole) ?? 0) === rh.shots.length,
      rootCauseShotNo: dominoByHole.get(rh.hole)?.rootCauseShotNo ?? null,
      rootCauseCategory: dominoByHole.get(rh.hole)?.rootCauseCategory ?? null,
      recoveryShotNos: dominoByHole.get(rh.hole)?.recoveryShotNos ?? [],
    });
  }

  out.sort((a, b) => a.hole - b.hole);
  return out;
}

/** Minimum SG swing (vs your average, over the whole round) worth a headline. */
const TAKEAWAY_SG_THRESHOLD = 0.5;

function fmtSg(d: number): string {
  return `${d >= 0 ? "+" : MINUS}${Math.abs(d).toFixed(1)}`;
}

function fmtVsPar(vsPar: number): string {
  if (vsPar === 0) return "even par";
  return vsPar > 0 ? `+${vsPar}` : `${MINUS}${Math.abs(vsPar)}`;
}

/**
 * One conservative headline for the round, derived from the cross-round
 * breakdown (`computeRoundBreakdowns`).
 *
 * Below the comparison floor (`eligible === false`) we never invent a delta —
 * we state a raw fact instead: this round's score relative to par over the
 * holes played.
 */
export function roundTakeaway(breakdown: RoundBreakdown): string {
  if (!breakdown.eligible) {
    const score = breakdown.metrics.find((m) => m.key === "score");
    const holes = breakdown.holes;
    const holeLabel = `${holes} hole${holes === 1 ? "" : "s"}`;
    if (score) {
      return `${fmtVsPar(score.value)} over ${holeLabel}, and a few more rounds will show how this one compares.`;
    }
    return `${holeLabel} logged, and a few more rounds will show how this one compares.`;
  }

  // Largest eligible SG swing vs your average decides the headline.
  const sgMetrics = breakdown.metrics.filter(
    (m) => m.kind === "sg" && m.delta != null,
  );
  let best: (typeof sgMetrics)[number] | null = null;
  for (const m of sgMetrics) {
    if (best == null || Math.abs(m.delta as number) > Math.abs(best.delta as number)) {
      best = m;
    }
  }

  if (!best || Math.abs(best.delta as number) < TAKEAWAY_SG_THRESHOLD) {
    return "A steady round, nothing strayed far from your average.";
  }

  const d = best.delta as number;
  const swing = fmtSg(d);
  return d > 0
    ? `${best.label} carried this round, ${swing} vs your average.`
    : `${best.label} was the leak this round, ${swing} vs your average.`;
}
