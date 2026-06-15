import { describe, it, expect } from "vitest";
import {
  computeRoundBreakdowns,
  ROUND_CARD_FLOOR_HOLES,
} from "@/lib/analytics/roundCard";
import type { ShotRow } from "@/lib/schemas/shot";
import type { Result, StartLie } from "@/lib/constants";

let seq = 0;
function shot(p: Partial<ShotRow>): ShotRow {
  return {
    id: `00000000-0000-0000-0000-${String(seq++).padStart(12, "0")}`,
    user_id: "1b3a0171-726e-4c64-a8e0-f97a717f2851",
    round_id: "r1",
    hole: 1,
    par: 3,
    shot_no: 1,
    club: "7i",
    yardage: null,
    distance_unit: null,
    start_lie: null,
    start_lie_manual: false,
    obstruction: "Clear",
    situation_created: null,
    short_sided: null,
    decision_quality: "Good",
    execution: 3,
    result: "Make",
    miss_direction: null,
    putt_side: null,
    putt_length: null,
    penalty: 0,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  };
}

/**
 * One par-3 hole that reaches the green off the tee, then takes `putts` putts.
 * Score = (1 + putts) − 3. Optional `teeResult` lets a par-4/5 hole drive FW%.
 */
function hole(opts: {
  roundId: string;
  hole: number;
  putts: number;
  par?: number;
  teeResult?: Result;
}): ShotRow[] {
  const par = opts.par ?? 3;
  const out: ShotRow[] = [];
  // Tee shot: reaches the green (so GIR/reach is shot 1).
  out.push(
    shot({
      round_id: opts.roundId,
      hole: opts.hole,
      par,
      shot_no: 1,
      club: par >= 4 ? "D" : "7i",
      start_lie: "Tee",
      yardage: par >= 4 ? 300 : 160,
      result: (opts.teeResult ?? "Green") as Result,
    }),
  );
  // If the tee shot didn't reach the green, add an approach that does.
  let n = 1;
  if ((opts.teeResult ?? "Green") !== "Green") {
    n++;
    out.push(
      shot({
        round_id: opts.roundId,
        hole: opts.hole,
        par,
        shot_no: n,
        club: "9i",
        start_lie: (opts.teeResult ?? "Fairway") as StartLie,
        yardage: 140,
        result: "Green",
      }),
    );
  }
  // Putts on the green; last one holes out.
  for (let i = 0; i < opts.putts; i++) {
    n++;
    const last = i === opts.putts - 1;
    out.push(
      shot({
        round_id: opts.roundId,
        hole: opts.hole,
        par,
        shot_no: n,
        club: "Putter",
        start_lie: "Green",
        yardage: 2,
        distance_unit: "ft",
        result: (last ? "Make" : null) as Result,
      }),
    );
  }
  return out;
}

/** A round of `holes` identical par-3 holes, each with `putts` putts. */
function roundOf(roundId: string, holes: number, putts: number): ShotRow[] {
  const out: ShotRow[] = [];
  for (let h = 1; h <= holes; h++) out.push(...hole({ roundId, hole: h, putts }));
  return out;
}

