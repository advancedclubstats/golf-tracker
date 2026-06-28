/**
 * Practice-game scoring — pure functions, zero Supabase (D-05).
 *
 * Everything here operates on plain typed arrays so it is independently testable
 * and shares the round engine's baseline. The core insight (DL-022): SG to
 * hole-out needs only the start state (yards + lie, from the game registry) and
 * the strokes taken — never shot-by-shot — so entry is one number per ball.
 *
 *   SG(ball) = expected_to_hole(yards, lie) − strokes_taken
 *
 * Positive = you holed out in fewer strokes than a scratch golfer is expected to
 * from there; negative = worse.
 *
 * Baseline caveat (DL-022, same posture as DL-002): the 90/70/50 wedge expected-
 * strokes come from the long-game scratch tables in `sg-baseline.ts`, which are
 * marked VERIFY. So leaderboard-by-strokes is robust today; the SG magnitude is
 * provisional — show it, don't over-trust the exact number in copy.
 */

import { expectedStrokes } from "@/lib/analytics/sg-baseline";
import { gamePar, totalBalls, type PracticeGame } from "@/lib/practice/games";

/** Per-station score, derived (nothing stored — D-01). */
export interface StationScore {
  readonly stationIndex: number;
  readonly yards: number;
  readonly balls: number;
  /** Total strokes across this station's balls. */
  readonly strokes: number;
  /** Par for the station (parPerBall × balls). */
  readonly par: number;
  /** strokes − par (negative is good). */
  readonly scoreToPar: number;
  /**
   * Total SG vs scratch across the station's balls, or null if the lie/yardage
   * has no baseline (so we never fake a number).
   */
  readonly sg: number | null;
}

/** Whole-game score, derived. */
export interface GameScore {
  readonly stations: readonly StationScore[];
  readonly balls: number;
  readonly strokes: number;
  readonly par: number;
  /** strokes − par (negative is good) — the headline number to beat. */
  readonly scoreToPar: number;
  /** Total SG across all covered balls; null if no station had a baseline. */
  readonly sg: number | null;
  /**
   * True when every ball was holed in at most par strokes — a clean card
   * (DL-023 "clean sweep" achievement).
   */
  readonly cleanSweep: boolean;
}

/**
 * Score one session. `strokesByStation[i]` is the per-ball strokes for station
 * `i` (length should match the station's `balls`, but extra/short arrays are
 * tolerated — we score the balls we're given).
 */
export function scoreGame(
  game: PracticeGame,
  strokesByStation: readonly (readonly number[])[],
): GameScore {
  const stations: StationScore[] = game.stations.map((station, i) => {
    const ballStrokes = strokesByStation[i] ?? [];
    const strokes = ballStrokes.reduce((sum, s) => sum + s, 0);
    const par = game.parPerBall * station.balls;
    const expected = expectedStrokes(station.lie, station.yards);
    // SG only when the baseline covers this lie/yardage; sum per ball so an
    // uncovered station drops out of the total rather than zeroing it.
    const sg =
      expected == null
        ? null
        : ballStrokes.reduce((sum, s) => sum + (expected - s), 0);
    return {
      stationIndex: i,
      yards: station.yards,
      balls: station.balls,
      strokes,
      par,
      scoreToPar: strokes - par,
      sg,
    };
  });

  const strokes = stations.reduce((sum, st) => sum + st.strokes, 0);
  const par = gamePar(game);
  const covered = stations.filter((st) => st.sg != null);
  const sg = covered.length === 0 ? null : covered.reduce((sum, st) => sum + (st.sg as number), 0);

  // Clean sweep: every ball at or under par. Only meaningful once the full game
  // has been entered.
  const allBalls = strokesByStation.flat();
  const cleanSweep =
    allBalls.length === totalBalls(game) && allBalls.every((s) => s <= game.parPerBall);

  return {
    stations,
    balls: allBalls.length,
    strokes,
    par,
    scoreToPar: strokes - par,
    sg,
    cleanSweep,
  };
}

