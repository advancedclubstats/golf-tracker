import { describe, it, expect } from "vitest";
import { computeClubYardages } from "@/lib/analytics/clubYardages";
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
    club: "7i",
    yardage: 165,
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
    shot_start: null,
    target_offset: null,
    putt_side: null,
    putt_length: null,
    penalty: 0,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  } as ShotRow;
}

describe("computeClubYardages", () => {
  it("buckets to the nearest 5 and ranks by frequency, most common first", () => {
    const shots = [
      shot({ club: "7i", yardage: 164 }),
      shot({ club: "7i", yardage: 166 }), // → 165 bucket (x3 with the two below)
      shot({ club: "7i", yardage: 165 }),
      shot({ club: "7i", yardage: 152 }), // → 150 bucket (x1)
      shot({ club: "7i", yardage: 173 }), // → 175 bucket (x1)
    ];
    expect(computeClubYardages(shots)["7i"]).toEqual([165, 175, 150]);
  });

  it("breaks frequency ties toward the longer (stock) distance", () => {
    const shots = [
      shot({ club: "8i", yardage: 150 }),
      shot({ club: "8i", yardage: 140 }),
    ];
    expect(computeClubYardages(shots)["8i"]).toEqual([150, 140]);
  });

  it("caps the chip count (default 3) per club", () => {
    const shots = [120, 130, 140, 150, 160].map((y) =>
      shot({ club: "9i", yardage: y }),
    );
    expect(computeClubYardages(shots)["9i"]).toHaveLength(3);
  });

  it("excludes putts and putter-off-green (ft) rows", () => {
    const shots = [
      shot({ club: "Putter", yardage: 10, distance_unit: "ft" }),
      shot({ club: "PW", yardage: 30, distance_unit: "ft" }), // texas wedge
      shot({ club: "PW", yardage: 110 }),
    ];
    const out = computeClubYardages(shots);
    expect(out["Putter"]).toBeUndefined();
    expect(out["PW"]).toEqual([110]);
  });

  it("ignores missing and non-positive yardages", () => {
    const shots = [
      shot({ club: "GW", yardage: null }),
      shot({ club: "GW", yardage: 0 }),
      shot({ club: "GW", yardage: 105 }),
    ];
    expect(computeClubYardages(shots)["GW"]).toEqual([105]);
  });

  it("returns no entry for a club with no usable yardage", () => {
    const shots = [shot({ club: "D", yardage: null })];
    expect(computeClubYardages(shots)["D"]).toBeUndefined();
  });
});
