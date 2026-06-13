/**
 * Momentum (dashboard Ask 1) — the *motion* paired with the static SG picture.
 *
 * For each SG category it splits the recent N rounds against the prior N (the
 * "did it move, and which way" reading) and emits a `gaining`/`slipping` entry —
 * but only when there's a real split (≥ 2N rounds of data) AND the move is
 * meaningful (|delta| ≥ MEANINGFUL). Below the floor a category is ABSENT, never
 * guessed (honesty rule). See `docs/design/design_handoff_momentum/`.
 *
 * Per-round category SG = the sum of that category's per-shot SG in the round
 * (its per-round contribution); the trend means average those over N rounds.
 * Pure; builds on `perShotSG` + `computeStrokesGained` (for the all-time leak
 * ranking that drives the tag).
 */

import type { ShotRow } from "@/lib/schemas/shot";
import type { RoundRow } from "@/lib/schemas/round";
import {
  perShotSG,
  computeStrokesGained,
  SG_CATEGORIES,
  type SgCategory,
} from "@/lib/analytics/sg";

/** Minimum |delta| (SG/round) for a category to surface as momentum. */
const MEANINGFUL = 0.15;

export type MomentumTag = "work" | "weapon" | "accel" | "new";

export interface MomentumEntry {
  category: SgCategory;
  /** recentMean − priorMean, in SG/round (positive = gaining). */
  delta: number;
  recentMean: number;
  priorMean: number;
  /** Last 2N per-round category-SG values, oldest → newest (drives the sparkline). */
  points: number[];
  /** Rounds of data this category has (≥ floor to be eligible). */
  sampleCount: number;
  bucket: "gaining" | "slipping";
  tag: MomentumTag;
  /** 1-based rank among all-time leaks (most negative first), or null if a strength. */
  leakRank: number | null;
}

export interface Momentum {
  windowN: number;
  /** 2 × windowN — the data floor for any trend. */
  floor: number;
  gaining: MomentumEntry[];
  slipping: MomentumEntry[];
  /** Highest round-count any single category reached (for the early-state progress). */
  bestSample: number;
  /** True when ≥1 category is eligible (the populated state). */
  populated: boolean;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function computeMomentum(
  shots: readonly ShotRow[],
  rounds: readonly Pick<RoundRow, "id" | "date">[],
  windowN = 5,
): Momentum {
  const floor = windowN * 2;

  // Order the rounds that actually have shots, oldest → newest.
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

  // All-time standing → leak rank (negative SG, most negative = #1) for the tag.
  const byCategory = computeStrokesGained(shots).byCategory;
  const leakRankOf = new Map<SgCategory, number>(
    byCategory
      .filter((c) => c.shots > 0 && c.sg < 0)
      .sort((a, b) => a.sg - b.sg)
      .map((c, i) => [c.category, i + 1]),
  );

  let bestSample = 0;
  const all: MomentumEntry[] = [];
  for (const category of SG_CATEGORIES) {
    const vals = (series.get(category) ?? []).filter((v): v is number => v !== undefined);
    bestSample = Math.max(bestSample, vals.length);
    if (vals.length < floor) continue; // honesty floor — no split, no trend

    const recentMean = mean(vals.slice(-windowN));
    const priorMean = mean(vals.slice(-floor, -windowN));
    const delta = recentMean - priorMean;
    if (Math.abs(delta) < MEANINGFUL) continue; // didn't move meaningfully

    const bucket: MomentumEntry["bucket"] = delta >= 0 ? "gaining" : "slipping";
    const leakRank = leakRankOf.get(category) ?? null;
    const isLeak = leakRank != null;
    const tag: MomentumTag =
      bucket === "gaining" ? (isLeak ? "work" : "weapon") : isLeak ? "accel" : "new";

    all.push({
      category,
      delta,
      recentMean,
      priorMean,
      points: vals.slice(-floor),
      sampleCount: vals.length,
      bucket,
      tag,
      leakRank,
    });
  }

  const byMag = (a: MomentumEntry, b: MomentumEntry) => Math.abs(b.delta) - Math.abs(a.delta);
  return {
    windowN,
    floor,
    gaining: all.filter((e) => e.bucket === "gaining").sort(byMag),
    slipping: all.filter((e) => e.bucket === "slipping").sort(byMag),
    bestSample,
    populated: all.length > 0,
  };
}
