import { describe, it, expect } from "vitest";
import { computeMomentum } from "@/lib/analytics/momentum";
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
    situation_created: null,
    short_sided: null,
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

describe("computeMomentum", () => {
  it("splits recent vs prior N and buckets a meaningful decline as slipping", () => {
    // 10 rounds: prior 5 from 6 ft (SG ≈ +0.34), recent 5 from 3 ft (SG ≈ +0.04).
    const specs = [...Array(5).fill({ ft: 6 }), ...Array(5).fill({ ft: 3 })];
    const { shots, rounds } = puttRounds(specs);
    const m = computeMomentum(shots, rounds, 5);

    expect(m.populated).toBe(true);
    expect(m.gaining).toHaveLength(0);
    const putt = m.slipping.find((e) => e.category === "Putting")!;
    expect(putt).toBeTruthy();
    expect(putt.sampleCount).toBe(10);
    expect(putt.points).toHaveLength(10);
    expect(putt.delta).toBeCloseTo(0.04 - 0.34, 2); // ≈ -0.30
    expect(putt.bucket).toBe("slipping");
    // Putting is net-positive here (a strength), so a slip reads as a "new slip".
    expect(putt.tag).toBe("new");
    expect(putt.leakRank).toBeNull();
  });

  it("is ABSENT below the 2N floor (honesty rule), and reports progress", () => {
    const { shots, rounds } = puttRounds(Array(8).fill({ ft: 6 }));
    const m = computeMomentum(shots, rounds, 5);
    expect(m.populated).toBe(false);
    expect(m.gaining).toHaveLength(0);
    expect(m.slipping).toHaveLength(0);
    expect(m.bestSample).toBe(8); // 8 / 10 toward the floor
  });

  it("drops moves below the meaningful threshold", () => {
    // 10 rounds all ~6 ft → delta ≈ 0, not surfaced.
    const { shots, rounds } = puttRounds(Array(10).fill({ ft: 6 }));
    const m = computeMomentum(shots, rounds, 5);
    expect(m.populated).toBe(false);
    expect(m.bestSample).toBe(10);
  });
});
