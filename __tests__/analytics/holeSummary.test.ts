import { describe, it, expect } from "vitest";
import { computeHoleSummary } from "@/lib/analytics/holeSummary";
import type { ShotRow } from "@/lib/schemas/shot";

/**
 * Expected values derived by tracing rebuildHoleSummary in golf_stats.gs over a
 * hand-built two-round fixture (the agreed P2-T1/T2 verification method).
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
    mulligan: false,
    penalty: 0,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  };
}

// ── Fixture: two rounds, hole 1 (par 4) and hole 2 (par 3), plus one
//    incomplete hole on r2 that must be excluded. ─────────────────────────────
function fixture(): ShotRow[] {
  return [
    // r1 hole 1 (par 4): FW drive, green in 2 → GIR, 2 putts. Score 4.
    shot({ round_id: "r1", hole: 1, par: 4, shot_no: 1, club: "D", result: "Fairway", execution: 3 }),
    shot({ round_id: "r1", hole: 1, par: 4, shot_no: 2, club: "8i", result: "Green", execution: 4 }),
    shot({ round_id: "r1", hole: 1, par: 4, shot_no: 3, club: "Putter", result: null }),
    shot({ round_id: "r1", hole: 1, par: 4, shot_no: 4, club: "Putter", result: "Make" }),

    // r1 hole 2 (par 3): missed green, up-and-down save. Score 3 (= par).
    shot({ round_id: "r1", hole: 2, par: 3, shot_no: 1, club: "7i", result: "Rough", execution: 2 }),
    shot({ round_id: "r1", hole: 2, par: 3, shot_no: 2, club: "SW", result: "Green", execution: 3 }),
    shot({ round_id: "r1", hole: 2, par: 3, shot_no: 3, club: "Putter", result: "Make" }),

    // r2 hole 1 (par 4): missed FW, GIR, 3 putts. Score 5.
    shot({ round_id: "r2", hole: 1, par: 4, shot_no: 1, club: "D", result: "Rough", execution: 2 }),
    shot({ round_id: "r2", hole: 1, par: 4, shot_no: 2, club: "9i", result: "Green", execution: 3 }),
    shot({ round_id: "r2", hole: 1, par: 4, shot_no: 3, club: "Putter", result: null }),
    shot({ round_id: "r2", hole: 1, par: 4, shot_no: 4, club: "Putter", result: null }),
    shot({ round_id: "r2", hole: 1, par: 4, shot_no: 5, club: "Putter", result: "Make" }),

    // r2 hole 2 (par 3): tee onto green, 2 putts. Score 3 (= par).
    shot({ round_id: "r2", hole: 2, par: 3, shot_no: 1, club: "7i", result: "Green", execution: 4 }),
    shot({ round_id: "r2", hole: 2, par: 3, shot_no: 2, club: "Putter", result: null }),
    shot({ round_id: "r2", hole: 2, par: 3, shot_no: 3, club: "Putter", result: "Make" }),

    // r2 hole 3 (par 4): INCOMPLETE — last shot is 'Green', not 'Make'.
    shot({ round_id: "r2", hole: 3, par: 4, shot_no: 1, club: "D", result: "Fairway" }),
    shot({ round_id: "r2", hole: 3, par: 4, shot_no: 2, club: "8i", result: "Green" }),
  ];
}

describe("computeHoleSummary", () => {
  const summary = computeHoleSummary(fixture());

  it("counts complete round-holes and excludes incomplete ones", () => {
    expect(summary.completeCount).toBe(4);
    expect(summary.excluded).toEqual([{ roundId: "r2", hole: 3, conceded: false }]);
  });

  it("returns one row per hole, ascending", () => {
    expect(summary.rows.map((r) => r.hole)).toEqual([1, 2]);
  });

  it("hole 1 (par 4) — scores, FW%, GIR, putts, 3-putt, quality", () => {
    const h1 = summary.rows.find((r) => r.hole === 1)!;
    expect(h1.par).toBe(4);
    expect(h1.rounds).toBe(2);
    expect(h1.avgScore).toBe(4.5); // (4 + 5) / 2
    expect(h1.best).toBe(4);
    expect(h1.avgVsPar).toBe(0.5); // 4.5 - 4
    expect(h1.allTimeVsPar).toBe(1); // 9 - 4*2
    expect(h1.fwPct).toBe(0.5); // 1 of 2 fairways
    expect(h1.girPct).toBe(1); // both GIR
    expect(h1.scramblePct).toBeNull(); // no greens missed
    expect(h1.avgPutts).toBe(2.5); // (2 + 3) / 2
    expect(h1.threePuttPct).toBe(0.5); // r2 had 3 putts
    expect(h1.shotQuality).toBe(3); // (3+4 + 2+3) / 4 = 12/4
  });

  it("hole 2 (par 3) — FW% is null, scramble save counts", () => {
    const h2 = summary.rows.find((r) => r.hole === 2)!;
    expect(h2.par).toBe(3);
    expect(h2.rounds).toBe(2);
    expect(h2.avgScore).toBe(3); // (3 + 3) / 2
    expect(h2.avgVsPar).toBe(0);
    expect(h2.allTimeVsPar).toBe(0); // 6 - 3*2
    expect(h2.fwPct).toBeNull(); // par 3 → no fairway stat
    expect(h2.girPct).toBe(0.5); // r1 missed, r2 hit
    expect(h2.scramblePct).toBe(1); // r1 missed green but saved par
    expect(h2.avgPutts).toBe(1.5); // (1 + 2) / 2
    expect(h2.threePuttPct).toBe(0);
    expect(h2.shotQuality).toBe(3); // (2+3 + 4) / 3 = 9/3
  });
});

describe("computeHoleSummary — empty input", () => {
  it("returns no rows and zero counts", () => {
    const summary = computeHoleSummary([]);
    expect(summary.rows).toEqual([]);
    expect(summary.completeCount).toBe(0);
    expect(summary.excluded).toEqual([]);
  });
});
