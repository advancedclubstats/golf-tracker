import { describe, it, expect } from "vitest";
import { computeDashboard } from "@/lib/analytics/dashboard";
import type { ShotRow } from "@/lib/schemas/shot";

/**
 * Expected values derived by tracing rebuildDashboard in golf_stats.gs over a
 * two-round fixture. Putt yardages are in YARDS (×3 → feet).
 */

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

const rounds = [
  { id: "r1", date: "2026-05-01" },
  { id: "r2", date: "2026-05-08" },
];

function fixture(): ShotRow[] {
  return [
    // r1 H1 par4 — score 4 (par): FW drive, GIR, 2 putts.
    shot({ round_id: "r1", hole: 1, par: 4, shot_no: 1, club: "D", result: "Fairway", execution: 3 }),
    shot({ round_id: "r1", hole: 1, par: 4, shot_no: 2, club: "8i", result: "Green", execution: 4, yardage: 150 }),
    shot({ round_id: "r1", hole: 1, par: 4, shot_no: 3, club: "Putter", result: null, yardage: 3 }),
    shot({ round_id: "r1", hole: 1, par: 4, shot_no: 4, club: "Putter", result: "Make", yardage: 1 }),

    // r1 H2 par4 — score 6 (+2): tagged tee miss, missed green, 3 putts.
    shot({ round_id: "r1", hole: 2, par: 4, shot_no: 1, club: "D", result: "Rough", miss_direction: "Left", execution: 2 }),
    shot({ round_id: "r1", hole: 2, par: 4, shot_no: 2, club: "7i", result: "Rough", execution: 2, yardage: 140 }),
    shot({ round_id: "r1", hole: 2, par: 4, shot_no: 3, club: "SW", result: "Green", execution: 2, yardage: 30 }),
    shot({ round_id: "r1", hole: 2, par: 4, shot_no: 4, club: "Putter", result: null, yardage: 2 }),
    shot({ round_id: "r1", hole: 2, par: 4, shot_no: 5, club: "Putter", result: null, yardage: 1 }),
    shot({ round_id: "r1", hole: 2, par: 4, shot_no: 6, club: "Putter", result: "Make", yardage: 1 }),

    // r2 H1 par4 — score 5 (+1): FW drive, GIR, 3 putts (putting lost).
    shot({ round_id: "r2", hole: 1, par: 4, shot_no: 1, club: "D", result: "Fairway", execution: 3 }),
    shot({ round_id: "r2", hole: 1, par: 4, shot_no: 2, club: "8i", result: "Green", execution: 3, yardage: 150 }),
    shot({ round_id: "r2", hole: 1, par: 4, shot_no: 3, club: "Putter", result: null, yardage: 4 }),
    shot({ round_id: "r2", hole: 1, par: 4, shot_no: 4, club: "Putter", result: null, yardage: 2 }),
    shot({ round_id: "r2", hole: 1, par: 4, shot_no: 5, club: "Putter", result: "Make", yardage: 1 }),

    // r2 H2 par3 — score 3 (par): tee to green, 2 putts.
    shot({ round_id: "r2", hole: 2, par: 3, shot_no: 1, club: "7i", result: "Green", execution: 4, yardage: 140 }),
    shot({ round_id: "r2", hole: 2, par: 3, shot_no: 2, club: "Putter", result: null, yardage: 3 }),
    shot({ round_id: "r2", hole: 2, par: 3, shot_no: 3, club: "Putter", result: "Make", yardage: 1 }),
  ];
}

const dash = computeDashboard(fixture(), rounds);

describe("dashboard — snapshot", () => {
  it("totals and averages over complete holes", () => {
    expect(dash.snapshot).toEqual({
      roundsLogged: 2,
      holesLogged: 4,
      totalVsPar: 3, // (4+6) + (5+3) - (8 + 7) = 18 - 15
      avgVsParPerRound: 1.5, // 3 / 2
      avgVsParPerHole: 0.75, // 3 / 4
    });
  });
});

describe("dashboard — stat line", () => {
  it("FW%, GIR%, scramble, putts", () => {
    expect(dash.statLine.fwPct).toBeCloseTo(2 / 3, 10); // 2 of 3 par4/5 tees
    expect(dash.statLine.girPct).toBe(0.75); // 3 of 4
    expect(dash.statLine.scramblePct).toBe(0); // 1 green missed, not saved
    expect(dash.statLine.avgPutts).toBe(2.5); // (2+3+3+2)/4
    expect(dash.statLine.threePuttPct).toBe(0.5); // 2 of 4 holes
  });
});

describe("dashboard — strokes lost", () => {
  it("attributes over-par strokes to tee / approach / putting", () => {
    expect(dash.strokesLost).toMatchObject({
      tee: 1, // r1 H2: tagged tee miss on a +2 hole, 1 non-putt stroke lost
      approach: 0,
      putting: 2, // r1 H2 third putt + r2 H1 third putt
      total: 3,
    });
    expect(dash.strokesLost.teePct).toBeCloseTo(1 / 3, 10);
    expect(dash.strokesLost.puttingPct).toBeCloseTo(2 / 3, 10);
    expect(dash.strokesLost.approachPct).toBe(0);
  });
});

describe("dashboard — what to work on", () => {
  it("worst hole is highest cumulative vs par (D-07)", () => {
    expect(dash.whatToWorkOn.worstHole).toMatchObject({ hole: 2, vsPar: 2, rounds: 2 });
  });
  it("worst club is the eligible (>=3 shots) club with lowest avg quality", () => {
    // Only D has >=3 shots (3 drives: exec 3,2,3 → 2.67). It's the only eligible.
    expect(dash.whatToWorkOn.worstClub).toMatchObject({ club: "D", avgQuality: 2.67, shots: 3 });
  });
  it("worst approach is the eligible (>=3 shots) bucket with lowest green%", () => {
    expect(dash.whatToWorkOn.worstApproach).toMatchObject({ label: "125–175 yds", shots: 4 });
    expect(dash.whatToWorkOn.worstApproach!.greenHitPct).toBe(0.75); // 3 of 4
  });
  it("worst putt is null when no bucket clears the 3-putt / non-tap-in threshold", () => {
    expect(dash.whatToWorkOn.worstPutt).toBeNull();
  });
});

describe("dashboard — recent rounds", () => {
  it("lists rounds newest first", () => {
    expect(dash.recentRounds.map((r) => r.roundId)).toEqual(["r2", "r1"]);
    expect(dash.recentRounds[0]).toMatchObject({ roundId: "r2", holes: 2, strokes: 8, par: 7, vsPar: 1 });
    expect(dash.recentRounds[1]).toMatchObject({ roundId: "r1", strokes: 10, par: 8, vsPar: 2 });
  });
});

describe("dashboard — records", () => {
  it("best/worst round by vs par, birdies, eagles", () => {
    expect(dash.records.bestRound).toMatchObject({ roundId: "r2", vsPar: 1 });
    expect(dash.records.worstRound).toMatchObject({ roundId: "r1", vsPar: 2 });
    expect(dash.records.bestHole).toMatchObject({ hole: 1, vsPar: 1 });
    expect(dash.records.birdies).toBe(0);
    expect(dash.records.eagles).toBe(0);
  });
});

describe("dashboard — empty input", () => {
  it("returns a zeroed structure when there are no complete holes", () => {
    const empty = computeDashboard([], []);
    expect(empty.snapshot.holesLogged).toBe(0);
    expect(empty.recentRounds).toEqual([]);
    expect(empty.records.bestRound).toBeNull();
    expect(empty.whatToWorkOn.worstHole).toBeNull();
  });
});
