import { describe, it, expect } from "vitest";
import {
  computeFirstDominoes,
  firstDominoForHole,
  ROOT_CAUSE_SG_THRESHOLD,
} from "@/lib/analytics/firstDomino";
import { perShotSG } from "@/lib/analytics/sg";
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

/** Putts are stored in yards (×3 = feet); helper for readable putt distances. */
const ft = (feet: number) => feet / 3;

/** Run a single hole's shots through the real SG engine, then firstDomino. */
function readHole(shots: ShotRow[]) {
  const { entries } = perShotSG(shots);
  return firstDominoForHole(shots, entries);
}

/**
 * Par 4, double bogey 6. One real mistake — an OB tee shot (~-2.0 SG) — then a
 * clean re-tee, approach, and routine two-putt. The textbook single domino.
 */
function obDoubleBogey(round: string, hole: number): ShotRow[] {
  return [
    shot({ round_id: round, hole, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "OB", penalty: 1 }),
    shot({ round_id: round, hole, shot_no: 2, club: "D", start_lie: "Tee", yardage: 400, result: "Fairway" }),
    shot({ round_id: round, hole, shot_no: 3, club: "8i", start_lie: "Fairway", yardage: 150, result: "Green" }),
    shot({ round_id: round, hole, shot_no: 4, club: "Putter", start_lie: "Green", yardage: ft(20), result: null }),
    shot({ round_id: round, hole, shot_no: 5, club: "Putter", start_lie: "Green", yardage: ft(3), result: "Make" }),
  ];
}

/**
 * Par 4, double bogey 6, where the FIRST negative shot is only a small leak (a
 * drive into the rough, ~-0.3) and the real error comes later (an approach into
 * a hazard, ~-1.6). Naively blaming the first negative shot would finger the
 * tee shot; the threshold must skip it and land on shot 2.
 */
function lateRealMistake(round: string, hole: number): ShotRow[] {
  return [
    shot({ round_id: round, hole, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "Rough" }),
    shot({ round_id: round, hole, shot_no: 2, club: "7i", start_lie: "Rough", yardage: 190, result: "Hazard", penalty: 1 }),
    shot({ round_id: round, hole, shot_no: 3, club: "9i", start_lie: "Rough", yardage: 100, result: "Green" }),
    shot({ round_id: round, hole, shot_no: 4, club: "Putter", start_lie: "Green", yardage: ft(15), result: null }),
    shot({ round_id: round, hole, shot_no: 5, club: "Putter", start_lie: "Green", yardage: ft(3), result: "Make" }),
  ];
}

/**
 * Par 4, double bogey 6, but shot 2 has no recorded distance. That gap kills the
 * SG for shot 2 AND shot 1's leave — the chain can't be trusted, so the read
 * must refuse to name a domino.
 */
function coverageGap(round: string, hole: number): ShotRow[] {
  return [
    shot({ round_id: round, hole, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "Rough" }),
    shot({ round_id: round, hole, shot_no: 2, club: "7i", start_lie: "Rough", yardage: null, result: "Rough" }),
    shot({ round_id: round, hole, shot_no: 3, club: "9i", start_lie: "Rough", yardage: 150, result: "Green" }),
    shot({ round_id: round, hole, shot_no: 4, club: "Putter", start_lie: "Green", yardage: ft(20), result: null }),
    shot({ round_id: round, hole, shot_no: 5, club: "Putter", start_lie: "Green", yardage: ft(6), result: null }),
    shot({ round_id: round, hole, shot_no: 6, club: "Putter", start_lie: "Green", yardage: ft(2), result: "Make" }),
  ];
}

/** Par 4, routine par: drive, approach, two clean putts. Nothing to surface. */
function routinePar(round: string, hole: number): ShotRow[] {
  return [
    shot({ round_id: round, hole, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "Fairway" }),
    shot({ round_id: round, hole, shot_no: 2, club: "8i", start_lie: "Fairway", yardage: 150, result: "Green" }),
    shot({ round_id: round, hole, shot_no: 3, club: "Putter", start_lie: "Green", yardage: ft(18), result: null }),
    shot({ round_id: round, hole, shot_no: 4, club: "Putter", start_lie: "Green", yardage: ft(2), result: "Make" }),
  ];
}

