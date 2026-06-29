import { describe, it, expect } from "vitest";
import { computeStreaks, selectChase, CHASE_MIN_BEST } from "@/lib/analytics/streaks";
import type { Streak } from "@/lib/analytics/streaks";
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

/**
 * Build one complete hole ending in a Make. `strokes` = total shots (no
 * penalties); the last `putts` shots are real putts (start_lie Green). Optionally
 * tag the green-reaching shot with an approach yardage.
 */
function hole(opts: {
  round: string;
  hole: number;
  par: number;
  strokes: number;
  putts?: number;
  approachYd?: number;
}): ShotRow[] {
  const { round, par, strokes } = opts;
  const h = opts.hole;
  const putts = opts.putts ?? 0;
  const full = strokes - putts;
  const shots: ShotRow[] = [];
  for (let n = 1; n <= full; n++) {
    const reachGreen = n === full;
    shots.push(
      s({
        round_id: round,
        hole: h,
        par,
        shot_no: n,
        club: n === 1 ? (par === 3 ? "7i" : "D") : "8i",
        start_lie: n === 1 ? "Tee" : "Fairway",
        yardage:
          n === 1 ? 300 : reachGreen && opts.approachYd != null ? opts.approachYd : 180,
        result: putts === 0 && reachGreen ? "Make" : reachGreen ? "Green" : "Fairway",
        distance_unit: "yd",
      }),
    );
  }
  for (let k = 1; k <= putts; k++) {
    const n = full + k;
    shots.push(
      s({
        round_id: round,
        hole: h,
        par,
        shot_no: n,
        club: "Putter",
        start_lie: "Green",
        yardage: 5,
        distance_unit: "ft",
        result: n === strokes ? "Make" : "Fairway",
      }),
    );
  }
  return shots;
}

const get = (streaks: ReturnType<typeof computeStreaks>, key: Streak["key"]) =>
  streaks.metrics.find((m) => m.key === key)!;

