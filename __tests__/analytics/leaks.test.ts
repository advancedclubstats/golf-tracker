import { describe, it, expect } from "vitest";
import { computeLeaks } from "@/lib/analytics/leaks";
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
    putt_side: null,
    putt_length: null,
    penalty: 0,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  };
}

/**
 * One par-4 with a covered 125–175 approach. `miss` leaves the green (Rough →
 * chip → putt, a genuine SG loss); otherwise it hits the green (a small gain).
 */
function approachHole(round: string, hole: number, miss = false): ShotRow[] {
  if (miss) {
    return [
      shot({ round_id: round, hole, shot_no: 1, club: "7i", start_lie: "Fairway", yardage: 150, result: "Rough", miss_direction: "Left" }),
      shot({ round_id: round, hole, shot_no: 2, club: "SW", start_lie: "Rough", yardage: 20, result: "Green" }),
      shot({ round_id: round, hole, shot_no: 3, club: "Putter", start_lie: "Green", yardage: 5, result: "Make" }),
    ];
  }
  return [
    shot({ round_id: round, hole, shot_no: 1, club: "7i", start_lie: "Fairway", yardage: 150, result: "Green" }),
    shot({ round_id: round, hole, shot_no: 2, club: "Putter", start_lie: "Green", yardage: 5, result: "Make" }),
  ];
}

describe("computeLeaks", () => {
  it("ranks cuts by strokes recoverable per round (most negative first)", () => {
    // Two rounds, ten missed 125–175 approaches → a clear, well-sampled leak.
    const shots: ShotRow[] = [];
    for (let i = 0; i < 5; i++) shots.push(...approachHole("r1", i + 1, true));
    for (let i = 0; i < 5; i++) shots.push(...approachHole("r2", i + 1, true));
    const { leaks, rounds } = computeLeaks(shots);
    expect(rounds).toBe(2);
    // The worst cut sorts first and is a loss.
    expect(leaks[0].sgPerRound).toBeLessThan(0);
    const approach = leaks.find((l) => l.kind === "approach" && l.label === "125–175 yds")!;
    expect(approach.shots).toBe(10);
    expect(approach.prescribable).toBe(true); // n=10 ≥ bucket gate
    expect(approach.raw).toEqual({ label: "greens", value: 0 }); // all missed
    expect(approach.target).toBe(0.58);
    expect(approach.shotsDetail).toHaveLength(10);
  });

  it("marks under-sampled cuts as early reads, not prescribable", () => {
    const { leaks } = computeLeaks(approachHole("r1", 1, true));
    const approach = leaks.find((l) => l.kind === "approach")!;
    expect(approach.shots).toBe(1);
    expect(approach.tier).toBe("early");
    expect(approach.prescribable).toBe(false);
    // The 7i club cut is also under its n≥15 gate.
    const club = leaks.find((l) => l.kind === "club" && l.label === "7i")!;
    expect(club.prescribable).toBe(false);
  });

  it("orders the impact list worst-cost first", () => {
    const shots: ShotRow[] = [...approachHole("r1", 1, true), ...approachHole("r1", 2, false)];
    const { leaks } = computeLeaks(shots);
    const approach = leaks.find((l) => l.kind === "approach")!;
    expect(approach.shotsDetail[0].sg).toBeLessThanOrEqual(approach.shotsDetail[1].sg);
  });
});