/**
 * Par 4 scrambled to a bogey 5: an OB tee shot (gross −2.0) plus a leaky
 * re-tee, rescued by a tidy approach and a made putt. The score line (bogey)
 * doesn't trip the +2 gate, and the NET SG recovers to ~−0.8 — but the GROSS
 * loss is past −2, so the read still surfaces it. This is the distinct path.
 */
function sgGateBogey(round: string, hole: number): ShotRow[] {
  return [
    shot({ round_id: round, hole, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "OB", penalty: 1 }),
    shot({ round_id: round, hole, shot_no: 2, club: "D", start_lie: "Tee", yardage: 400, result: "Rough" }),
    shot({ round_id: round, hole, shot_no: 3, club: "7i", start_lie: "Rough", yardage: 180, result: "Green" }),
    shot({ round_id: round, hole, shot_no: 4, club: "Putter", start_lie: "Green", yardage: ft(10), result: "Make" }),
  ];
}

/**
 * Par 4, double bogey 6. A good-looking drive into the rough (~neutral SG) that
 * actually left Matt blocked — the next shot is a forced punch-out that creeps
 * 115→112 (a 6i that went 3 yards). SG blames the punch-out; the read must walk
 * blame back to the drive (shot 1). Mirrors 2026-06-06 H3.
 */
function droveBehindTree(round: string, hole: number): ShotRow[] {
  return [
    shot({ round_id: round, hole, shot_no: 1, club: "5W", start_lie: "Tee", yardage: 400, result: "Rough" }),
    shot({ round_id: round, hole, shot_no: 2, club: "6i", start_lie: "Rough", yardage: 115, result: "Rough" }),
    shot({ round_id: round, hole, shot_no: 3, club: "4i", start_lie: "Rough", yardage: 112, result: "Rough" }),
    shot({ round_id: round, hole, shot_no: 4, club: "LW", start_lie: "Rough", yardage: 28, result: "Green" }),
    shot({ round_id: round, hole, shot_no: 5, club: "Putter", start_lie: "Green", yardage: ft(25), result: null }),
    shot({ round_id: round, hole, shot_no: 6, club: "Putter", start_lie: "Green", yardage: ft(3), result: "Make" }),
  ];
}

/**
 * Par 5, bogey: drive in play, then a *deliberate layup* from 248→142 (advances
 * 43% — not a punch-out) that leaks into the rough. The leaky layup is the real
 * mistake and must NOT be walked back to the (fine) drive. Mirrors 2026-06-07 H6.
 */
function par5Layup(round: string, hole: number): ShotRow[] {
  return [
    shot({ round_id: round, hole, par: 5, shot_no: 1, club: "3W", start_lie: "Tee", yardage: 456, result: "Fairway" }),
    shot({ round_id: round, hole, par: 5, shot_no: 2, club: "5W", start_lie: "Fairway", yardage: 248, result: "Rough" }),
    shot({ round_id: round, hole, par: 5, shot_no: 3, club: "6i", start_lie: "Rough", yardage: 142, result: "Bunker" }),
    shot({ round_id: round, hole, par: 5, shot_no: 4, club: "LW", start_lie: "Bunker", yardage: 25, result: "Green" }),
    shot({ round_id: round, hole, par: 5, shot_no: 5, club: "Putter", start_lie: "Green", yardage: ft(25), result: null }),
    shot({ round_id: round, hole, par: 5, shot_no: 6, club: "Putter", start_lie: "Green", yardage: ft(8), result: "Make" }),
  ];
}

/**
 * Par 4, double bogey 6: the drive is *tagged* Blocked at its finish (carried to
 * shot 2's start) — the explicit obstruction signal, independent of advance. The
 * forced wedge out is shot 2; blame must walk back to the drive.
 */
function taggedBlocked(round: string, hole: number): ShotRow[] {
  return [
    shot({ round_id: round, hole, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "Rough" }),
    shot({ round_id: round, hole, shot_no: 2, club: "SW", start_lie: "Rough", obstruction: "Blocked", yardage: 150, result: "Fairway" }),
    shot({ round_id: round, hole, shot_no: 3, club: "9i", start_lie: "Fairway", yardage: 110, result: "Green" }),
    shot({ round_id: round, hole, shot_no: 4, club: "Putter", start_lie: "Green", yardage: ft(20), result: null }),
    shot({ round_id: round, hole, shot_no: 5, club: "Putter", start_lie: "Green", yardage: ft(6), result: null }),
    shot({ round_id: round, hole, shot_no: 6, club: "Putter", start_lie: "Green", yardage: ft(2), result: "Make" }),
  ];
}

