import { describe, it, expect } from "vitest";
import { computeHoleAttribution } from "@/lib/analytics/holeAttribution";
import type { ShotRow } from "@/lib/schemas/shot";

let seq = 0;
function shot(p: Partial<ShotRow>): ShotRow {
  return {
    id: `00000000-0000-0000-0000-${String(seq++).padStart(12, "0")}`,
    user_id: "1b3a0171-726e-4c64-a8e0-f97a717f2851",
    round_id: "r1",
    hole: 1,
    par: 4,
    shot_no: 1,
    club: "D",
    yardage: null,
    distance_unit: "yd",
    start_lie: null,
    start_lie_manual: false,
    obstruction: "Clear",
    situation_created: null,
    short_sided: null,
    decision_quality: "Good",
    execution: 3,
    result: null,
    miss_direction: null,
    shot_shape: null,
    shot_contact: null,
    putt_side: null,
    putt_length: null,
    penalty: 0,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  };
}

/** A par-4 played to `score` 5 (bogey) via a poor approach into rough. */
function bogeyHole(round: string, hole: number): ShotRow[] {
  return [
    shot({ round_id: round, hole, par: 4, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "Fairway" }),
    shot({ round_id: round, hole, par: 4, shot_no: 2, club: "7i", start_lie: "Fairway", yardage: 160, result: "Rough", miss_direction: "Long" }),
    shot({ round_id: round, hole, par: 4, shot_no: 3, club: "SW", start_lie: "Rough", yardage: 20, result: "Green" }),
    shot({ round_id: round, hole, par: 4, shot_no: 4, club: "Putter", start_lie: "Green", yardage: 6, result: null }),
    shot({ round_id: round, hole, par: 4, shot_no: 5, club: "Putter", start_lie: "Green", yardage: 1, result: "Make" }),
  ];
}

/** A par-3 played to par. */
function parThree(round: string, hole: number): ShotRow[] {
  return [
    shot({ round_id: round, hole, par: 3, shot_no: 1, club: "7i", start_lie: "Tee", yardage: 165, result: "Green" }),
    shot({ round_id: round, hole, par: 3, shot_no: 2, club: "Putter", start_lie: "Green", yardage: 8, result: null }),
    shot({ round_id: round, hole, par: 3, shot_no: 3, club: "Putter", start_lie: "Green", yardage: 1, result: "Make" }),
  ];
}

describe("computeHoleAttribution", () => {
  const rows = computeHoleAttribution([
    ...bogeyHole("r1", 1),
    ...bogeyHole("r2", 1),
    ...parThree("r1", 2),
  ]);

  it("aggregates score and ranks the costliest hole first", () => {
    expect(rows[0].hole).toBe(1);
    expect(rows[0].rounds).toBe(2);
    expect(rows[0].avgScore).toBe(5); // bogey both rounds
    expect(rows[0].avgVsPar).toBe(1); // +1/round
  });

  it("breaks the hole's loss down by category with shares", () => {
    const h1 = rows.find((r) => r.hole === 1)!;
    // Categories always present (tee/approach/short/putt), summing to total SG.
    expect(h1.categories).toHaveLength(4);
    const sum = h1.categories.reduce((s, c) => s + c.sg, 0);
    expect(h1.totalSg).toBeCloseTo(sum, 5);
    // There is a losing category and it carries a share of total loss.
    expect(h1.worstCategory).not.toBeNull();
    expect(h1.worstShare).toBeGreaterThan(0);
    // Loss shares over losing categories sum to ~1.
    const shareSum = h1.categories
      .filter((c) => c.lossShare != null)
      .reduce((s, c) => s + (c.lossShare ?? 0), 0);
    expect(shareSum).toBeCloseTo(1, 5);
  });

  it("excludes incomplete holes from the score average", () => {
    // An unfinished hole 3 (no Make) should not appear.
    const withOpen = computeHoleAttribution([
      ...bogeyHole("r1", 1),
      shot({ round_id: "r1", hole: 3, par: 4, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "Fairway" }),
    ]);
    expect(withOpen.find((r) => r.hole === 3)).toBeUndefined();
  });
});
