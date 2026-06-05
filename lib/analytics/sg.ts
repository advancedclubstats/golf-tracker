/**
 * Strokes-gained analytics (P5).
 *
 * Pure, typed. Zero Supabase imports (D-05). Reads the materialized shot chain
 * — `start_lie` is stored per shot (migrations 007/008), so SG needs no
 * carry-forward derivation here: the finish state of shot N is simply the start
 * state of shot N+1.
 *
 *   SG(shot) = E[start_lie, start_dist] − E[finish] − 1 − penalty
 *   E[finish] = 0 if holed, else E[next.start_lie, next.start_dist]
 *
 * A shot is "covered" only when both its own and its successor's
 * (lie, distance) resolve to a baseline — a missing distance therefore drops
 * the shot AND its predecessor's finish term (the two-shot cost).
 */

import type { ShotRow } from "@/lib/schemas/shot";
import type { StartLie, Situation } from "@/lib/constants";
import { expectedStrokes } from "@/lib/analytics/sg-baseline";

export const SG_CATEGORIES = [
  "Off the tee",
  "Approach",
  "Short game",
  "Putting",
] as const;
export type SgCategory = (typeof SG_CATEGORIES)[number];

const SAND_LIES = new Set<StartLie>(["Greenside bunker", "Sand", "Fairway bunker"]);

/** Which SG bucket a shot belongs to, from its start lie + distance + par. */
export function categoryOf(
  lie: StartLie | null,
  yards: number | null,
  par: number,
): SgCategory {
  if (lie === "Green") return "Putting";
  if (lie === "Tee") return par >= 4 ? "Off the tee" : "Approach";
  if (lie != null && SAND_LIES.has(lie)) {
    return (yards ?? Infinity) <= 50 ? "Short game" : "Approach";
  }
  if (lie === "Recovery" || lie === "Native") return "Approach";
  return (yards ?? Infinity) <= 30 ? "Short game" : "Approach";
}

export interface SgCategorySummary {
  category: SgCategory;
  shots: number;
  sg: number;
  /** SG per round (sg / rounds), the interpretable figure. */
  perRound: number;
}

export interface SgSituationSummary {
  situation: Situation;
  shots: number;
  sg: number;
}

export interface StrokesGained {
  byCategory: SgCategorySummary[];
  total: number;
  perRound: number;
  rounds: number;
  coveredShots: number;
  totalShots: number;
  /** Biggest leak: the category losing the most (most-negative SG). */
  worst: SgCategorySummary | null;
  /** Domino view: SG grouped by the situation a shot created (forward data). */
  situations: SgSituationSummary[];
}

/**
 * Fill the distance-to-hole for tee shots that skipped it (the wizard skips
 * yardage for driver/wood tee shots; history never captured it). Uses the
 * course hole yardage so off-the-tee SG is computable. `teeYardsByRoundHole`
 * maps round_id → hole → yards. Pure; only touches shot 1 with no yardage.
 */
export function fillTeeDistances(
  shots: readonly ShotRow[],
  teeYardsByRoundHole: Record<string, Record<number, number>>,
): ShotRow[] {
  return shots.map((s) => {
    if (s.shot_no === 1 && s.yardage == null) {
      const y = teeYardsByRoundHole[s.round_id]?.[s.hole];
      if (y != null) return { ...s, yardage: y };
    }
    return s;
  });
}

/** SG for a single shot given its successor (or null if it holed out). */
export function shotSG(shot: ShotRow, next: ShotRow | null): number | null {
  const startE = expectedStrokes(shot.start_lie, shot.yardage);
  if (startE == null) return null;
  const finishE =
    shot.result === "Make" ? 0 : next ? expectedStrokes(next.start_lie, next.yardage) : null;
  if (finishE == null) return null;
  return startE - finishE - 1 - (shot.penalty ?? 0);
}

/** Compute strokes gained across all shots, by category + situation. */
export function computeStrokesGained(shots: readonly ShotRow[]): StrokesGained {
  // Group by round+hole, ordered by shot number, to chain finish → next start.
  const holes = new Map<string, ShotRow[]>();
  const roundIds = new Set<string>();
  for (const s of shots) {
    roundIds.add(s.round_id);
    const key = `${s.round_id}|${s.hole}`;
    const arr = holes.get(key);
    if (arr) arr.push(s);
    else holes.set(key, [s]);
  }

  const cat = new Map<SgCategory, { shots: number; sg: number }>();
  const sit = new Map<Situation, { shots: number; sg: number }>();
  let total = 0;
  let covered = 0;
  let totalShots = 0;

  for (const holeShots of holes.values()) {
    holeShots.sort((a, b) => a.shot_no - b.shot_no);
    for (let i = 0; i < holeShots.length; i++) {
      totalShots++;
      const shot = holeShots[i];
      const sg = shotSG(shot, holeShots[i + 1] ?? null);
      if (sg == null) continue;
      covered++;
      total += sg;
      const c = categoryOf(shot.start_lie, shot.yardage, shot.par);
      const cur = cat.get(c) ?? { shots: 0, sg: 0 };
      cur.shots++;
      cur.sg += sg;
      cat.set(c, cur);
      if (shot.situation_created) {
        const s = sit.get(shot.situation_created) ?? { shots: 0, sg: 0 };
        s.shots++;
        s.sg += sg;
        sit.set(shot.situation_created, s);
      }
    }
  }

  const rounds = roundIds.size;
  const byCategory: SgCategorySummary[] = SG_CATEGORIES.map((category) => {
    const v = cat.get(category) ?? { shots: 0, sg: 0 };
    return {
      category,
      shots: v.shots,
      sg: v.sg,
      perRound: rounds > 0 ? v.sg / rounds : 0,
    };
  });

  const withShots = byCategory.filter((c) => c.shots > 0);
  const worst =
    withShots.length > 0
      ? withShots.reduce((a, b) => (b.sg < a.sg ? b : a))
      : null;

  const situations: SgSituationSummary[] = [...sit.entries()].map(
    ([situation, v]) => ({ situation, shots: v.shots, sg: v.sg }),
  );

  return {
    byCategory,
    total,
    perRound: rounds > 0 ? total / rounds : 0,
    rounds,
    coveredShots: covered,
    totalShots,
    worst,
    situations,
  };
}
