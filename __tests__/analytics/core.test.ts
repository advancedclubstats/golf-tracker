import { describe, it, expect } from "vitest";
import {
  puttBucketOf,
  bucketOf,
  puttYardsToFeet,
  penaltyOf,
  totalPenalties,
  penaltiesBeforeFirstPutt,
  isRealPutt,
  aggregateByRoundHole,
  strokesToReachGreen,
  enrichRoundHole,
  r2,
} from "@/lib/analytics/core";
import { ATG_BUCKETS, APPROACH_BUCKETS } from "@/lib/constants";
import type { ShotRow } from "@/lib/schemas/shot";

/**
 * Expected outputs below are derived by tracing `docs/golf_stats.gs` line by
 * line on hand-built fixtures (the agreed P2-T1 verification method). Where a
 * case comes straight from SPEC.md it is called out.
 */

// Fills the DB-generated / unused fields so a partial shot satisfies ShotRow.
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
    putt_side: null,
    putt_length: null,
    penalty: 0,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  };
}

// ─── Bucket finders ───────────────────────────────────────────────────────────

describe("puttBucketOf — upper-inclusive feet buckets", () => {
  it.each([
    [0, "0–3 ft"],
    [3, "0–3 ft"], // boundary is inclusive at the top
    [3.0001, "3–6 ft"],
    [6, "3–6 ft"], // SPEC: a 6-ft putt falls in "3–6 ft"
    [10, "6–10 ft"],
    [10.5, "10–20 ft"],
    [20, "10–20 ft"],
    [20.0001, "20+ ft"],
    [120, "20+ ft"],
  ])("%d ft → %s", (ft, label) => {
    expect(puttBucketOf(ft)?.label).toBe(label);
  });
});

describe("bucketOf — half-open [min, max) yard buckets", () => {
  it("around-the-green boundaries", () => {
    expect(bucketOf(ATG_BUCKETS, 0)?.label).toBe("0–10 yds");
    expect(bucketOf(ATG_BUCKETS, 9.9)?.label).toBe("0–10 yds");
    expect(bucketOf(ATG_BUCKETS, 10)?.label).toBe("10–30 yds"); // lower-inclusive
    expect(bucketOf(ATG_BUCKETS, 29.9)?.label).toBe("10–30 yds");
    expect(bucketOf(ATG_BUCKETS, 30)).toBeNull(); // upper-exclusive
  });

  it("approach boundaries", () => {
    expect(bucketOf(APPROACH_BUCKETS, 30)?.label).toBe("30–75 yds");
    expect(bucketOf(APPROACH_BUCKETS, 75)?.label).toBe("75–125 yds");
    expect(bucketOf(APPROACH_BUCKETS, 175)?.label).toBe("175+ yds");
    expect(bucketOf(APPROACH_BUCKETS, 400)?.label).toBe("175+ yds");
    expect(bucketOf(APPROACH_BUCKETS, 29)).toBeNull();
  });
});

describe("puttYardsToFeet", () => {
  it("multiplies by 3", () => {
    expect(puttYardsToFeet(2)).toBe(6); // 2 yd = 6 ft
  });
});

// ─── Penalty helpers ──────────────────────────────────────────────────────────

describe("penalty helpers", () => {
  it("penaltyOf clamps negatives/absent to 0", () => {
    expect(penaltyOf(shot({ penalty: 1 }))).toBe(1);
    expect(penaltyOf(shot({ penalty: 0 }))).toBe(0);
    expect(penaltyOf(shot({ penalty: -3 }))).toBe(0);
  });

  it("totalPenalties sums across the hole", () => {
    const shots = [
      shot({ shot_no: 1, penalty: 1 }),
      shot({ shot_no: 2, penalty: 0 }),
      shot({ shot_no: 3, penalty: 1 }),
    ];
    expect(totalPenalties(shots)).toBe(2);
  });

  it("penaltiesBeforeFirstPutt stops at the first putter", () => {
    const shots = [
      shot({ shot_no: 1, penalty: 1 }),
      shot({ shot_no: 2, penalty: 1, club: "PW" }),
      shot({ shot_no: 3, club: "Putter", penalty: 1 }), // not counted
    ];
    expect(penaltiesBeforeFirstPutt(shots)).toBe(2);
  });
});

// ─── Putt classification ──────────────────────────────────────────────────────

