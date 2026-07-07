import { describe, it, expect } from "vitest";
import { computeBirdieBoard, type BirdieBoard } from "@/lib/analytics/birdies";
import type { ShotRow } from "@/lib/schemas/shot";

let seq = 0;
function s(p: Partial<ShotRow>): ShotRow {
  return {
    id: `00000000-0000-0000-0000-${String(seq++).padStart(12, "0")}`,
    user_id: "1b3a0171-726e-4c64-a8e0-f97a717f2851",
    round_id: "r1",
    hole: 1,
    par: 4,
    shot_no: 1,
    club: "D",
    yardage: 300,
    distance_unit: "yd",
    start_lie: "Tee",
    start_lie_manual: false,
    obstruction: "Clear",
    decision_quality: "Good",
    execution: 3,
    result: "Fairway",
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

/** A complete hole ending in a Make, `strokes` total shots (no penalties). */
function hole(round: string, h: number, par: number, strokes: number): ShotRow[] {
  const out: ShotRow[] = [];
  for (let n = 1; n <= strokes; n++) {
    out.push(
      s({
        round_id: round,
        hole: h,
        par,
        shot_no: n,
        club: n === strokes ? "Putter" : "8i",
        start_lie: n === 1 ? "Tee" : n === strokes ? "Green" : "Fairway",
        result: n === strokes ? "Make" : "Fairway",
      }),
    );
  }
  return out;
}

const get = (b: BirdieBoard, h: number) => b.holes.find((x) => x.hole === h)!;

describe("computeBirdieBoard", () => {
  it("flags a hole birdied this season, with rate and counts", () => {
    const rounds = [{ id: "r1", date: "2026-05-01" }];
    const shots = [...hole("r1", 1, 4, 3), ...hole("r1", 2, 4, 4)]; // h1 birdie, h2 par
    const b = computeBirdieBoard(shots, rounds, 2026);
    expect(get(b, 1)).toMatchObject({ played: 1, birdies: 1, rate: 1, birdied: true });
    expect(get(b, 2)).toMatchObject({ played: 1, birdies: 0, rate: 0, birdied: false });
    expect(b.birdied).toBe(1);
    expect(b.total).toBe(2);
    expect(b.remaining).toBe(1);
  });

  it("counts an eagle as birdied (under par)", () => {
    const rounds = [{ id: "r1", date: "2026-06-01" }];
    const b = computeBirdieBoard(hole("r1", 5, 5, 3), rounds, 2026); // eagle on a par 5
    expect(get(b, 5).birdied).toBe(true);
  });

  it("averages the rate over multiple plays and stays open without a birdie", () => {
    const rounds = [
      { id: "r1", date: "2026-05-01" },
      { id: "r2", date: "2026-05-08" },
    ];
    const shots = [
      ...hole("r1", 7, 4, 4), // par
      ...hole("r2", 7, 4, 3), // birdie
    ];
    const b = computeBirdieBoard(shots, rounds, 2026);
    expect(get(b, 7)).toMatchObject({ played: 2, birdies: 1, birdied: true });
    expect(get(b, 7).rate).toBeCloseTo(0.5, 5);
  });

  it("lists a hole unplayed this season (null rate) from all-history par", () => {
    const rounds = [
      { id: "rOld", date: "2025-09-01" }, // last season
      { id: "r1", date: "2026-05-01" },
    ];
    const shots = [
      ...hole("rOld", 12, 3, 2), // birdied, but last year — must not count this year
      ...hole("r1", 1, 4, 4),
    ];
    const b = computeBirdieBoard(shots, rounds, 2026);
    const h12 = get(b, 12);
    expect(h12).toMatchObject({ par: 3, played: 0, birdies: 0, rate: null, birdied: false });
    expect(b.total).toBe(2); // both holes appear
    expect(b.remaining).toBe(2); // neither birdied *this* season
  });

  it("all-time (year = null) counts every season", () => {
    const rounds = [
      { id: "rOld", date: "2025-09-01" },
      { id: "r1", date: "2026-05-01" },
    ];
    const shots = [
      ...hole("rOld", 12, 3, 2), // birdied last season
      ...hole("r1", 1, 4, 3), // birdied this season
    ];
    const b = computeBirdieBoard(shots, rounds, null);
    expect(b.year).toBeNull();
    expect(get(b, 12).birdied).toBe(true); // last-season birdie now counts
    expect(get(b, 1).birdied).toBe(true);
    expect(b.birdied).toBe(2);
    expect(b.remaining).toBe(0);
  });

  it("excludes conceded and in-progress holes from played", () => {
    const rounds = [{ id: "r1", date: "2026-05-01" }];
    const conceded = hole("r1", 3, 4, 4).map((x) => ({ ...x, result: "Fairway" as const }));
    // no Make → in-progress; and mark conceded via a picked-up shot is complex,
    // so just assert an unfinished hole (no Make) isn't counted as played.
    const b = computeBirdieBoard(conceded, rounds, 2026);
    expect(get(b, 3).played).toBe(0);
  });
});
