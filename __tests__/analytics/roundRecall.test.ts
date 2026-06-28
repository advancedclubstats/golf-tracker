import { describe, it, expect } from "vitest";
import { roundRecall, roundTakeaway } from "@/lib/analytics/roundRecall";
import type { RoundBreakdown, RoundMetric } from "@/lib/analytics/roundCard";
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
  };
}

/** Par-4 played to bogey: tee→fairway, approach long into rough, chip on, 2 putts. */
function bogeyHole(round: string, hole: number, over: Partial<ShotRow> = {}): ShotRow[] {
  return [
    shot({ round_id: round, hole, par: 4, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "Fairway" }),
    shot({ round_id: round, hole, par: 4, shot_no: 2, club: "7i", start_lie: "Fairway", yardage: 160, result: "Rough", miss_direction: "Long", ...over }),
    shot({ round_id: round, hole, par: 4, shot_no: 3, club: "SW", start_lie: "Rough", yardage: 20, result: "Green" }),
    shot({ round_id: round, hole, par: 4, shot_no: 4, club: "Putter", start_lie: "Green", yardage: 6, result: null }),
    shot({ round_id: round, hole, par: 4, shot_no: 5, club: "Putter", start_lie: "Green", yardage: 1, result: "Make" }),
  ];
}

/** Par-4 with a three-putt: green in regulation, then 3 putts (putting loss). */
function threePuttHole(round: string, hole: number): ShotRow[] {
  return [
    shot({ round_id: round, hole, par: 4, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "Fairway" }),
    shot({ round_id: round, hole, par: 4, shot_no: 2, club: "7i", start_lie: "Fairway", yardage: 160, result: "Green" }),
    shot({ round_id: round, hole, par: 4, shot_no: 3, club: "Putter", start_lie: "Green", yardage: 30, result: null }),
    shot({ round_id: round, hole, par: 4, shot_no: 4, club: "Putter", start_lie: "Green", yardage: 4, result: null }),
    shot({ round_id: round, hole, par: 4, shot_no: 5, club: "Putter", start_lie: "Green", yardage: 1, result: "Make" }),
  ];
}

