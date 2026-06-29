/**
 * Clean streaks — the "Tiger 5" tracker, inverted to a positive frame.
 *
 * For each classic mistake category we track how long the player has gone
 * *without* committing it: a **current** run and the **personal best** run.
 * Reframed from "holes since the mistake" to "opportunities clean", because
 * counting raw holes inflates the rare-event categories (a par-5 bogey can only
 * happen on a par 5, so "30 holes" is really ~6 par 5s). Each metric counts its
 * own opportunity and the UI names it — same honesty rule as Momentum's
 * "/rd · last 5 rounds" denominators.
 *
 * Definitions are deliberately reused from the existing analytics so nothing
 * drifts:
 *   - bogey/double thresholds come straight off `strokes` vs `par`,
 *   - 3-putt is `putts >= 3` (the `isRealPutt` count via `enrichRoundHole`),
 *   - the ≤150 approach filter mirrors distanceSummary sub-table 5
 *     (non-putt, not a par-4/5 tee shot, 30–150 yds),
 *   - up-&-down conversion mirrors distanceSummary sub-table 4 / D-06
 *     (a <30 yd greenside shot that holes out, or whose next shot is a made putt).
 *
 * Pure over plain arrays; zero Supabase imports (D-05). Holes are ordered
 * chronologically (round date asc, then hole asc) — the same ordering
 * `momentum.ts` uses.
 */

import { aggregateByRoundHole, enrichRoundHole } from "@/lib/analytics/core";
import type { EnrichedRoundHole } from "@/lib/analytics/core";
import type { ShotRow } from "@/lib/schemas/shot";
import type { RoundRow } from "@/lib/schemas/round";

export interface Streak {
  key:
    | "par5Bogey"
    | "double"
    | "threePutt"
    | "approach150"
    | "upDown";
  /** Headline label, e.g. "Bogey-free par 5s". */
  label: string;
  /** The opportunity unit shown next to the number, e.g. "par 5s". */
  unit: string;
  /** Current trailing run of clean opportunities. */
  current: number;
  /** Longest such run ever (the personal best). */
  best: number;
  /** Total opportunities seen (0 → nothing logged yet; render an em-dash). */
  opportunities: number;
  /** True when the current run equals the all-time best (a live record). */
  isRecord: boolean;
}

/**
 * The single forward target the dashboard hunts: the streak closest to beating
 * its own record. `currentRun`/`personalBest`/`toGo` are the chase-framed names
 * for the same `current`/`best`/gap the rows below carry.
 */
export interface Chase {
  key: Streak["key"];
  label: string;
  unit: string;
  currentRun: number;
  personalBest: number;
  /** personalBest − currentRun; always > 0 for a surfaced chase. */
  toGo: number;
}

export interface Streaks {
  metrics: Streak[];
  /** The one streak to chase, or null when nothing clears the floor. */
  chase: Chase | null;
}

/**
 * A record is only worth hunting once it's this long — below it a "chase" would
 * be noise (e.g. "1 to go" toward a best of 2). Same honesty instinct as the
 * other analytics floors: a thin record is no target at all.
 */
export const CHASE_MIN_BEST = 3;

/**
 * Tie-break order when two streaks are equally close to their record: the
 * costlier mistake wins the slot. A double or 3-putt hurts more than a missed
 * up-&-down, so we surface the one you'd least want to break.
 */
const STAKES_ORDER: readonly Streak["key"][] = [
  "double",
  "threePutt",
  "par5Bogey",
  "approach150",
  "upDown",
];

/**
 * Pick the active chase: among streaks whose record clears the floor and isn't
 * already tied, the one with the smallest positive gap to its best (ties broken
 * toward the higher-stakes category). Null when nothing qualifies — an honest
 * empty state, never a manufactured goal. Pure (D-05).
 */
