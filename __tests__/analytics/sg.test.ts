import { describe, it, expect } from "vitest";
import {
  categoryOf,
  shotSG,
  computeStrokesGained,
  fillTeeDistances,
} from "@/lib/analytics/sg";
import { expectedStrokes } from "@/lib/analytics/sg-baseline";
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
    situation_created: null,
    short_sided: null,
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

describe("categoryOf", () => {
  it("buckets by lie / distance / par", () => {
    expect(categoryOf("Tee", null, 4)).toBe("Off the tee");
    expect(categoryOf("Tee", 180, 3)).toBe("Approach"); // par-3 tee
    expect(categoryOf("Green", 2, 4)).toBe("Putting");
    expect(categoryOf("Rough", 150, 4)).toBe("Approach");
    expect(categoryOf("Fairway", 20, 4)).toBe("Short game");
    expect(categoryOf("Greenside bunker", 15, 4)).toBe("Short game");
    expect(categoryOf("Fairway bunker", 120, 5)).toBe("Approach");
  });
});

describe("expectedStrokes", () => {
  it("uses feet for putts and yards otherwise; null for unknown lies", () => {
    expect(expectedStrokes("Green", 2)).toBeCloseTo(1.34, 5); // 6 ft (Broadie)
    expect(expectedStrokes("Fairway", 150)).toBeCloseTo(2.945, 5); // interp 140/160
    expect(expectedStrokes(null, 100)).toBeNull();
    expect(expectedStrokes("Fairway", null)).toBeNull();
  });
});

describe("shotSG", () => {
  it("a holed putt gains the expected strokes minus one", () => {
    const putt = shot({ start_lie: "Green", yardage: 2, club: "Putter", result: "Make" });
    expect(shotSG(putt, null)).toBeCloseTo(1.34 - 1, 5); // +0.34 (6-ft putt)
  });

  it("subtracts the finish term from the next shot", () => {
    const approach = shot({ start_lie: "Fairway", yardage: 150, result: "Green" });
    const next = shot({ start_lie: "Green", yardage: 6, shot_no: 2 }); // ~18 ft
    // E(Fairway,150) − E(Green,18ft) − 1
    const sg = shotSG(approach, next)!;
    expect(sg).toBeCloseTo(
      expectedStrokes("Fairway", 150)! - expectedStrokes("Green", 6)! - 1,
      5,
    );
  });

  it("is uncomputable when the lie or a distance is missing", () => {
    expect(shotSG(shot({ start_lie: null, yardage: 150 }), null)).toBeNull();
    const approach = shot({ start_lie: "Fairway", yardage: 150, result: "Rough" });
    const next = shot({ start_lie: "Rough", yardage: null, shot_no: 2 }); // missing leave
    expect(shotSG(approach, next)).toBeNull();
  });
});

describe("fillTeeDistances", () => {
  it("fills only shot 1 with no yardage, from the course map", () => {
    const shots = [
      shot({ shot_no: 1, hole: 3, yardage: null }), // tee, skipped → filled
      shot({ shot_no: 2, hole: 3, yardage: 150 }), // untouched
      shot({ shot_no: 1, hole: 7, yardage: 165 }), // par-3 tee, has dist → untouched
    ];
    const out = fillTeeDistances(shots, { r1: { 3: 410, 7: 180 } });
    expect(out[0].yardage).toBe(410);
    expect(out[1].yardage).toBe(150);
    expect(out[2].yardage).toBe(165);
  });
});

describe("computeStrokesGained", () => {
  it("aggregates by category over a hole, with coverage", () => {
    const shots: ShotRow[] = [
      shot({ shot_no: 1, start_lie: "Tee", yardage: 400, club: "D", result: "Fairway" }),
      shot({ shot_no: 2, start_lie: "Fairway", yardage: 150, club: "7i", result: "Green" }),
      shot({ shot_no: 3, start_lie: "Green", yardage: 6, club: "Putter", result: null }),
      shot({ shot_no: 4, start_lie: "Green", yardage: 1, club: "Putter", result: "Make" }),
    ];
    const sg = computeStrokesGained(shots);
    expect(sg.totalShots).toBe(4);
    expect(sg.coveredShots).toBe(4); // chain is complete
    expect(sg.rounds).toBe(1);
    const putting = sg.byCategory.find((c) => c.category === "Putting")!;
    expect(putting.shots).toBe(2);
    // total SG ≈ sum of the four per-shot values
    const manual =
      shotSG(shots[0], shots[1])! +
      shotSG(shots[1], shots[2])! +
      shotSG(shots[2], shots[3])! +
      shotSG(shots[3], null)!;
    expect(sg.total).toBeCloseTo(manual, 5);
  });

  it("drops a shot (and its predecessor's finish) when a distance is missing", () => {
    const shots: ShotRow[] = [
      shot({ shot_no: 1, start_lie: "Tee", yardage: 400, result: "Rough" }),
      shot({ shot_no: 2, start_lie: "Rough", yardage: null, result: "Green" }), // no distance
      shot({ shot_no: 3, start_lie: "Green", yardage: 2, club: "Putter", result: "Make" }),
    ];
    const sg = computeStrokesGained(shots);
    // shot 2 uncomputable (no start dist); shot 1 uncomputable (finish unknown);
    // only the holed putt is covered.
    expect(sg.coveredShots).toBe(1);
  });
});