describe("computeStreaks", () => {
  it("counts the current trailing run and the all-time best per opportunity", () => {
    // Par-5 sequence across two rounds (chronological): clean, clean, BOGEY,
    // clean, clean, clean. Best run = 3 (the tail), current = 3, record.
    const rounds = [
      { id: "r1", date: "2026-01-01" },
      { id: "r2", date: "2026-01-02" },
    ];
    const shots = [
      ...hole({ round: "r1", hole: 1, par: 5, strokes: 5 }), // clean
      ...hole({ round: "r1", hole: 2, par: 5, strokes: 5 }), // clean
      ...hole({ round: "r1", hole: 3, par: 5, strokes: 6 }), // bogey → reset
      ...hole({ round: "r2", hole: 1, par: 5, strokes: 4 }), // clean
      ...hole({ round: "r2", hole: 2, par: 5, strokes: 5 }), // clean
      ...hole({ round: "r2", hole: 3, par: 5, strokes: 5 }), // clean
    ];
    const m = get(computeStreaks(shots, rounds), "par5Bogey");
    expect(m.opportunities).toBe(6);
    expect(m.best).toBe(3);
    expect(m.current).toBe(3);
    expect(m.isRecord).toBe(true);
  });

  it("keeps best when the current run is shorter (no live record)", () => {
    // clean, clean, clean, BOGEY, clean → best 3, current 1, not a record.
    const rounds = [{ id: "r1", date: "2026-01-01" }];
    const shots = [
      ...hole({ round: "r1", hole: 1, par: 5, strokes: 5 }),
      ...hole({ round: "r1", hole: 2, par: 5, strokes: 5 }),
      ...hole({ round: "r1", hole: 3, par: 5, strokes: 5 }),
      ...hole({ round: "r1", hole: 4, par: 5, strokes: 6 }), // bogey
      ...hole({ round: "r1", hole: 5, par: 5, strokes: 5 }),
    ];
    const m = get(computeStreaks(shots, rounds), "par5Bogey");
    expect(m.best).toBe(3);
    expect(m.current).toBe(1);
    expect(m.isRecord).toBe(false);
  });

  it("double-free allows a bogey but resets on a double", () => {
    const rounds = [{ id: "r1", date: "2026-01-01" }];
    const shots = [
      ...hole({ round: "r1", hole: 1, par: 4, strokes: 4 }), // par
      ...hole({ round: "r1", hole: 2, par: 4, strokes: 5 }), // bogey — still clean
      ...hole({ round: "r1", hole: 3, par: 4, strokes: 6 }), // double — reset
      ...hole({ round: "r1", hole: 4, par: 4, strokes: 5 }), // bogey — clean
    ];
    const m = get(computeStreaks(shots, rounds), "double");
    expect(m.opportunities).toBe(4);
    expect(m.current).toBe(1);
    expect(m.best).toBe(2);
  });

  it("3-putt-free resets on putts >= 3", () => {
    const rounds = [{ id: "r1", date: "2026-01-01" }];
    const shots = [
      ...hole({ round: "r1", hole: 1, par: 4, strokes: 4, putts: 2 }),
      ...hole({ round: "r1", hole: 2, par: 4, strokes: 5, putts: 3 }), // 3-putt
      ...hole({ round: "r1", hole: 3, par: 4, strokes: 4, putts: 1 }),
    ];
    const m = get(computeStreaks(shots, rounds), "threePutt");
    expect(m.current).toBe(1);
    expect(m.best).toBe(1);
  });

  it("approach ≤150 only counts holes with a qualifying approach", () => {
    const rounds = [{ id: "r1", date: "2026-01-01" }];
    const shots = [
      ...hole({ round: "r1", hole: 1, par: 4, strokes: 4, approachYd: 140 }), // clean approach
      ...hole({ round: "r1", hole: 2, par: 4, strokes: 4, approachYd: 200 }), // approach > 150 → not an opportunity
      ...hole({ round: "r1", hole: 3, par: 4, strokes: 5, approachYd: 120 }), // bogey from inside 150 → reset
    ];
    const m = get(computeStreaks(shots, rounds), "approach150");
    expect(m.opportunities).toBe(2); // holes 1 and 3 only
    expect(m.current).toBe(0); // last opportunity was the bogey
    expect(m.best).toBe(1);
  });

  it("up-&-down counts greenside attempts, converting on a hole-out or made putt", () => {
    const rounds = [{ id: "r1", date: "2026-01-01" }];
    // Hole 1: chip (10y) holed → convert. Hole 2: chip (10y) then made putt → convert.
    // Hole 3: chip (10y) then a MISSED putt then made putt → not up-and-down.
    const shots = [
      s({ round_id: "r1", hole: 1, par: 4, shot_no: 1, result: "Rough", yardage: 300 }),
      s({ round_id: "r1", hole: 1, par: 4, shot_no: 2, club: "SW", start_lie: "Rough", yardage: 10, result: "Make" }),
      s({ round_id: "r1", hole: 2, par: 4, shot_no: 1, result: "Rough", yardage: 300 }),
      s({ round_id: "r1", hole: 2, par: 4, shot_no: 2, club: "SW", start_lie: "Rough", yardage: 10, result: "Green" }),
      s({ round_id: "r1", hole: 2, par: 4, shot_no: 3, club: "Putter", start_lie: "Green", yardage: 5, distance_unit: "ft", result: "Make" }),
      s({ round_id: "r1", hole: 3, par: 4, shot_no: 1, result: "Rough", yardage: 300 }),
      s({ round_id: "r1", hole: 3, par: 4, shot_no: 2, club: "SW", start_lie: "Rough", yardage: 10, result: "Green" }),
      s({ round_id: "r1", hole: 3, par: 4, shot_no: 3, club: "Putter", start_lie: "Green", yardage: 8, distance_unit: "ft", result: "Fairway" }),
      s({ round_id: "r1", hole: 3, par: 4, shot_no: 4, club: "Putter", start_lie: "Green", yardage: 2, distance_unit: "ft", result: "Make" }),
    ];
    const m = get(computeStreaks(shots, rounds), "upDown");
    expect(m.opportunities).toBe(3);
    expect(m.best).toBe(2); // holes 1 & 2
    expect(m.current).toBe(0); // hole 3 blew it
  });

  it("renders a zero/em-dash state when an opportunity never arises", () => {
    // No par 5s logged at all.
    const rounds = [{ id: "r1", date: "2026-01-01" }];
    const shots = hole({ round: "r1", hole: 1, par: 4, strokes: 4 });
    const m = get(computeStreaks(shots, rounds), "par5Bogey");
    expect(m.opportunities).toBe(0);
    expect(m.current).toBe(0);
    expect(m.best).toBe(0);
    expect(m.isRecord).toBe(false);
  });

  it("orders holes chronologically across rounds regardless of input order", () => {
    // Later round listed first in input; the bogey is in the later round, so the
    // current run should be 0 once ordered correctly.
    const rounds = [
      { id: "rA", date: "2026-02-01" }, // newer — ends in bogey
      { id: "rB", date: "2026-01-01" }, // older — clean
    ];
    const shots = [
      ...hole({ round: "rA", hole: 1, par: 5, strokes: 6 }), // bogey (newer)
      ...hole({ round: "rB", hole: 1, par: 5, strokes: 5 }), // clean (older)
    ];
    const m = get(computeStreaks(shots, rounds), "par5Bogey");
    expect(m.current).toBe(0); // most recent par 5 was the bogey
    expect(m.best).toBe(1); // the older clean one
  });

  it("exposes a chase derived from the computed metrics", () => {
    const rounds = [{ id: "r1", date: "2026-01-01" }];
    const shots = [
      ...hole({ round: "r1", hole: 1, par: 5, strokes: 5 }),
      ...hole({ round: "r1", hole: 2, par: 5, strokes: 5 }),
      ...hole({ round: "r1", hole: 3, par: 5, strokes: 5 }),
      ...hole({ round: "r1", hole: 4, par: 5, strokes: 6 }), // bogey → current 0
    ];
    const { chase } = computeStreaks(shots, rounds);
    // par5Bogey: best 3, current 0 → the only record clearing the floor.
    expect(chase?.key).toBe("par5Bogey");
    expect(chase?.personalBest).toBe(3);
    expect(chase?.currentRun).toBe(0);
    expect(chase?.toGo).toBe(3);
  });
});

