import { describe, it, expect } from "vitest";
import { computeTargetDispersion } from "@/lib/analytics/targetDispersion";
import type { ShotRow } from "@/lib/schemas/shot";
import type { TargetOffset } from "@/lib/constants";

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
    yardage: 150,
    distance_unit: "yd",
    start_lie: "Fairway",
    start_lie_manual: false,
    obstruction: "Clear",
    situation_created: null,
    short_sided: null,
    decision_quality: "Good",
    execution: 3,
    result: "Green",
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

/** Shorthand: n short-iron shots with a given target_offset. */
function offsets(...vals: (TargetOffset | null)[]): ShotRow[] {
  return vals.map((v) => shot({ target_offset: v }));
}

describe("computeTargetDispersion", () => {
  it("decomposes the 3×3 grid into distance + lateral shares over tagged shots", () => {
    // 2 long-left, 1 long, 1 at-pin, 4 short, 2 short-right; plus 1 untagged.
    const shots = offsets(
      "LongLeft",
      "LongLeft",
      "Long",
      "Center",
      "Short",
      "Short",
      "Short",
      "Short",
      "ShortRight",
      "ShortRight",
      null,
    );
    const [row] = computeTargetDispersion(shots);
    expect(row.category).toBe("Short iron");
    expect(row.shots).toBe(11); // includes the untagged one
    expect(row.offsetN).toBe(10); // denominator excludes untagged

    // Distance: 3 long, 1 pin-high, 6 short over 10.
    expect(row.longPct).toBeCloseTo(0.3, 5);
    expect(row.pinHighPct).toBeCloseTo(0.1, 5);
    expect(row.shortPct).toBeCloseTo(0.6, 5);
    // Lateral: 4 left (2 LL + 2 SR? no) — recompute: left = LongLeft×2 = 2;
    // right = ShortRight×2 = 2; on-line = Long+Center+Short×4 = 6.
    expect(row.leftPct).toBeCloseTo(0.2, 5);
    expect(row.rightPct).toBeCloseTo(0.2, 5);
    expect(row.onLinePct).toBeCloseTo(0.6, 5);
    expect(row.atPinPct).toBeCloseTo(0.1, 5);
  });

  it("flags a one-way distance bias (leaves it short) and balanced lateral", () => {
    // 9 short, 1 long → short share among off-distance = 0.9 (≥0.55, other ≤0.2).
    // Laterally split evenly → no lateral bias.
    const shots = offsets(
      "ShortLeft",
      "Short",
      "Short",
      "ShortRight",
      "ShortLeft",
      "Short",
      "ShortRight",
      "Short",
      "ShortLeft",
      "LongRight",
    );
    const [row] = computeTargetDispersion(shots);
    expect(row.distanceBias).toBe("Short");
    expect(row.lateralBias).toBeNull();
  });

  it("flags a one-way lateral bias when misses pile on one side", () => {
    // 8 left, 1 right (off-lateral), rest on-line → left bias.
    const shots = offsets(
      "Left",
      "Left",
      "LongLeft",
      "ShortLeft",
      "Left",
      "Left",
      "LongLeft",
      "ShortLeft",
      "Right",
      "Center",
    );
    const [row] = computeTargetDispersion(shots);
    expect(row.lateralBias).toBe("Left");
  });

  it("excludes side-only tee drives from the distance axis but keeps them lateral", () => {
    // Driver drives (Tee, par 4) capture side-only — they have no long/short, so
    // they must not inflate the distance read, but still count laterally.
    const drives = ["Left", "Center", "Right", "Left"].map((o) =>
      shot({ club: "D", start_lie: "Tee", par: 4, result: "Fairway", target_offset: o as TargetOffset }),
    );
    const [row] = computeTargetDispersion(drives);
    expect(row.category).toBe("Driver");
    expect(row.offsetN).toBe(4); // lateral denominator: all four
    expect(row.distanceN).toBe(0); // no distance signal off the tee
    expect(row.shortPct).toBeNull();
    expect(row.pinHighPct).toBeNull();
    expect(row.leftPct).toBeCloseTo(0.5, 5); // 2 of 4 left
    expect(row.rightPct).toBeCloseTo(0.25, 5);
  });

  it("a par-3 tee shot still carries a distance signal (it's an approach)", () => {
    const teeApproaches = ["Short", "Short", "Long"].map((o) =>
      shot({ club: "7i", start_lie: "Tee", par: 3, target_offset: o as TargetOffset }),
    );
    const [row] = computeTargetDispersion(teeApproaches);
    expect(row.distanceN).toBe(3); // par-3 tee is not side-only
    expect(row.shortPct).toBeCloseTo(2 / 3, 5);
  });

  it("gates: below 15 tagged shots reads as an early tier", () => {
    const [row] = computeTargetDispersion(offsets("Short", "Long", "Center"));
    expect(row.offsetN).toBe(3);
    expect(row.tier).toBe("early");
  });

  it("excludes putts and ignores untagged-only categories' rates", () => {
    const shots = [
      shot({ club: "Putter", target_offset: "Short" }), // putter → excluded entirely
      shot({ club: "D", target_offset: null }), // driver, untagged
    ];
    const rows = computeTargetDispersion(shots);
    // No Putter row; Driver row exists but has a zero-offset denominator.
    expect(rows.find((r) => r.category === "Driver")?.offsetN).toBe(0);
    expect(rows.find((r) => r.category === "Driver")?.shortPct).toBeNull();
    expect(rows.some((r) => r.category === ("Putter" as never))).toBe(false);
  });
});