export function selectChase(metrics: readonly Streak[]): Chase | null {
  const candidates = metrics.filter(
    (m) => m.opportunities > 0 && m.best >= CHASE_MIN_BEST && m.current < m.best,
  );
  if (candidates.length === 0) return null;

  const pick = candidates.reduce((a, b) => {
    const gapA = a.best - a.current;
    const gapB = b.best - b.current;
    if (gapA !== gapB) return gapA < gapB ? a : b;
    return STAKES_ORDER.indexOf(a.key) <= STAKES_ORDER.indexOf(b.key) ? a : b;
  });

  return {
    key: pick.key,
    label: pick.label,
    unit: pick.unit,
    currentRun: pick.current,
    personalBest: pick.best,
    toGo: pick.best - pick.current,
  };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Collapse an ordered sequence of opportunity outcomes (true = clean/converted)
 * into the current trailing run and the longest run.
 */
function runs(flags: readonly boolean[]): {
  current: number;
  best: number;
  opportunities: number;
} {
  let best = 0;
  let run = 0;
  for (const f of flags) {
    if (f) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  let current = 0;
  for (let i = flags.length - 1; i >= 0 && flags[i]; i--) current++;
  return { current, best, opportunities: flags.length };
}

/** A <30 yd greenside shot we'd count as an up-&-down attempt (not a par-4/5 tee). */
function isGreensideAttempt(s: ShotRow, par: number): boolean {
  if (s.club === "Putter") return false;
  if (s.shot_no === 1 && par !== 3) return false; // tee on par 4/5
  return isNum(s.yardage) && s.yardage >= 0 && s.yardage < 30;
}

/** Did this hole include a real ≤150 yd approach (mirrors distanceSummary §5, capped). */
function hasApproachUnder150(h: EnrichedRoundHole): boolean {
  return h.shots.some(
    (s) =>
      s.club !== "Putter" &&
      !(s.shot_no === 1 && h.par !== 3) && // tee on par 4/5
      isNum(s.yardage) &&
      s.yardage >= 30 &&
      s.yardage <= 150,
  );
}

export function computeStreaks(
  shots: readonly ShotRow[],
  rounds: readonly Pick<RoundRow, "id" | "date">[],
): Streaks {
  const dateOf = new Map(rounds.map((r) => [r.id, r.date]));

  const holes = aggregateByRoundHole(shots)
    .filter((r) => r.complete && !r.conceded)
    .map(enrichRoundHole)
    .sort((a, b) => {
      const da = new Date(dateOf.get(a.roundId) ?? 0).getTime() || 0;
      const db = new Date(dateOf.get(b.roundId) ?? 0).getTime() || 0;
      if (da !== db) return da - db;
      return a.hole - b.hole;
    });

  // Hole-level opportunity flags (true = clean).
  const par5Flags = holes.filter((h) => h.par === 5).map((h) => h.strokes <= h.par);
  const doubleFlags = holes.map((h) => h.strokes <= h.par + 1);
  const threePuttFlags = holes.map((h) => h.putts < 3);
  const approachFlags = holes
    .filter(hasApproachUnder150)
    .map((h) => h.strokes <= h.par);

  // Shot-level up-&-down attempts, in hole-then-shot order.
  const upDownFlags: boolean[] = [];
  for (const h of holes) {
    for (let i = 0; i < h.shots.length; i++) {
      const s = h.shots[i];
      if (!isGreensideAttempt(s, h.par)) continue;
      const next = h.shots[i + 1];
      const converted =
        s.result === "Make" ||
        (next != null && next.club === "Putter" && next.result === "Make");
      upDownFlags.push(converted);
    }
  }

  const build = (
    key: Streak["key"],
    label: string,
    unit: string,
    flags: readonly boolean[],
  ): Streak => {
    const { current, best, opportunities } = runs(flags);
    return {
      key,
      label,
      unit,
      current,
      best,
      opportunities,
      isRecord: best > 0 && current === best,
    };
  };

  const metrics = [
    build("par5Bogey", "Bogey-free par 5s", "par 5s", par5Flags),
    build("double", "Double-free holes", "holes", doubleFlags),
    build("threePutt", "3-putt-free holes", "holes", threePuttFlags),
    build("approach150", "Bogey-free approaches ≤150y", "approaches", approachFlags),
    build("upDown", "Up-&-downs in a row", "up & downs", upDownFlags),
  ];

  return { metrics, chase: selectChase(metrics) };
}
