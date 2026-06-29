/**
 * Practice-game registry (DL-022) — CODE config, not data.
 *
 * A practice game is a fixed drill: hole out N balls from a set of stations
 * (yardage + lie), score it vs par, and read the honest strokes-gained against
 * the same scratch baseline as real rounds. Games are defined here as plain
 * config objects — adding a game is editing this array + a deploy, with no DB
 * change (mirrors the D-02 "enums live in code" rule). `practice_sessions.game_id`
 * is just a text key into this registry.
 *
 * Everything that renders or scores a game reads the registry generically
 * (entry steppers iterate `stations`, the leaderboard reads `leaderboardMetric`),
 * so one game or ten share the same screens.
 *
 * Lane-3 gate (DL-022): the abstraction is built to scale, but we ship exactly
 * ONE game first and confirm the loop pulls Matt before adding more.
 */

import type { StartLie } from "@/lib/constants";

/** A group of identical balls hit from one spot. */
export interface PracticeStation {
  /** Distance to the hole, in yards. */
  readonly yards: number;
  /** Lie the balls are played from — keys the SG baseline table. */
  readonly lie: StartLie;
  /** How many balls to hole out from this station. */
  readonly balls: number;
}

/**
 * Which number ranks the leaderboard. `strokes` (total strokes, ascending) is
 * the robust default — the "number to beat". SG is always shown beside it and
 * breaks ties, but its magnitude is provisional (see scoring.ts), so it is not
 * the primary sort.
 */
export type LeaderboardMetric = "strokes";

export interface PracticeGame {
  /** Stable key stored in `practice_sessions.game_id`. Never reuse or rename. */
  readonly id: string;
  /** Display name. */
  readonly name: string;
  /** One-line description of the drill. */
  readonly blurb: string;
  /** Ordered stations the player works through. */
  readonly stations: readonly PracticeStation[];
  /** Par for a single ball (each ball is its own hole-out). */
  readonly parPerBall: number;
  /** Which metric ranks the personal leaderboard. */
  readonly leaderboardMetric: LeaderboardMetric;
}

/**
 * The shipped games. ONE for now (DL-022 Lane-3 gate).
 *
 * "The Zone — 9": 9 balls holed out, 3 each from 90 / 70 / 50 yds off the
 * fairway. Par 3 per ball → par 27. The headline is total strokes vs par (the
 * number to beat); total SG vs scratch is the honest read beside it.
 */
export const PRACTICE_GAMES: readonly PracticeGame[] = [
  {
    id: "zone-9",
    name: "The Zone 9",
    blurb: "Nine wedges from the fairway: three each at 90, 70 and 50 yards. Hole them out.",
    stations: [
      { yards: 90, lie: "Fairway", balls: 3 },
      { yards: 70, lie: "Fairway", balls: 3 },
      { yards: 50, lie: "Fairway", balls: 3 },
    ],
    parPerBall: 3,
    leaderboardMetric: "strokes",
  },
];

/** Look up a game by id. Returns undefined for an unknown key. */
export function getPracticeGame(id: string): PracticeGame | undefined {
  return PRACTICE_GAMES.find((g) => g.id === id);
}

/** Total balls in a game (sum across stations) — the game's "holes". */
export function totalBalls(game: PracticeGame): number {
  return game.stations.reduce((sum, st) => sum + st.balls, 0);
}

/** Par for a whole game (parPerBall × total balls). */
export function gamePar(game: PracticeGame): number {
  return game.parPerBall * totalBalls(game);
}