describe("roundRecall", () => {
  it("returns one entry per hole, ascending, scoped to the round", () => {
    const rows = roundRecall(
      [
        ...bogeyHole("r1", 3),
        ...threePuttHole("r1", 1),
        ...bogeyHole("r2", 5), // other round — must be excluded
      ],
      "r1",
    );
    expect(rows.map((r) => r.hole)).toEqual([1, 3]);
  });

  it("scores complete holes and reports vs par", () => {
    const [h1] = roundRecall(threePuttHole("r1", 1), "r1");
    expect(h1.strokes).toBe(5); // bogey
    expect(h1.vsPar).toBe(1);
    expect(h1.conceded).toBe(false);
  });

  it("leaves an in-progress hole's score null", () => {
    const open = [
      shot({ round_id: "r1", hole: 1, par: 4, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "Fairway" }),
      shot({ round_id: "r1", hole: 1, par: 4, shot_no: 2, club: "7i", start_lie: "Fairway", yardage: 160, result: "Green" }),
    ];
    const [h1] = roundRecall(open, "r1");
    expect(h1.strokes).toBeNull();
    expect(h1.vsPar).toBeNull();
  });

  it("flags a conceded hole with a null score", () => {
    const conceded = [
      shot({ round_id: "r1", hole: 1, par: 4, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "Rough", conceded: true }),
    ];
    const [h1] = roundRecall(conceded, "r1");
    expect(h1.conceded).toBe(true);
    expect(h1.strokes).toBeNull();
  });

  it("identifies the dominant losing category on a three-putt hole", () => {
    const [h1] = roundRecall(threePuttHole("r1", 1), "r1");
    expect(h1.worstCategory).toBe("Putting");
    expect(h1.sgByCategory.Putting).toBeLessThan(0);
  });

  it("marks holes with a bad-decision shot", () => {
    const [good] = roundRecall(bogeyHole("r1", 1), "r1");
    expect(good.hasBadDecision).toBe(false);
    const [bad] = roundRecall(
      bogeyHole("r1", 1, { decision_quality: "Bad" }),
      "r1",
    );
    expect(bad.hasBadDecision).toBe(true);
  });

  it("carries the first-domino read on a blow-up hole, null on a routine one", () => {
    // Double bogey via an OB tee shot — a blow-up; the domino is the drive.
    const blowup = [
      shot({ round_id: "r1", hole: 1, par: 4, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "OB", penalty: 1 }),
      shot({ round_id: "r1", hole: 1, par: 4, shot_no: 2, club: "D", start_lie: "Tee", yardage: 400, result: "Fairway" }),
      shot({ round_id: "r1", hole: 1, par: 4, shot_no: 3, club: "8i", start_lie: "Fairway", yardage: 150, result: "Green" }),
      shot({ round_id: "r1", hole: 1, par: 4, shot_no: 4, club: "Putter", start_lie: "Green", yardage: 20 / 3, result: null }),
      shot({ round_id: "r1", hole: 1, par: 4, shot_no: 5, club: "Putter", start_lie: "Green", yardage: 1, result: "Make" }),
    ];
    const [h1] = roundRecall(blowup, "r1");
    expect(h1.rootCauseShotNo).toBe(1);
    expect(h1.rootCauseCategory).toBe("Off the tee");
    expect(h1.recoveryShotNos).toEqual([2, 3, 4, 5]);

    // A routine bogey is not a blow-up — no domino surfaces.
    const [routine] = roundRecall(bogeyHole("r1", 1), "r1");
    expect(routine.rootCauseShotNo).toBeNull();
    expect(routine.recoveryShotNos).toEqual([]);
  });

  it("sets sgCovered false when a shot breaks the SG chain", () => {
    // shot 2 has no start_lie/yardage → no baseline, so the chain has a gap.
    const gap = [
      shot({ round_id: "r1", hole: 1, par: 4, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "Fairway" }),
      shot({ round_id: "r1", hole: 1, par: 4, shot_no: 2, club: "7i", start_lie: null, yardage: null, result: "Green" }),
      shot({ round_id: "r1", hole: 1, par: 4, shot_no: 3, club: "Putter", start_lie: "Green", yardage: 4, result: "Make" }),
    ];
    const [h1] = roundRecall(gap, "r1");
    expect(h1.sgCovered).toBe(false);
    const [full] = roundRecall(threePuttHole("r1", 1), "r1");
    expect(full.sgCovered).toBe(true);
  });
});

function metric(p: Partial<RoundMetric> & Pick<RoundMetric, "key">): RoundMetric {
  return { label: "x", kind: "sg", value: 0, delta: 0, lowerIsBetter: false, ...p };
}

function breakdown(p: Partial<RoundBreakdown>): RoundBreakdown {
  return { roundId: "r1", holes: 18, metrics: [], eligible: true, ...p };
}

describe("roundTakeaway", () => {
  it("headlines the largest eligible SG swing (positive → carried)", () => {
    const b = breakdown({
      metrics: [
        metric({ key: "sg:Approach", label: "Approach", delta: 1.8 }),
        metric({ key: "sg:Putting", label: "Putting", delta: -0.3 }),
      ],
    });
    expect(roundTakeaway(b)).toContain("Approach carried this round");
    expect(roundTakeaway(b)).toContain("+1.8");
  });

  it("headlines a negative swing as the leak", () => {
    const b = breakdown({
      metrics: [metric({ key: "sg:Putting", label: "Putting", delta: -2.1 })],
    });
    expect(roundTakeaway(b)).toContain("Putting was the leak this round");
    expect(roundTakeaway(b)).toContain("−2.1");
  });

  it("falls back to a steady-round line when nothing crosses the threshold", () => {
    const b = breakdown({
      metrics: [metric({ key: "sg:Approach", label: "Approach", delta: 0.2 })],
    });
    expect(roundTakeaway(b)).toMatch(/steady round/i);
  });

  it("gives a raw, non-comparative line below the floor", () => {
    const b = breakdown({
      eligible: false,
      holes: 9,
      metrics: [metric({ key: "score", label: "Score", kind: "score", value: 4, lowerIsBetter: true })],
    });
    const line = roundTakeaway(b);
    expect(line).toContain("9 holes");
    expect(line).toContain("+4");
    expect(line).not.toMatch(/vs your average/i);
  });
});
