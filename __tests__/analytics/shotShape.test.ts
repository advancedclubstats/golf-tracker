import { describe, it, expect } from "vitest";
import {
  clubCategory,
  computeShotShapeSummary,
  CLUB_CATEGORIES,
} from "@/lib/analytics/shotShape";
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
    distance_unit: null,
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

describe("clubCategory", () => {
  it("maps the seed bag to the five buckets", () => {
    expect(clubCategory("D")).toBe("Driver");
    expect(clubCategory("Driver")).toBe("Driver");
    expect(clubCategory("3W")).toBe("Woods");
    expect(clubCategory("5W")).toBe("Woods");
    expect(clubCategory("4i")).toBe("Long iron");
    expect(clubCategory("6i")).toBe("Long iron");
    expect(clubCategory("7i")).toBe("Short iron");
    expect(clubCategory("9i")).toBe("Short iron");
    expect(clubCategory("PW")).toBe("Short iron");
    expect(clubCategory("GW")).toBe("Short iron");
    expect(clubCategory("SW")).toBe("Wedge");
    expect(clubCategory("LW")).toBe("Wedge");
  });

  it("handles bag-edit variants and excludes the putter", () => {
    expect(clubCategory("3i")).toBe("Long iron");
    expect(clubCategory("56")).toBe("Wedge"); // lofted wedge by degrees
    expect(clubCategory("Putter")).toBeNull();
    expect(clubCategory("???")).toBeNull();
  });
});

describe("computeShotShapeSummary", () => {
  it("returns no rows when nothing is tagged-or-played", () => {
    expect(computeShotShapeSummary([])).toEqual([]);
  });

  it("rates shapes over tagged shots only, not all shots", () => {
    const rows = computeShotShapeSummary([
      shot({ club: "D", shot_shape: "Fade" }),
      shot({ club: "D", shot_shape: "Fade" }),
      shot({ club: "D", shot_shape: "Slice" }),
      shot({ club: "D" }), // untagged — counts toward shots, not shapeN
    ]);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.category).toBe("Driver");
    expect(r.shots).toBe(4);
    expect(r.shapeN).toBe(3);
    expect(r.shapePct.Fade).toBeCloseTo(2 / 3);
    expect(r.shapePct.Slice).toBeCloseTo(1 / 3);
    expect(r.shapePct.Hook).toBe(0);
  });

  it("flags a one-way right miss (Fade/Slice dominant, no left)", () => {
    const rows = computeShotShapeSummary([
      shot({ club: "D", shot_shape: "Slice" }),
      shot({ club: "D", shot_shape: "Slice" }),
      shot({ club: "D", shot_shape: "Fade" }),
      shot({ club: "D", shot_shape: "Straight" }),
    ]);
    const r = rows[0];
    expect(r.curveRightPct).toBeCloseTo(3 / 4);
    expect(r.curveLeftPct).toBe(0);
    expect(r.oneWayMiss).toBe("Right");
  });

  it("does not flag one-way when the miss goes both ways", () => {
    const rows = computeShotShapeSummary([
      shot({ club: "7i", shot_shape: "Hook" }),
      shot({ club: "7i", shot_shape: "Hook" }),
      shot({ club: "7i", shot_shape: "Slice" }),
      shot({ club: "7i", shot_shape: "Slice" }),
    ]);
    const r = rows[0];
    expect(r.category).toBe("Short iron");
    expect(r.oneWayMiss).toBeNull();
  });

  it("tracks contact faults on their own denominator", () => {
    const rows = computeShotShapeSummary([
      shot({ club: "SW", shot_shape: "Draw", shot_contact: "Chunk" }),
      shot({ club: "SW", shot_contact: "Thin" }),
      shot({ club: "SW", shot_shape: "Straight" }), // no contact tag
    ]);
    const r = rows[0];
    expect(r.category).toBe("Wedge");
    expect(r.shapeN).toBe(2);
    expect(r.contactN).toBe(2);
    expect(r.contactPct.Chunk).toBeCloseTo(1 / 2);
    expect(r.contactPct.Thin).toBeCloseTo(1 / 2);
  });

  it("marks sub-threshold categories as an early read and clears at 15", () => {
    const few = computeShotShapeSummary([shot({ club: "D", shot_shape: "Draw" })]);
    expect(few[0].tier).toBe("early");

    const many = computeShotShapeSummary(
      Array.from({ length: 15 }, () => shot({ club: "D", shot_shape: "Draw" })),
    );
    expect(many[0].tier).toBe("stable");
  });

  it("excludes putters and orders rows by canonical category", () => {
    const rows = computeShotShapeSummary([
      shot({ club: "SW", shot_shape: "Draw" }),
      shot({ club: "Putter" }),
      shot({ club: "D", shot_shape: "Fade" }),
      shot({ club: "7i", shot_shape: "Straight" }),
    ]);
    expect(rows.map((r) => r.category)).toEqual(["Driver", "Short iron", "Wedge"]);
    // Putter contributed nothing.
    expect(rows.every((r) => CLUB_CATEGORIES.includes(r.category))).toBe(true);
  });
});