describe("isRealPutt", () => {
  // Primary signal: the lie. A putt is any stroke from the green (D-12).
  it("a stroke from the green is a putt, regardless of club", () => {
    expect(isRealPutt(shot({ club: "Putter", start_lie: "Green", result: null }))).toBe(true);
    expect(isRealPutt(shot({ club: "Putter", start_lie: "Green", result: "Make" }))).toBe(true);
    // result tagged 'Green' (ball stayed on the green) is still a putt.
    expect(isRealPutt(shot({ club: "Putter", start_lie: "Green", result: "Green" }))).toBe(true);
    // Club-agnostic: even a wedge played from the green counts.
    expect(isRealPutt(shot({ club: "LW", start_lie: "Green", result: "Green" }))).toBe(true);
  });
  it("a putter used from off the green is NOT a putt", () => {
    expect(isRealPutt(shot({ club: "Putter", start_lie: "Fringe", result: null }))).toBe(false);
    expect(isRealPutt(shot({ club: "Putter", start_lie: "Fairway", result: "Green" }))).toBe(false);
    expect(isRealPutt(shot({ club: "Putter", start_lie: "Fringe", result: "Make" }))).toBe(false);
  });

  // Fallback for legacy rows logged before lie capture (null start_lie).
  describe("legacy rows without a start_lie", () => {
    it("a Putter that reaches the green (Texas wedge) is NOT a real putt", () => {
      expect(isRealPutt(shot({ club: "Putter", start_lie: null, result: "Green" }))).toBe(false);
    });
    it("a Putter with blank/Make result is a real putt", () => {
      expect(isRealPutt(shot({ club: "Putter", start_lie: null, result: null }))).toBe(true);
      expect(isRealPutt(shot({ club: "Putter", start_lie: null, result: "Make" }))).toBe(true);
    });
    it("a non-Putter is never a real putt", () => {
      expect(isRealPutt(shot({ club: "LW", start_lie: null, result: "Make" }))).toBe(false);
    });
  });
});

// ─── Aggregation ──────────────────────────────────────────────────────────────

describe("aggregateByRoundHole", () => {
  it("groups by (round, hole), sorts by shot_no, flags completeness", () => {
    const shots = [
      shot({ round_id: "r1", hole: 1, shot_no: 3, result: "Make" }),
      shot({ round_id: "r1", hole: 1, shot_no: 1, result: "Fairway" }),
      shot({ round_id: "r1", hole: 1, shot_no: 2, result: "Green" }),
      shot({ round_id: "r1", hole: 2, shot_no: 1, result: "Green" }), // partial
    ];
    const holes = aggregateByRoundHole(shots);
    expect(holes).toHaveLength(2);

    const h1 = holes.find((h) => h.hole === 1)!;
    expect(h1.shots.map((s) => s.shot_no)).toEqual([1, 2, 3]); // sorted
    expect(h1.lastShotNo).toBe(3);
    expect(h1.lastShotResult).toBe("Make");
    expect(h1.complete).toBe(true);

    const h2 = holes.find((h) => h.hole === 2)!;
    expect(h2.complete).toBe(false); // last result is not 'Make'
  });

  it("flags a hole as conceded if any shot is conceded (but not complete)", () => {
    const holes = aggregateByRoundHole([
      shot({ round_id: "r1", hole: 1, shot_no: 1, club: "D", result: "Rough" }),
      shot({ round_id: "r1", hole: 1, shot_no: 2, club: "LW", result: "Bunker", conceded: true }),
    ]);
    expect(holes[0].complete).toBe(false); // no Make → not counted for scoring
    expect(holes[0].conceded).toBe(true);
  });

  it("a normal unfinished hole is not conceded", () => {
    const holes = aggregateByRoundHole([
      shot({ round_id: "r1", hole: 1, shot_no: 1, club: "D", result: "Rough" }),
    ]);
    expect(holes[0].conceded).toBe(false);
  });
});

// ─── strokesToReachGreen — D-04 three paths ───────────────────────────────────