/**
 * Par 4, double bogey 6. The bunker shot (2) is a bad swing — Matt rates it
 * execution 1 — but it scuttles back into the fairway, so SG forgives it (~−0.2).
 * A later wedge (3) is the SG-material shot. The blend must name the bad swing
 * (2), not the costlier-by-outcome wedge. Mirrors 2026-06-07 H18.
 */
function badSwingLuckyResult(round: string, hole: number): ShotRow[] {
  return [
    shot({ round_id: round, hole, shot_no: 1, club: "D", start_lie: "Tee", yardage: 400, result: "Bunker", execution: 2 }),
    shot({ round_id: round, hole, shot_no: 2, club: "SW", start_lie: "Bunker", yardage: 94, result: "Fairway", execution: 1 }),
    shot({ round_id: round, hole, shot_no: 3, club: "LW", start_lie: "Fairway", yardage: 25, result: "Fringe", execution: 2 }),
    shot({ round_id: round, hole, shot_no: 4, club: "LW", start_lie: "Fringe", yardage: 12, result: "Green", execution: 2 }),
    shot({ round_id: round, hole, shot_no: 5, club: "Putter", start_lie: "Green", yardage: ft(18), result: null }),
    shot({ round_id: round, hole, shot_no: 6, club: "Putter", start_lie: "Green", yardage: ft(2), result: "Make" }),
  ];
}

/**
 * Par 4, double bogey 6 via a four-putt. The approach (2) is an ugly swing
 * (execution 1) but it REACHES THE GREEN — on in 2, no recovery needed. The hole
 * turns on the missed short putt (4), not the successful-but-ugly approach. The
 * swing signal must not hijack the domino. Mirrors 2026-06-06 H15.
 */
function badSwingReachedGreen(round: string, hole: number): ShotRow[] {
  return [
    shot({ round_id: round, hole, shot_no: 1, club: "3W", start_lie: "Tee", yardage: 400, result: "Rough", execution: 2 }),
    shot({ round_id: round, hole, shot_no: 2, club: "LW", start_lie: "Rough", yardage: 40, result: "Green", execution: 1 }),
    shot({ round_id: round, hole, shot_no: 3, club: "Putter", start_lie: "Green", yardage: ft(60), result: null }),
    shot({ round_id: round, hole, shot_no: 4, club: "Putter", start_lie: "Green", yardage: ft(5), result: null }),
    shot({ round_id: round, hole, shot_no: 5, club: "Putter", start_lie: "Green", yardage: ft(4), result: null }),
    shot({ round_id: round, hole, shot_no: 6, club: "Putter", start_lie: "Green", yardage: ft(1), result: "Make" }),
  ];
}