/** A scored session ready to rank on the leaderboard. */
export interface LeaderboardEntry {
  readonly id: string;
  readonly playedOn: string;
  /** When the session was logged (ISO). Tiebreaks chronology for same-day
   *  sessions so record detection uses real log order, not the arbitrary id. */
  readonly createdAt?: string;
  readonly score: GameScore;
}

/** A leaderboard entry with its rank + earned achievement markers (DL-023). */
export interface RankedEntry extends LeaderboardEntry {
  /** 1-based rank (1 = best). Ties share neither rank nor order arbitrarily —
   *  the secondary sort below makes the order deterministic. */
  readonly rank: number;
  /** The single best session — "the number to beat". */
  readonly isCurrentBest: boolean;
  /** Set a new personal record when it was played: strictly better (by the same
   *  ordering) than every earlier session. Requires at least one prior session,
   *  so the first session is the current best but not a "new record". */
  readonly setRecord: boolean;
  /** Every ball at or under par (mirrors GameScore.cleanSweep, surfaced here). */
  readonly cleanSweep: boolean;
}

/** Chronological order: by play date, then log time, then id. Same order used
 *  for record detection and as the final ranking tiebreak. */
function chronoCompare(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (a.playedOn !== b.playedOn) return a.playedOn < b.playedOn ? -1 : 1;
  const ac = a.createdAt ?? "";
  const bc = b.createdAt ?? "";
  if (ac !== bc) return ac < bc ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Order two entries: fewer total strokes first; SG (higher is better) breaks
 * ties; finally earliest logged for full determinism.
 */
function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (a.score.strokes !== b.score.strokes) return a.score.strokes - b.score.strokes;
  const aSg = a.score.sg ?? -Infinity;
  const bSg = b.score.sg ?? -Infinity;
  if (aSg !== bSg) return bSg - aSg; // higher SG ranks better
  return chronoCompare(a, b);
}

/** Minimal raw-session shape the leaderboard builder needs (maps from DB rows). */
export interface RawSession {
  readonly id: string;
  readonly played_on: string;
  readonly created_at?: string;
  readonly results: readonly {
    readonly station_index: number;
    readonly strokes: number;
  }[];
}

/** Group a session's flat results into `strokesByStation` for `scoreGame`. */
export function strokesByStation(
  game: PracticeGame,
  results: RawSession["results"],
): number[][] {
  const grouped: number[][] = game.stations.map(() => []);
  for (const r of results) {
    if (r.station_index >= 0 && r.station_index < grouped.length) {
      grouped[r.station_index].push(r.strokes);
    }
  }
  return grouped;
}

/**
 * Score every raw session for a game and rank them — the full DB-rows → ranked
 * leaderboard path. Pure (the DB read happens in the caller).
 */
export function buildLeaderboard(
  game: PracticeGame,
  sessions: readonly RawSession[],
): RankedEntry[] {
  const entries: LeaderboardEntry[] = sessions.map((s) => ({
    id: s.id,
    playedOn: s.played_on,
    createdAt: s.created_at,
    score: scoreGame(game, strokesByStation(game, s.results)),
  }));
  return rankLeaderboard(entries);
}

/**
 * Rank a player's sessions for one game (default metric: total strokes asc, SG
 * tiebreak) and tag each with its achievement markers. Personal leaderboard
 * only — never cross-player (DL-022 anti-goal).
 */
export function rankLeaderboard(entries: readonly LeaderboardEntry[]): RankedEntry[] {
  const sorted = [...entries].sort(compareEntries);

  // Record detection walks chronological order: a session set a record if it
  // beat every session logged strictly before it.
  const chronological = [...entries].sort(chronoCompare);
  const recordIds = new Set<string>();
  let best: LeaderboardEntry | null = null;
  for (const entry of chronological) {
    if (best !== null && compareEntries(entry, best) < 0) recordIds.add(entry.id);
    if (best === null || compareEntries(entry, best) < 0) best = entry;
  }

  return sorted.map((entry, i) => ({
    ...entry,
    rank: i + 1,
    isCurrentBest: i === 0,
    setRecord: recordIds.has(entry.id),
    cleanSweep: entry.score.cleanSweep,
  }));
}
