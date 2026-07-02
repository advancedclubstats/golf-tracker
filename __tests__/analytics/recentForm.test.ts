import { describe, it, expect } from "vitest";
import { recentForm, topRecentFormMove, shotsThroughRound } from "@/lib/analytics/recentForm";
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
    club: "Putter",
    yardage: null,
    distance_unit: "ft",
    start_lie: "Green",
    start_lie_manual: false,
    obstruction: "Clear",
    decision_quality: "Good",
    execution: 3,
    result: "Make",
    miss_direction: null,
    shot_shape: null,
    shot_contact: null,
    shot_start: null,
    target_offset: null,
    putt_side: null,
    putt_length: null,
    penalty: 0,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  };
}

/** One holed putt of `ft` feet per round → a controllable per-round Putting SG. */
function puttRounds(specs: { ft: number }[]) {
  const shots: ShotRow[] = [];
  const rounds: { id: string; date: string }[] = [];
  specs.forEach((s, i) => {
    const id = `r${i + 1}`;
    rounds.push({ id, date: `2026-01-${String(i + 1).padStart(2, "0")}` });
    shots.push(shot({ round_id: id, yardage: s.ft / 3, result: "Make" }));
  });
  return { shots, rounds };
}

describe("recentForm", () => {
  it("splits recent vs prior N and computes the all-time mean", () => {
    // 10 rounds: prior 5 from 6 ft (SG ≈ +0.34), recent 5 from 3 ft (SG ≈ +0.04).
    const specs = [...Array(5).fill({ ft: 6 }), ...Array(5).fill({ ft: 3 })];
    const { shots, rounds } = puttRounds(specs);
    const putt = recentForm(shots, rounds).byCategory.Putting;

    expect(putt.sampleCount).toBe(10);
    expect(putt.recentMean).toBeCloseTo(0.04, 2);
    expect(putt.priorMean).toBeCloseTo(0.34, 2);
    expect(putt.delta).toBeCloseTo(0.04 - 0.34, 2); // ≈ -0.30
    // Equal counts each side → all-time mean is exactly the midpoint.
    expect(putt.allTimeMean).toBeCloseTo(((putt.recentMean! + putt.priorMean!) / 2), 5);
  });

  it("nulls recentMean below N (never a zero)", () => {
    const { shots, rounds } = puttRounds(Array(3).fill({ ft: 6 }));
    const putt = recentForm(shots, rounds).byCategory.Putting;
    expect(putt.sampleCount).toBe(3);
    expect(putt.recentMean).toBeNull();
    expect(putt.priorMean).toBeNull();
    expect(putt.delta).toBeNull();
    expect(putt.allTimeMean).toBeCloseTo(0.34, 2); // still reported
  });

  it("nulls priorMean/delta between N and 2N (no real split)", () => {
    const { shots, rounds } = puttRounds(Array(8).fill({ ft: 6 }));
    const putt = recentForm(shots, rounds).byCategory.Putting;
    expect(putt.sampleCount).toBe(8);
    expect(putt.recentMean).toBeCloseTo(0.34, 2); // ≥ N
    expect(putt.priorMean).toBeNull(); // < 2N
    expect(putt.delta).toBeNull();
  });

  it("handles empty and single-round inputs", () => {
    const empty = recentForm([], []).byCategory.Putting;
    expect(empty.sampleCount).toBe(0);
    expect(empty.recentMean).toBeNull();
    expect(empty.allTimeMean).toBe(0);

    const { shots, rounds } = puttRounds([{ ft: 6 }]);
    const one = recentForm(shots, rounds).byCategory.Putting;
    expect(one.sampleCount).toBe(1);
    expect(one.recentMean).toBeNull(); // below N
    expect(one.allTimeMean).toBeCloseTo(0.34, 2);
  });
});

describe("shotsThroughRound", () => {
  const rounds = [
    { id: "r1", date: "2026-01-01" },
    { id: "r2", date: "2026-01-02" },
    { id: "r3", date: "2026-01-03" },
  ];
  const shots = [
    shot({ round_id: "r1" }),
    shot({ round_id: "r2" }),
    shot({ round_id: "r3" }),
  ];

  it("keeps only rounds up to and including the target, chronologically", () => {
    const through = shotsThroughRound(shots, rounds, "r2");
    expect(through.map((s) => s.round_id).sort()).toEqual(["r1", "r2"]);
  });

  it("respects date order over input order when slicing", () => {
    // r3 is newest by date; through r1 keeps only r1 even though r3 is listed later.
    expect(shotsThroughRound(shots, rounds, "r1").map((s) => s.round_id)).toEqual(["r1"]);
  });

  it("returns all shots when the round is unknown", () => {
    expect(shotsThroughRound(shots, rounds, "nope")).toHaveLength(3);
  });
});

describe("topRecentFormMove", () => {
  it("returns the meaningful mover above the 2N floor", () => {
    const specs = [...Array(5).fill({ ft: 6 }), ...Array(5).fill({ ft: 3 })];
    const { shots, rounds } = puttRounds(specs);
    const move = topRecentFormMove(recentForm(shots, rounds));
    expect(move).not.toBeNull();
    expect(move!.category).toBe("Putting");
    expect(move!.delta).toBeCloseTo(-0.30, 1);
    expect(move!.windowN).toBe(5);
  });

  it("is null below the floor", () => {
    const { shots, rounds } = puttRounds(Array(8).fill({ ft: 6 }));
    expect(topRecentFormMove(recentForm(shots, rounds))).toBeNull();
  });

  it("is null when nothing moved past the threshold", () => {
    const { shots, rounds } = puttRounds(Array(10).fill({ ft: 6 }));
    expect(topRecentFormMove(recentForm(shots, rounds))).toBeNull();
  });
});
