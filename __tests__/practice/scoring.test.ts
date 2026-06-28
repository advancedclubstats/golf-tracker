import { describe, it, expect } from "vitest";
import {
  scoreGame,
  rankLeaderboard,
  type LeaderboardEntry,
} from "@/lib/practice/scoring";
import type { PracticeGame } from "@/lib/practice/games";
import { getPracticeGame } from "@/lib/practice/games";

// A two-station game isolating Matt's worked example ([2,3,3]@90 + [3,3,3]@70),
// fairway lie, par 3/ball. Mirrors the real "zone-9" registry shape.
const twoStation: PracticeGame = {
  id: "test-2",
  name: "Test Two-Station",
  blurb: "",
  stations: [
    { yards: 90, lie: "Fairway", balls: 3 },
    { yards: 70, lie: "Fairway", balls: 3 },
  ],
  parPerBall: 3,
  leaderboardMetric: "strokes",
};

describe("scoreGame — score to par", () => {
  it("computes per-station and total strokes vs par", () => {
    const score = scoreGame(twoStation, [
      [2, 3, 3], // 90: 8 strokes vs par 9 → -1
      [3, 3, 3], // 70: 9 strokes vs par 9 →  0
    ]);

    expect(score.stations[0].strokes).toBe(8);
    expect(score.stations[0].par).toBe(9);
    expect(score.stations[0].scoreToPar).toBe(-1);

    expect(score.stations[1].strokes).toBe(9);
    expect(score.stations[1].scoreToPar).toBe(0);

    expect(score.strokes).toBe(17);
    expect(score.par).toBe(18);
    expect(score.scoreToPar).toBe(-1);
    expect(score.balls).toBe(6);
  });
});

describe("scoreGame — strokes gained", () => {
  // Fairway baseline: 90y → 2.83, 70y → 2.77 (interpolated in sg-baseline).
  it("matches the hand-computed SG for Matt's example", () => {
    const score = scoreGame(twoStation, [
      [2, 3, 3],
      [3, 3, 3],
    ]);

    // 90: (2.83-2)+(2.83-3)+(2.83-3) = +0.49
    expect(score.stations[0].sg).toBeCloseTo(0.49, 2);
    // 70: 3 × (2.77-3) = -0.69
    expect(score.stations[1].sg).toBeCloseTo(-0.69, 2);
    // total = 0.49 - 0.69 = -0.20
    expect(score.sg).toBeCloseTo(-0.2, 2);
  });

  it("flags a clean sweep only when every ball is at or under par", () => {
    const clean = scoreGame(twoStation, [
      [3, 3, 3],
      [2, 3, 1],
    ]);
    expect(clean.cleanSweep).toBe(true);

    const oneBogey = scoreGame(twoStation, [
      [3, 3, 4], // a 4 on a par-3 ball
      [3, 3, 3],
    ]);
    expect(oneBogey.cleanSweep).toBe(false);
  });

  it("does not claim a clean sweep on a partial card", () => {
    const partial = scoreGame(twoStation, [[3, 3, 3]]); // only 3 of 6 balls
    expect(partial.cleanSweep).toBe(false);
  });
});

describe("scoreGame — registry game (zone-9)", () => {
  it("scores the shipped game over its three stations", () => {
    const zone = getPracticeGame("zone-9")!;
    const score = scoreGame(zone, [
      [3, 3, 3],
      [3, 3, 3],
      [3, 3, 3],
    ]);
    expect(score.balls).toBe(9);
    expect(score.par).toBe(27);
    expect(score.strokes).toBe(27);
    expect(score.scoreToPar).toBe(0);
  });
});

describe("rankLeaderboard", () => {
  function entry(
    id: string,
    playedOn: string,
    strokes: number,
    sg: number,
    createdAt?: string,
  ): LeaderboardEntry {
    return {
      id,
      playedOn,
      createdAt,
      score: {
        stations: [],
        balls: 9,
        strokes,
        par: 27,
        scoreToPar: strokes - 27,
        sg,
        cleanSweep: false,
      },
    };
  }

  it("ranks by total strokes ascending (the number to beat)", () => {
    const ranked = rankLeaderboard([
      entry("a", "2026-06-01", 30, 0),
      entry("b", "2026-06-02", 26, 0),
      entry("c", "2026-06-03", 28, 0),
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].isCurrentBest).toBe(true);
    expect(ranked[1].isCurrentBest).toBe(false);
  });

  it("breaks strokes ties by higher SG", () => {
    const ranked = rankLeaderboard([
      entry("low-sg", "2026-06-01", 27, -1.0),
      entry("high-sg", "2026-06-02", 27, 1.5),
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["high-sg", "low-sg"]);
  });

  it("marks a session that set a new record when it was played", () => {
    const ranked = rankLeaderboard([
      entry("first", "2026-06-01", 30, 0), // baseline, not a 'record'
      entry("better", "2026-06-02", 27, 0), // beat the prior → record
      entry("worse", "2026-06-03", 29, 0), // did not beat the best → no record
    ]);
    const byId = Object.fromEntries(ranked.map((r) => [r.id, r]));
    expect(byId["first"].setRecord).toBe(false);
    expect(byId["better"].setRecord).toBe(true);
    expect(byId["worse"].setRecord).toBe(false);
    // current best is the lowest-stroke session regardless of chronology
    expect(byId["better"].isCurrentBest).toBe(true);
  });

  it("uses log time, not id, to order same-day record detection", () => {
    // Same play date; the better card was logged LATER, so it set a record —
    // even though its id sorts first (which would have mis-detected before).
    const ranked = rankLeaderboard([
      entry("aaa", "2026-06-28", 25, 0, "2026-06-28T12:00:00Z"), // better, logged 2nd
      entry("zzz", "2026-06-28", 27, 0, "2026-06-28T09:00:00Z"), // worse, logged 1st
    ]);
    const byId = Object.fromEntries(ranked.map((r) => [r.id, r]));
    expect(byId["zzz"].setRecord).toBe(false); // first ever → baseline
    expect(byId["aaa"].setRecord).toBe(true); // beat the earlier card
    expect(byId["aaa"].isCurrentBest).toBe(true);
  });

  it("handles an empty leaderboard", () => {
    expect(rankLeaderboard([])).toEqual([]);
  });
});
