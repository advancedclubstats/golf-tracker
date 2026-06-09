/**
 * Hole-level SG attribution (spec Part 3, "the killer screen").
 *
 * For each hole the player has completed: actual average score, the gap vs par,
 * and the **SG breakdown for that specific hole** (tee / approach / short /
 * putt). Reads as "Hole 7 costs +0.89/round — 70% approach, 30% tee": knowledge
 * (which hole) + cause (which part of the game) in one row. No commercial app
 * can produce this because none has the player's own repeated history on these
 * exact holes — architect for it (this is the seam the 2B self-baseline feeds).
 *
 * Score average and SG are both computed over the *same* complete-hole set so
 * the "cost vs par" and the SG breakdown reconcile. Pure; builds on perShotSG
 * and the core round-hole aggregation.
 */

import { aggregateByRoundHole, enrichRoundHole } from "@/lib/analytics/core";
import { perShotSG, SG_CATEGORIES, type SgCategory } from "@/lib/analytics/sg";
import type { ShotRow } from "@/lib/schemas/shot";

export interface HoleCategorySG {
  category: SgCategory;
  /** Total SG for this category on this hole (negative = a loss). */
  sg: number;
  perRound: number;
  shots: number;
  /** Share of the hole's total *loss* (0–1), or null if the hole isn't losing. */
  lossShare: number | null;
}

export interface HoleAttribution {
  hole: number;
  par: number;
  /** Complete rounds of this hole. */
  rounds: number;
  avgScore: number;
  /** Cost per round vs par (actual avg − par; positive = over par). */
  avgVsPar: number;
  /** Total SG on this hole and per round (negative = losing vs scratch). */
  totalSg: number;
  sgPerRound: number;
  categories: HoleCategorySG[];
  /** The biggest-losing category and its share of the hole's loss. */
  worstCategory: SgCategory | null;
  worstShare: number | null;
}

/**
 * Per-hole SG attribution across all rounds, ranked by cost/round (worst first).
 * Only complete holes count (a hole "counts" when its last shot holed out).
 */
export function computeHoleAttribution(shots: readonly ShotRow[]): HoleAttribution[] {
  // Complete (round, hole) set + per-hole score aggregation.
  const complete = aggregateByRoundHole(shots)
    .filter((r) => r.complete)
    .map(enrichRoundHole);
  if (complete.length === 0) return [];

  const completeKeys = new Set(complete.map((r) => `${r.roundId}|${r.hole}`));

  interface ScoreAgg {
    par: number;
    rounds: number;
    strokes: number;
    parTotal: number;
  }
  const score = new Map<number, ScoreAgg>();
  for (const r of complete) {
    let a = score.get(r.hole);
    if (!a) {
      a = { par: r.par, rounds: 0, strokes: 0, parTotal: 0 };
      score.set(r.hole, a);
    }
    a.rounds++;
    a.strokes += r.strokes;
    a.parTotal += r.par;
  }

  // SG per (hole, category), restricted to shots on complete holes.
  const { entries } = perShotSG(shots);
  const sgByHole = new Map<number, Map<SgCategory, { sg: number; shots: number }>>();
  for (const { shot, sg, category } of entries) {
    if (!completeKeys.has(`${shot.round_id}|${shot.hole}`)) continue;
    let m = sgByHole.get(shot.hole);
    if (!m) {
      m = new Map();
      sgByHole.set(shot.hole, m);
    }
    const cur = m.get(category) ?? { sg: 0, shots: 0 };
    cur.sg += sg;
    cur.shots++;
    m.set(category, cur);
  }

  const out: HoleAttribution[] = [];
  for (const [hole, agg] of score) {
    const cats = sgByHole.get(hole) ?? new Map();
    // Total loss (negative SG only) for computing each category's share.
    let totalLoss = 0;
    for (const c of SG_CATEGORIES) {
      const v = cats.get(c);
      if (v && v.sg < 0) totalLoss += v.sg;
    }
    const categories: HoleCategorySG[] = SG_CATEGORIES.map((category) => {
      const v = cats.get(category) ?? { sg: 0, shots: 0 };
      return {
        category,
        sg: v.sg,
        perRound: agg.rounds > 0 ? v.sg / agg.rounds : 0,
        shots: v.shots,
        lossShare: totalLoss < 0 && v.sg < 0 ? v.sg / totalLoss : null,
      };
    });
    const totalSg = categories.reduce((s, c) => s + c.sg, 0);
    const worst = categories
      .filter((c) => c.sg < 0)
      .sort((a, b) => a.sg - b.sg)[0];

    out.push({
      hole,
      par: agg.par,
      rounds: agg.rounds,
      avgScore: agg.strokes / agg.rounds,
      avgVsPar: (agg.strokes - agg.parTotal) / agg.rounds,
      totalSg,
      sgPerRound: agg.rounds > 0 ? totalSg / agg.rounds : 0,
      categories,
      worstCategory: worst?.category ?? null,
      worstShare: worst?.lossShare ?? null,
    });
  }

  // Worst hole first: most strokes over par per round.
  out.sort((a, b) => b.avgVsPar - a.avgVsPar);
  return out;
}
