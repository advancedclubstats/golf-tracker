/**
 * Recent form — the second denominator the round-recall exit needs.
 *
 * All-time SG is a cumulative mean over a large, growing N: each new round moves
 * it 0.03–0.05, so it sits near-frozen and answers "where do I actually stand."
 * That's the wrong denominator for the moment of entry ("did tonight matter, and
 * what's happening with my game right now"). This helper computes the *fast*
 * denominator: per SG category, the mean per-round SG over the last N rounds vs
 * the prior N — a window small enough to move visibly.
 *
 * Same machinery + chronological round ordering as `momentum.ts` (which can
 * later consume this instead of recomputing its own series). Pure over plain
 * arrays, zero Supabase imports (D-05).
 *
 * Honesty floor (never a guess, never a zero):
 *   - below N rounds of data in a category → `recentMean` is null,
 *   - below 2N (no real split) → `priorMean` and `delta` are null.
 * `allTimeMean` is the cumulative per-round mean (the near-frozen figure the
 * hero shows today), always present so a consumer can sit the two side by side.
 */

import type { ShotRow } from "@/lib/schemas/shot";
import type { RoundRow } from "@/lib/schemas/round";
import { perShotSG, SG_CATEGORIES, type SgCategory } from "@/lib/analytics/sg";

export interface RecentFormCategory {
  /** Mean per-round SG over the last N rounds; null below N. */
  recentMean: number | null;
  /** Mean per-round SG over the prior N rounds; null below 2N. */
  priorMean: number | null;
  /** recentMean − priorMean (positive = trending better); null below 2N. */
  delta: number | null;
  /** Cumulative per-round mean over every round with data (the near-frozen figure). */
  allTimeMean: number;
  /** Rounds of data this category has. */
  sampleCount: number;
}

export interface RecentForm {
  windowN: number;
  byCategory: Record<SgCategory, RecentFormCategory>;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * The shots from every round up to and including `roundId`, chronologically.
 * Lets a consumer read recent form *as of* a given round rather than today's
 * global state (so an old round's exit beat reflects the form that existed
 * right after it). Returns the input unchanged if the round isn't found.
 */
export function shotsThroughRound(
  shots: readonly ShotRow[],
  rounds: readonly Pick<RoundRow, "id" | "date">[],
  roundId: string,
): ShotRow[] {
  const ordered = [...rounds].sort((a, b) => {
    const da = new Date(a.date).getTime() || 0;
    const db = new Date(b.date).getTime() || 0;
    if (da !== db) return da - db;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const idx = ordered.findIndex((r) => r.id === roundId);
  if (idx < 0) return [...shots];
  const throughIds = new Set(ordered.slice(0, idx + 1).map((r) => r.id));
  return shots.filter((s) => throughIds.has(s.round_id));
}

export function recentForm(
  shots: readonly ShotRow[],
  rounds: readonly Pick<RoundRow, "id" | "date">[],
  { windowN = 5 }: { windowN?: number } = {},
): RecentForm {
  const floor = windowN * 2;

  // Order the rounds that actually have shots, oldest → newest (same as momentum).
  const dateOf = new Map(rounds.map((r) => [r.id, r.date]));
  const roundIds = [...new Set(shots.map((s) => s.round_id))];
  roundIds.sort((a, b) => {
    const da = new Date(dateOf.get(a) ?? 0).getTime() || 0;
    const db = new Date(dateOf.get(b) ?? 0).getTime() || 0;
    return da - db;
  });
  const roundIndex = new Map(roundIds.map((id, i) => [id, i]));

  // Per-round per-category SG sum over covered shots.
  const series = new Map<SgCategory, (number | undefined)[]>(
    SG_CATEGORIES.map((c) => [c, roundIds.map(() => undefined)]),
  );
  for (const { shot, sg, category } of perShotSG(shots).entries) {
    const ri = roundIndex.get(shot.round_id);
    if (ri == null) continue;
    const arr = series.get(category)!;
    arr[ri] = (arr[ri] ?? 0) + sg;
  }

  const byCategory = {} as Record<SgCategory, RecentFormCategory>;
  for (const category of SG_CATEGORIES) {
    const vals = (series.get(category) ?? []).filter((v): v is number => v !== undefined);
    const n = vals.length;
    const recentMean = n >= windowN ? mean(vals.slice(-windowN)) : null;
    const priorMean = n >= floor ? mean(vals.slice(-floor, -windowN)) : null;
    const delta = recentMean != null && priorMean != null ? recentMean - priorMean : null;
    byCategory[category] = {
      recentMean,
      priorMean,
      delta,
      allTimeMean: mean(vals),
      sampleCount: n,
    };
  }

  return { windowN, byCategory };
}

/** The single most meaningful mover this round (drives the exit beat's copy). */
export interface RecentFormMove {
  category: SgCategory;
  recentMean: number;
  priorMean: number;
  delta: number;
  windowN: number;
}

/**
 * Minimum |delta| (SG/round) for a category to count as a move — the same
 * meaningfulness gate `momentum.ts` uses, so the two never disagree.
 */
export const MOVE_THRESHOLD = 0.15;

/**
 * The one category that moved most (by |delta|) above the threshold and the 2N
 * floor, or null when nothing moved meaningfully. One mover, never a list —
 * the recall exit shows at most one beat.
 */
export function topRecentFormMove(
  form: RecentForm,
  threshold = MOVE_THRESHOLD,
): RecentFormMove | null {
  let best: RecentFormMove | null = null;
  for (const category of SG_CATEGORIES) {
    const c = form.byCategory[category];
    if (c.delta == null || c.recentMean == null || c.priorMean == null) continue;
    if (Math.abs(c.delta) < threshold) continue;
    if (best == null || Math.abs(c.delta) > Math.abs(best.delta)) {
      best = {
        category,
        recentMean: c.recentMean,
        priorMean: c.priorMean,
        delta: c.delta,
        windowN: form.windowN,
      };
    }
  }
  return best;
}
