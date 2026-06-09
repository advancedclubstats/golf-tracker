/**
 * Server-side loader for strokes gained: fetches via lib/db, defaults skipped
 * tee distances from course geometry, and computes SG. Kept out of
 * lib/analytics (which stays pure / Supabase-free); this is the composition
 * layer shared by the dashboard and the SG stats page.
 */

import { getAllShots } from "@/lib/db/shots";
import { getAllRounds } from "@/lib/db/rounds";
import { getAllCourseTees, getAllTeeYardages } from "@/lib/db/courses";
import {
  computeStrokesGained,
  fillTeeDistances,
  type StrokesGained,
} from "@/lib/analytics/sg";
import { computeLeaks, type Leak } from "@/lib/analytics/leaks";
import {
  computeHoleAttribution,
  type HoleAttribution,
} from "@/lib/analytics/holeAttribution";
import type { ShotRow } from "@/lib/schemas/shot";
import type { RoundRow } from "@/lib/schemas/round";

/** round_id → hole → representative tee yardage (avg across a course's tees). */
function buildTeeYardages(
  rounds: { id: string; course_id: string | null }[],
  tees: { id: string; course_id: string }[],
  yardages: { tee_id: string; hole_number: number; yardage: number }[],
): Record<string, Record<number, number>> {
  const teeCourse = new Map(tees.map((t) => [t.id, t.course_id]));
  const byCourseHole: Record<string, Record<number, number[]>> = {};
  for (const y of yardages) {
    const course = teeCourse.get(y.tee_id);
    if (!course) continue;
    ((byCourseHole[course] ??= {})[y.hole_number] ??= []).push(y.yardage);
  }
  const repByCourse: Record<string, Record<number, number>> = {};
  for (const [course, holes] of Object.entries(byCourseHole)) {
    repByCourse[course] = {};
    for (const [hole, arr] of Object.entries(holes)) {
      repByCourse[course][Number(hole)] = Math.round(
        arr.reduce((a, b) => a + b, 0) / arr.length,
      );
    }
  }
  const out: Record<string, Record<number, number>> = {};
  for (const r of rounds) {
    if (r.course_id && repByCourse[r.course_id]) out[r.id] = repByCourse[r.course_id];
  }
  return out;
}

/**
 * Fetch all shots and fill skipped tee distances from course geometry — the
 * shared input for every SG-derived view (categories, leaks, hole attribution).
 * Pass already-fetched shots/rounds to avoid a redundant query.
 */
export async function getEnrichedShots(prefetched?: {
  shots: ShotRow[];
  rounds: RoundRow[];
}): Promise<{ shots: ShotRow[]; rounds: RoundRow[] }> {
  const [shots, rounds] = prefetched
    ? [prefetched.shots, prefetched.rounds]
    : await Promise.all([getAllShots(), getAllRounds()]);
  const [tees, yardages] = await Promise.all([
    getAllCourseTees(),
    getAllTeeYardages(),
  ]);
  const enriched = fillTeeDistances(shots, buildTeeYardages(rounds, tees, yardages));
  return { shots: enriched, rounds };
}

/**
 * Compute strokes gained across all rounds. Pass already-fetched shots/rounds
 * (e.g. the dashboard already has them) to avoid a redundant query.
 */
export async function getStrokesGained(prefetched?: {
  shots: ShotRow[];
  rounds: RoundRow[];
}): Promise<StrokesGained> {
  const { shots } = await getEnrichedShots(prefetched);
  return computeStrokesGained(shots);
}

/** Ranked, sample-gated leaks (spec Part 3). Shares the SG tee-fill. */
export async function getLeaks(prefetched?: {
  shots: ShotRow[];
  rounds: RoundRow[];
}): Promise<{ leaks: Leak[]; rounds: number }> {
  const { shots } = await getEnrichedShots(prefetched);
  return computeLeaks(shots);
}

/** Per-hole SG attribution (spec Part 3, the killer screen). Shares the tee-fill. */
export async function getHoleAttribution(prefetched?: {
  shots: ShotRow[];
  rounds: RoundRow[];
}): Promise<HoleAttribution[]> {
  const { shots } = await getEnrichedShots(prefetched);
  return computeHoleAttribution(shots);
}