/** Build a bare Streak for selection tests (only the fields selectChase reads). */
function mk(
  key: Streak["key"],
  current: number,
  best: number,
  opportunities = Math.max(best, current, 1),
): Streak {
  return {
    key,
    label: key,
    unit: "",
    current,
    best,
    opportunities,
    isRecord: best > 0 && current === best,
  };
}

describe("selectChase", () => {
  it("picks the streak with the smallest positive gap to its record", () => {
    const chase = selectChase([
      mk("double", 11, 81), // gap 70
      mk("threePutt", 24, 67), // gap 43
      mk("par5Bogey", 5, 6), // gap 1 — closest
    ]);
    expect(chase?.key).toBe("par5Bogey");
    expect(chase?.toGo).toBe(1);
  });

  it("breaks ties toward the higher-stakes category", () => {
    const chase = selectChase([
      mk("upDown", 3, 4), // gap 1
      mk("double", 5, 6), // gap 1 — same, but costlier mistake
    ]);
    expect(chase?.key).toBe("double");
  });

  it("ignores live records (no gap left to chase)", () => {
    const chase = selectChase([
      mk("threePutt", 67, 67), // record, gap 0
      mk("par5Bogey", 4, 6), // gap 2 — the only candidate
    ]);
    expect(chase?.key).toBe("par5Bogey");
  });

  it("skips thin records below the floor even when their gap is smaller", () => {
    const chase = selectChase([
      mk("upDown", 1, 2), // gap 1 but best < floor
      mk("par5Bogey", 3, 6), // gap 3, best clears floor
    ]);
    expect(CHASE_MIN_BEST).toBeGreaterThan(2);
    expect(chase?.key).toBe("par5Bogey");
  });

  it("returns null when nothing clears the floor or every streak is a record", () => {
    expect(selectChase([mk("upDown", 1, 2)])).toBeNull(); // below floor
    expect(selectChase([mk("double", 6, 6)])).toBeNull(); // a live record
    expect(selectChase([mk("par5Bogey", 0, 0, 0)])).toBeNull(); // never seen
  });
});