describe("strokesToReachGreen (D-04)", () => {
  it("path 1 — first 'Green' shot, plus penalties through it", () => {
    const shots = [
      shot({ shot_no: 1, result: "Fairway" }),
      shot({ shot_no: 2, result: "Green" }),
      shot({ shot_no: 3, club: "Putter", result: "Make" }),
    ];
    expect(strokesToReachGreen({ shots, strokes: 3 })).toBe(2);
  });

  it("path 1 — penalty before the green counts", () => {
    const shots = [
      shot({ shot_no: 1, result: "OB", penalty: 1 }),
      shot({ shot_no: 2, result: "Fairway" }),
      shot({ shot_no: 3, result: "Green" }),
      shot({ shot_no: 4, club: "Putter", result: "Make" }),
    ];
    // reach = shot_no(3) + penalties through it (1) = 4
    expect(strokesToReachGreen({ shots, strokes: 5 })).toBe(4);
  });

  it("path 2 — legacy untagged: shot before first (non-holing) putter", () => {
    const shots = [
      shot({ shot_no: 1, result: "Fairway" }),
      shot({ shot_no: 2, result: "Rough" }), // approach, never tagged Green
      shot({ shot_no: 3, club: "Putter", result: null }),
      shot({ shot_no: 4, club: "Putter", result: "Make" }),
    ];
    // (firstPutter.shot_no - 1) + penaltiesBeforeFirstPutt = (3-1) + 0 = 2
    expect(strokesToReachGreen({ shots, strokes: 4 })).toBe(2);
  });

  it("path 3 — chip-in hole-out (no Green, no putter) → total strokes", () => {
    const shots = [
      shot({ shot_no: 1, result: "Fairway" }),
      shot({ shot_no: 2, club: "LW", result: "Make" }),
    ];
    expect(strokesToReachGreen({ shots, strokes: 2 })).toBe(2);
  });

  it("path 3 — Texas-wedge hole-out: first putter holed from off-green", () => {
    const shots = [
      shot({ shot_no: 1, result: "Fairway" }),
      shot({ shot_no: 2, club: "Putter", result: "Make" }), // holed from off green
    ];
    // firstPutter.result === 'Make' → skip fallback A → total strokes
    expect(strokesToReachGreen({ shots, strokes: 2 })).toBe(2);
  });
});

// ─── enrichRoundHole ──────────────────────────────────────────────────────────

describe("enrichRoundHole", () => {
  it("computes strokes, putts, gir, teeResult, and shot quality", () => {
    // Par 4: drive (FW), approach (Green) in 2 → GIR (2 <= par-2), then 2 putts.
    const rh = aggregateByRoundHole([
      shot({ shot_no: 1, par: 4, club: "D", result: "Fairway", execution: 3 }),
      shot({ shot_no: 2, par: 4, club: "8i", result: "Green", execution: 4 }),
      shot({ shot_no: 3, par: 4, club: "Putter", result: null }),
      shot({ shot_no: 4, par: 4, club: "Putter", result: "Make" }),
    ])[0];

    const e = enrichRoundHole(rh);
    expect(e.strokes).toBe(4); // max shot_no 4 + 0 penalties
    expect(e.putts).toBe(2); // two post-green putters
    expect(e.gir).toBe(true); // reach 2 <= 4-2
    expect(e.teeResult).toBe("Fairway");
    expect(e.nonPuttExecSum).toBe(7); // 3 + 4 (putters excluded)
    expect(e.nonPuttExecCount).toBe(2);
  });

  it("SPEC worked example — OB tee on a par 5 scores 6 (bogey)", () => {
    // From SPEC.md "Stroke-counting rule":
    //   1: D, exec1, miss Right, OB, penalty 1
    //   2: D (re-tee), exec3, Fairway
    //   3: LW, Green
    //   4–5: putts (last Make)
    const rh = aggregateByRoundHole([
      shot({ shot_no: 1, par: 5, club: "D", execution: 1, miss_direction: "Right", result: "OB", penalty: 1 }),
      shot({ shot_no: 2, par: 5, club: "D", execution: 3, result: "Fairway" }),
      shot({ shot_no: 3, par: 5, club: "LW", result: "Green" }),
      shot({ shot_no: 4, par: 5, club: "Putter", result: null }),
      shot({ shot_no: 5, par: 5, club: "Putter", result: "Make" }),
    ])[0];

    const e = enrichRoundHole(rh);
    expect(e.strokes).toBe(6); // 5 shots + 1 penalty
    expect(e.putts).toBe(2);
    // reach green = shot 3 + penalty through it (1) = 4; par-2 = 3 → not GIR
    expect(e.gir).toBe(false);
    expect(e.teeResult).toBe("OB");
  });

  it("does not count a Texas wedge as a putt", () => {
    // Putter from off the green reaches the green (tagged Green), then one putt.
    const rh = aggregateByRoundHole([
      shot({ shot_no: 1, par: 3, club: "7i", result: "Rough" }),
      shot({ shot_no: 2, par: 3, club: "Putter", result: "Green" }), // Texas wedge
      shot({ shot_no: 3, par: 3, club: "Putter", result: "Make" }),
    ])[0];

    const e = enrichRoundHole(rh);
    expect(e.putts).toBe(1); // only the post-green putter
  });
});

// ─── r2 ───────────────────────────────────────────────────────────────────────

describe("r2", () => {
  it("rounds to two decimals", () => {
    expect(r2(1 / 3)).toBe(0.33);
    // 2.005*100 === 200.50000000000003 in V8 → rounds up. r2 uses the same
    // Math.round(n*100)/100 as .gs, so this documents the shared behaviour.
    expect(r2(2.005)).toBe(2.01);
    expect(r2(4)).toBe(4);
  });
});
