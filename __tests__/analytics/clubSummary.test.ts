import { describe, it, expect } from "vitest";
import { computeClubSummary } from "@/lib/analytics/clubSummary";
import type { ShotRow } from "@/lib/schemas/shot";

/**
 * Expected values derived by tracing rebuildClubSummary in golf_stats.gs over a
 * hand-built fixture. Note the .gs aggregates EVERY shot (not just complete
 * holes), so these fixtures intentionally include shots on a partial hole.
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

function fixture(): ShotRow[] {
  return [
    // D — two tee shots on par 4/5; one fairway, one missed left. No yardage.
    shot({ club: "D", hole: 1, par: 4, shot_no: 1, result: "Fairway", execution: 3 }),
    shot({ club: "D", hole: 2, par: 5, shot_no: 1, result: "Rough", miss_direction: "Left", execution: 2 }),

    // 8i — two approaches; one green, one long miss.
    shot({ club: "8i", hole: 1, par: 4, shot_no: 2, result: "Green", execution: 4, yardage: 150 }),
    shot({ club: "8i", hole: 2, par: 5, shot_no: 3, result: "Rough", miss_direction: "Long", execution: 2, yardage: 160 }),

    // 7i — a par-3 tee shot, which must be classified as an APPROACH.
    shot({ club: "7i", hole: 3, par: 3, shot_no: 1, result: "Green", execution: 3, yardage: 140 }),

    // SW — a bunker shot.
    shot({ club: "SW", hole: 2, par: 5, shot_no: 4, result: "Bunker", execution: 1, yardage: 30 }),

    // Putter — must be EXCLUDED from the club summary entirely.
    shot({ club: "Putter", hole: 1, par: 4, shot_no: 3, result: "Make" }),
  ];
}

describe("computeClubSummary", () => {
  const rows = computeClubSummary(fixture());
  const byClub = (c: string) => rows.find((r) => r.club === c)!;

  it("excludes the Putter", () => {
    expect(rows.find((r) => r.club === "Putter")).toBeUndefined();
  });

  it("sorts by canonical CLUBS order", () => {
    expect(rows.map((r) => r.club)).toEqual(["D", "7i", "8i", "SW"]);
  });

  it("D — tee shots: FW%, miss, quality; no yardage → null avgYds", () => {
    const d = byClub("D");
    expect(d.shots).toBe(2);
    expect(d.fwPct).toBe(0.5); // 1 of 2 fairways
    expect(d.greenPct).toBeNull(); // never an approach
    expect(d.missLPct).toBe(0.5); // 1 left of 2 shots
    expect(d.avgQuality).toBe(2.5); // (3 + 2) / 2
    expect(d.avgYds).toBeNull(); // no yardage logged
  });

  it("8i — approaches: Green%, avg yards rounded, long miss", () => {
    const i8 = byClub("8i");
    expect(i8.shots).toBe(2);
    expect(i8.fwPct).toBeNull(); // never a tee shot
    expect(i8.greenPct).toBe(0.5); // 1 of 2 greens
    expect(i8.avgQuality).toBe(3); // (4 + 2) / 2
    expect(i8.avgYds).toBe(155); // round((150 + 160) / 2)
    expect(i8.missLongPct).toBe(0.5);
  });

  it("7i — par-3 tee shot counts as an approach", () => {
    const i7 = byClub("7i");
    expect(i7.shots).toBe(1);
    expect(i7.fwPct).toBeNull(); // par-3 tee is NOT a tee-shot stat
    expect(i7.greenPct).toBe(1); // hit the green
    expect(i7.avgYds).toBe(140);
  });

  it("SW — bunker shot", () => {
    const sw = byClub("SW");
    expect(sw.shots).toBe(1);
    expect(sw.bunkerPct).toBe(1);
    expect(sw.greenPct).toBe(0); // approach, but not a green
    expect(sw.avgQuality).toBe(1);
  });
});

describe("computeClubSummary — empty input", () => {
  it("returns no rows", () => {
    expect(computeClubSummary([])).toEqual([]);
  });
});