describe("firstDominoForHole", () => {
  it("names the single mistake on a clean blow-up hole", () => {
    const d = readHole(obDoubleBogey("r1", 1));
    expect(d).not.toBeNull();
    expect(d!.rootCauseShotNo).toBe(1);
    expect(d!.rootCauseCategory).toBe("Off the tee");
    expect(d!.rootCauseSg).toBeLessThanOrEqual(ROOT_CAUSE_SG_THRESHOLD);
    expect(d!.recoveryShotNos).toEqual([2, 3, 4, 5]);
    expect(d!.sgCovered).toBe(true);
  });

  it("skips an early small leak and blames the later real error", () => {
    const shots = lateRealMistake("r1", 2);
    const d = readHole(shots);
    expect(d).not.toBeNull();
    // Shot 1 is genuinely negative, but only a small leak — it must NOT be picked.
    const { entries } = perShotSG(shots);
    const s1 = entries.find((e) => e.shot.shot_no === 1)!;
    expect(s1.sg).toBeLessThan(0);
    expect(s1.sg).toBeGreaterThan(ROOT_CAUSE_SG_THRESHOLD);
    expect(d!.rootCauseShotNo).toBe(2);
    expect(d!.recoveryShotNos).toEqual([3, 4, 5]);
    expect(d!.sgCovered).toBe(true);
  });

  it("refuses to name a domino when SG coverage is incomplete", () => {
    const d = readHole(coverageGap("r1", 3));
    expect(d).not.toBeNull(); // still a blow-up, so it surfaces…
    expect(d!.sgCovered).toBe(false); // …but honestly flags the gap
    expect(d!.rootCauseShotNo).toBeNull();
    expect(d!.rootCauseCategory).toBeNull();
    expect(d!.recoveryShotNos).toEqual([]);
  });

  it("surfaces nothing on a routine hole", () => {
    expect(readHole(routinePar("r1", 4))).toBeNull();
  });

  it("walks blame from a forced punch-out back to the drive that caused it", () => {
    const shots = droveBehindTree("r1", 6);
    const d = readHole(shots);
    expect(d).not.toBeNull();
    // SG's materially-negative shot is the punch-out (2), not the drive…
    const { entries } = perShotSG(shots);
    const s2 = entries.find((e) => e.shot.shot_no === 2)!;
    expect(s2.sg).toBeLessThanOrEqual(ROOT_CAUSE_SG_THRESHOLD);
    // …but the read names the drive, the shot that created the trouble.
    expect(d!.rootCauseShotNo).toBe(1);
    expect(d!.rootCauseCategory).toBe("Off the tee");
    expect(d!.recoveryShotNos).toEqual([2, 3, 4, 5, 6]);
  });

  it("does NOT walk a deliberate layup back to a fine drive", () => {
    const d = readHole(par5Layup("r1", 6));
    expect(d).not.toBeNull();
    // The leaky layup (shot 2) advanced too far to be a forced escape — it stays
    // the named mistake rather than blaming the drive.
    expect(d!.rootCauseShotNo).toBe(2);
  });

  it("names a bad swing (execution 1) even when SG forgave its lucky result", () => {
    const shots = badSwingLuckyResult("r1", 18);
    const d = readHole(shots);
    expect(d).not.toBeNull();
    // SG forgives the bunker blade (it scuttled into the fairway)…
    const { entries } = perShotSG(shots);
    const s2 = entries.find((e) => e.shot.shot_no === 2)!;
    expect(s2.sg).toBeGreaterThan(ROOT_CAUSE_SG_THRESHOLD);
    // …and a later wedge is the SG-material shot, but the bad swing is the domino.
    const s3 = entries.find((e) => e.shot.shot_no === 3)!;
    expect(s3.sg).toBeLessThanOrEqual(ROOT_CAUSE_SG_THRESHOLD);
    expect(d!.rootCauseShotNo).toBe(2);
  });

  it("does NOT let a bad swing that reached the green hijack a later disaster", () => {
    const shots = badSwingReachedGreen("r1", 15);
    const d = readHole(shots);
    expect(d).not.toBeNull();
    // Shot 2 is a bad swing (exec 1) but reached the green — not the domino.
    expect(d!.rootCauseShotNo).toBe(4);
    expect(d!.rootCauseCategory).toBe("Putting");
  });

  it("walks back on an explicit Blocked tag regardless of advance", () => {
    const d = readHole(taggedBlocked("r1", 8));
    expect(d).not.toBeNull();
    expect(d!.rootCauseShotNo).toBe(1);
    expect(d!.rootCauseCategory).toBe("Off the tee");
  });

  it("flags a bogey on gross loss even though net SG recovered above the gate", () => {
    const d = readHole(sgGateBogey("r1", 5));
    expect(d).not.toBeNull();
    // Net SG is rescued back above −2 — so it's the GROSS-loss gate that fired.
    expect(d!.holeSgTotal).toBeGreaterThan(-2.0);
    expect(d!.rootCauseShotNo).toBe(1);
  });
});

describe("computeFirstDominoes", () => {
  it("returns one entry per blow-up hole, worst SG first, and omits routine holes", () => {
    const rows = computeFirstDominoes([
      ...routinePar("r1", 1),
      ...lateRealMistake("r1", 2),
      ...obDoubleBogey("r1", 3),
    ]);
    // Routine hole 1 is omitted; both blow-ups are present.
    expect(rows.map((r) => r.hole).sort()).toEqual([2, 3]);
    // Worst (most-negative SG total) first.
    expect(rows[0].holeSgTotal).toBeLessThanOrEqual(rows[1].holeSgTotal);
    expect(rows.every((r) => r.roundId === "r1")).toBe(true);
  });
});
