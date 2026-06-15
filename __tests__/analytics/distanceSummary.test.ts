import { describe, it, expect } from "vitest";
import { computeDistanceSummary } from "@/lib/analytics/distanceSummary";
import type { ShotRow } from "@/lib/schemas/shot";

/**
 * Expected values derived by tracing rebuildDistanceSummary in golf_stats.gs
 * over a single-round, four-hole fixture. Putt yardages are in YARDS
 * (×3 → feet): 1 yd = 3 ft, 2 yd = 6 ft, 3 yd = 9 ft, 4 yd = 12 ft.
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

function fixture(): ShotRow[] {
  return [
    // H1 par4: drive, approach (150), 9-ft putt (miss), 3-ft putt (make).
    shot({ hole: 1, par: 4, shot_no: 1, club: "D", result: "Fairway", execution: 3 }),
    shot({ hole: 1, par: 4, shot_no: 2, club: "8i", result: "Green", execution: 4, yardage: 150 }),
    shot({ hole: 1, par: 4, shot_no: 3, club: "Putter", result: null, yardage: 3 }),
    shot({ hole: 1, par: 4, shot_no: 4, club: "Putter", result: "Make", yardage: 1 }),

    // H2 par3: tee onto green (140), 12-ft putt (miss, High+Short tags), make.
    shot({ hole: 2, par: 3, shot_no: 1, club: "7i", result: "Green", execution: 3, yardage: 140 }),
    shot({ hole: 2, par: 3, shot_no: 2, club: "Putter", result: null, yardage: 4, putt_side: "High", putt_length: "Short" }),
    shot({ hole: 2, par: 3, shot_no: 3, club: "Putter", result: "Make", yardage: 1 }),

    // H3 par4: drive, 40-yd approach (short miss), 20-yd pitch to green, make putt.
    shot({ hole: 3, par: 4, shot_no: 1, club: "D", result: "Rough", execution: 2 }),
    shot({ hole: 3, par: 4, shot_no: 2, club: "9i", result: "Rough", execution: 2, yardage: 40, miss_direction: "Short" }),
    shot({ hole: 3, par: 4, shot_no: 3, club: "SW", result: "Green", execution: 3, yardage: 20 }),
    shot({ hole: 3, par: 4, shot_no: 4, club: "Putter", result: "Make", yardage: 2 }),

    // H4 par4: drive, 50-yd approach, 8-yd chip-in (Make).
    shot({ hole: 4, par: 4, shot_no: 1, club: "D", result: "Fairway", execution: 3 }),
    shot({ hole: 4, par: 4, shot_no: 2, club: "8i", result: "Rough", execution: 2, yardage: 50 }),
    shot({ hole: 4, par: 4, shot_no: 3, club: "LW", result: "Make", execution: 4, yardage: 8 }),
  ];
}

const summary = computeDistanceSummary(fixture());
const row = <T extends { label: string }>(rows: T[], label: string) =>
  rows.find((r) => r.label === label)!;

describe("distanceSummary — make rate by distance", () => {
  it("buckets every putter shot by feet (yards ×3)", () => {
    expect(row(summary.makeRate, "0–3 ft")).toMatchObject({ putts: 2, makes: 2, makePct: 1 });
    expect(row(summary.makeRate, "3–6 ft")).toMatchObject({ putts: 1, makes: 1, makePct: 1 });
    expect(row(summary.makeRate, "6–10 ft")).toMatchObject({ putts: 1, makes: 0, makePct: 0 });
    expect(row(summary.makeRate, "10–20 ft")).toMatchObject({ putts: 1, makes: 0, makePct: 0 });
    expect(row(summary.makeRate, "20+ ft")).toMatchObject({ putts: 0, makePct: null });
  });
});

describe("distanceSummary — first-putt performance", () => {
  it("uses the first real putt's distance and total putts to finish", () => {
    // H3's lone make-from-6ft is a real putt (Putter, result Make != Green).
    expect(row(summary.firstPutt, "3–6 ft")).toMatchObject({ faced: 1, avgPutts: 1, onePuttPct: 1, threePuttPct: 0 });
    // H1 first putt at 9 ft, two putts to finish.
    expect(row(summary.firstPutt, "6–10 ft")).toMatchObject({ faced: 1, avgPutts: 2, onePuttPct: 0 });
    // H2 first putt at 12 ft, two putts to finish.
    expect(row(summary.firstPutt, "10–20 ft")).toMatchObject({ faced: 1, avgPutts: 2 });
    expect(row(summary.firstPutt, "20+ ft")).toMatchObject({ faced: 0, avgPutts: null });
  });
});

describe("distanceSummary — putt miss patterns", () => {
  it("counts only missed putts and tags High/Short", () => {
    // 9-ft miss (no tags): one miss, all pct 0 (not null, since misses > 0).
    expect(row(summary.missPatterns, "6–10 ft")).toMatchObject({ misses: 1, highPct: 0, shortPct: 0 });
    // 12-ft miss tagged High + Short.
    expect(row(summary.missPatterns, "10–20 ft")).toMatchObject({ misses: 1, highPct: 1, lowPct: 0, shortPct: 1, longPct: 0 });
    // makes are excluded → 0–3 ft has no misses.
    expect(row(summary.missPatterns, "0–3 ft")).toMatchObject({ misses: 0, highPct: null });
  });
});

describe("distanceSummary — around the green", () => {
  it("20-yd pitch: on green, up-and-down via next made putt (D-06)", () => {
    expect(row(summary.aroundGreen, "10–30 yds")).toMatchObject({
      shots: 1,
      avgQuality: 3,
      onGreenPct: 1,
      upDownPct: 1,
    });
  });
  it("8-yd chip-in: up-and-down via own Make, not counted as on-green", () => {
    expect(row(summary.aroundGreen, "0–10 yds")).toMatchObject({
      shots: 1,
      avgQuality: 4,
      onGreenPct: 0, // result was Make, not Green
      upDownPct: 1,
    });
  });
});

describe("distanceSummary — approaches", () => {
  it("30–75 yd bucket: two shots, short miss, no greens", () => {
    expect(row(summary.approaches, "30–75 yds")).toMatchObject({
      shots: 2, // 40-yd 9i + 50-yd 8i
      avgQuality: 2,
      greenHitPct: 0,
      missShortPct: 0.5,
    });
  });
  it("125–175 yd bucket: par-3 tee counts; both greens hit", () => {
    expect(row(summary.approaches, "125–175 yds")).toMatchObject({
      shots: 2, // 150-yd 8i + 140-yd par-3 tee
      avgQuality: 3.5,
      greenHitPct: 1,
    });
  });
  it("empty bucket → null rates", () => {
    expect(row(summary.approaches, "75–125 yds")).toMatchObject({ shots: 0, greenHitPct: null });
  });
});

describe("distanceSummary — PGA Tour benchmarks (D-11)", () => {
  it("attaches tour make% to each make-rate bucket by label", () => {
    expect(row(summary.makeRate, "0–3 ft").tourMakePct).toBe(0.98);
    expect(row(summary.makeRate, "6–10 ft").tourMakePct).toBe(0.5);
    expect(row(summary.makeRate, "20+ ft").tourMakePct).toBe(0.08);
  });
  it("attaches tour 1-putt% (= make%) and 3-putt% to first-putt buckets", () => {
    expect(row(summary.firstPutt, "3–6 ft").tourOnePuttPct).toBe(0.77);
    expect(row(summary.firstPutt, "3–6 ft").tourThreePuttPct).toBe(0.01);
    expect(row(summary.firstPutt, "20+ ft").tourThreePuttPct).toBe(0.09);
  });
  it("attaches tour up-and-down% to around-the-green buckets", () => {
    expect(row(summary.aroundGreen, "0–10 yds").tourUpDownPct).toBe(0.8);
    expect(row(summary.aroundGreen, "10–30 yds").tourUpDownPct).toBe(0.5);
  });
  it("attaches tour GIR% to approach buckets", () => {
    expect(row(summary.approaches, "30–75 yds").tourGreenHitPct).toBe(0.85);
    expect(row(summary.approaches, "125–175 yds").tourGreenHitPct).toBe(0.66);
    expect(row(summary.approaches, "175+ yds").tourGreenHitPct).toBe(0.5);
  });
  it("benchmarks are present even on empty/zeroed buckets", () => {
    expect(row(summary.makeRate, "20+ ft")).toMatchObject({ putts: 0, tourMakePct: 0.08 });
  });
});

describe("distanceSummary — empty input", () => {
  it("returns all five sub-tables with zeroed buckets", () => {
    const empty = computeDistanceSummary([]);
    expect(empty.makeRate.every((b) => b.putts === 0 && b.makePct === null)).toBe(true);
    expect(empty.firstPutt).toHaveLength(5);
    expect(empty.aroundGreen).toHaveLength(2);
    expect(empty.approaches).toHaveLength(4);
    expect(empty.missPatterns).toHaveLength(5);
    expect(empty.hero).toHaveLength(0);
  });
});

// ─── Gap-to-Tour redesign ─────────────────────────────────────────────────────
//
// The single-round `fixture` keeps every bucket below the n≥10 floor, so it is
// the gate test. This four-round window clears the floor for two buckets with
// known rates, so it exercises the gap math, severity, and hero ranking.
function multiRound(): ShotRow[] {
  const out: ShotRow[] = [];
  for (let rd = 0; rd < 4; rd++) {
    const round_id = `R${rd}`;
    // 3 putts from 9 ft (6–10 ft): 1 make → 33% make vs Tour 50%.
    out.push(shot({ round_id, hole: 1, shot_no: 3, club: "Putter", result: "Make", yardage: 3 }));
    out.push(shot({ round_id, hole: 2, shot_no: 3, club: "Putter", result: null, yardage: 3 }));
    out.push(shot({ round_id, hole: 3, shot_no: 3, club: "Putter", result: null, yardage: 3 }));
    // 3 approaches from 100 yd (75–125 yds): 1 green → 33% GIR vs Tour 78%.
    out.push(shot({ round_id, hole: 1, shot_no: 2, club: "9i", result: "Green", yardage: 100 }));
    out.push(shot({ round_id, hole: 2, shot_no: 2, club: "9i", result: "Rough", yardage: 100 }));
    out.push(shot({ round_id, hole: 3, shot_no: 2, club: "9i", result: "Rough", yardage: 100 }));
  }
  return out;
}

describe("distanceSummary — gap to Tour", () => {
  const thinGap = row(summary.makeRate, "6–10 ft").gap!; // single-round, n=1

  it("thin buckets carry the gap but never a severity colour", () => {
    expect(thinGap.thin).toBe(true);
    expect(thinGap.sev).toBeNull();
  });

  it("thin buckets never drive the headline", () => {
    expect(summary.hero).toHaveLength(0);
  });

  const m = computeDistanceSummary(multiRound());

  it("computes signed points gap and strokes/round vs Tour past the floor", () => {
    const g = row(m.makeRate, "6–10 ft").gap!;
    expect(g.thin).toBe(false);
    expect(g.n).toBe(12);
    expect(g.you).toBeCloseTo(1 / 3, 5);
    expect(g.tour).toBe(0.5);
    expect(g.gap).toBeCloseTo(1 / 3 - 0.5, 5);
    // gap × (12 putts / 4 rounds) × 1.0 stroke/make.
    expect(g.sgRd).toBeCloseTo((1 / 3 - 0.5) * 3, 5);
    expect(g.sev).toBe(3);
  });

  it("ranks the hero by strokes/round (opportunity), not raw points", () => {
    // Approach trails by more points AND costs more strokes → it ranks first,
    // even though both are screaming.
    expect(m.hero).toHaveLength(2);
    expect(m.hero[0].label).toBe("Approach 75–125 yds");
    expect(m.hero[1].label).toBe("Putts 6–10 ft");
    expect(m.hero[0].sgRd).toBeLessThan(m.hero[1].sgRd);
    expect(m.hero[0].perRound).toBeCloseTo(3, 5);
  });

  it("treats 3-putt% as lower-is-better: fewer than Tour reads as ahead", () => {
    // Fixture has no 3-putts; Tour 3-putts 3% from 10–20 ft, so you are ahead.
    const g = row(summary.firstPutt, "10–20 ft").threePuttGap!;
    expect(g.lowerIsBetter).toBe(true);
    expect(g.you).toBe(0);
    expect(g.tour).toBe(0.03);
    // Ahead → strokes gained is non-negative (no penalty), severity benign.
    expect(g.sgRd).toBeGreaterThanOrEqual(0);
  });

  it("gives around-the-green an up-and-down gap (higher-is-better)", () => {
    const g = row(summary.aroundGreen, "10–30 yds").gap!;
    expect(g.lowerIsBetter).toBe(false);
    expect(g.tour).toBe(0.5);
  });
});