describe("computeRoundBreakdowns", () => {
  it("frames putts as a leave-one-out, hole-count-fair delta", () => {
    // A,B: 9 holes × 2 putts = 18 each. C: 9 holes × 1 putt = 9.
    const shots = [
      ...roundOf("A", 9, 2),
      ...roundOf("B", 9, 2),
      ...roundOf("C", 9, 1),
    ];
    const bd = computeRoundBreakdowns(shots);

    const cPutts = bd.get("C")!.metrics.find((m) => m.key === "putts")!;
    // Others (A+B) = 36 putts / 18 holes = 2/hole → expect 18 for C's 9 holes.
    expect(cPutts.value).toBe(9);
    expect(cPutts.delta).toBeCloseTo(-9, 6); // 9 − 18
    expect(cPutts.lowerIsBetter).toBe(true);
    expect(bd.get("C")!.eligible).toBe(true);

    // A's baseline excludes itself: others (B+C) = 27/18 = 1.5/hole → expect 13.5.
    const aPutts = bd.get("A")!.metrics.find((m) => m.key === "putts")!;
    expect(aPutts.delta).toBeCloseTo(4.5, 6); // 18 − 13.5
  });

  it("scales the expectation to the round's hole count (9 vs 18 holes)", () => {
    // Baseline rounds at 2 putts/hole; target plays only 4 holes at 1 putt each.
    const shots = [
      ...roundOf("A", 18, 2),
      ...hole({ roundId: "C", hole: 1, putts: 1 }),
      ...hole({ roundId: "C", hole: 2, putts: 1 }),
      ...hole({ roundId: "C", hole: 3, putts: 1 }),
      ...hole({ roundId: "C", hole: 4, putts: 1 }),
    ];
    const cPutts = computeRoundBreakdowns(shots).get("C")!.metrics.find(
      (m) => m.key === "putts",
    )!;
    // Expectation = 2/hole × 4 holes = 8; round had 4 → −4 (not −32).
    expect(cPutts.value).toBe(4);
    expect(cPutts.delta).toBeCloseTo(-4, 6);
  });

  it("withholds deltas below the sample floor (raw values only)", () => {
    // Two single-hole rounds → each sees only 1 other hole, under the floor.
    expect(ROUND_CARD_FLOOR_HOLES).toBeGreaterThan(1);
    const shots = [
      ...hole({ roundId: "A", hole: 1, putts: 2 }),
      ...hole({ roundId: "B", hole: 1, putts: 3 }),
    ];
    const a = computeRoundBreakdowns(shots).get("A")!;
    expect(a.eligible).toBe(false);
    expect(a.metrics.every((m) => m.delta === null)).toBe(true);
    // Raw values still populated.
    expect(a.metrics.find((m) => m.key === "putts")!.value).toBe(2);
  });

  it("emits every metric group, and omits FW when there are no par-4/5 holes", () => {
    const shots = [...roundOf("A", 9, 2), ...roundOf("B", 9, 2)];
    const a = computeRoundBreakdowns(shots).get("A")!;
    const keys = a.metrics.map((m) => m.key);
    // 4 SG categories + GIR + Putts + 3-putt + Score; no FW (all par 3).
    expect(keys).toContain("sg:Putting");
    expect(keys).toContain("sg:Off the tee");
    expect(keys).toContain("gir");
    expect(keys).toContain("3putt");
    expect(keys).toContain("score");
    expect(keys).not.toContain("fw");
  });

  it("includes FW% (par-4/5 only) and marks its direction", () => {
    // 9 par-4 holes each (clears the floor): A hits every fairway, B hits none.
    const par4 = (roundId: string, fairway: boolean) =>
      Array.from({ length: 9 }, (_, i) =>
        hole({
          roundId,
          hole: i + 1,
          putts: 2,
          par: 4,
          teeResult: fairway ? "Fairway" : "Rough",
        }),
      ).flat();
    const aFw = computeRoundBreakdowns([
      ...par4("A", true),
      ...par4("B", false),
    ])
      .get("A")!
      .metrics.find((m) => m.key === "fw")!;
    expect(aFw.value).toBeCloseTo(1, 6); // 9/9
    // Baseline = B only = 0/9 = 0 → delta +1, higher is better.
    expect(aFw.delta).toBeCloseTo(1, 6);
    expect(aFw.lowerIsBetter).toBe(false);
  });

  it("skips in-progress rounds (no complete holes)", () => {
    const shots = [
      ...roundOf("A", 9, 2),
      // An unfinished hole: tee shot only, never holed.
      shot({ round_id: "Z", hole: 1, par: 4, shot_no: 1, start_lie: "Tee", result: "Fairway" }),
    ];
    const bd = computeRoundBreakdowns(shots);
    expect(bd.has("A")).toBe(true);
    expect(bd.has("Z")).toBe(false);
  });
});
