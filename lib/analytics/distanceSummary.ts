/**
 * Distance Summary (P2-T4).
 *
 * Pure port of `rebuildDistanceSummary` from `docs/golf_stats.gs`
 * (lines ~398–644), minus the spreadsheet I/O. Produces five sub-tables as
 * plain data.
 *
 * Iteration scope matters and mirrors the `.gs` exactly:
 *   - Make Rate and Approaches iterate EVERY shot row.
 *   - First-Putt and Around-the-Green iterate COMPLETE round-holes (the latter
 *     needs each shot's successor for the up-and-down test, D-06).
 *
 * Miss Patterns: the `.gs` only renders this table when the sheet has the
 * PuttSide/PuttLength columns. In our schema those columns always exist (often
 * null), so it is always computed here; the display layer can hide it when the
 * player never tags putt misses. (Misses = Putter shots whose result != 'Make'.)
 *
 * Layer rules: zero Supabase imports; pure over `ShotRow[]`; bucket bounds and
 * the yd→ft factor come from constants. `.gs` '' sentinels become `null`.
 */

import {
  PUTT_BUCKETS,
  ATG_BUCKETS,
  APPROACH_BUCKETS,
} from "@/lib/constants";
import {
  TOUR_MAKE_PCT,
  TOUR_THREE_PUTT_PCT,
  TOUR_UP_DOWN_PCT,
  TOUR_GREEN_PCT,
} from "@/lib/benchmarks";
import {
  aggregateByRoundHole,
  isRealPutt,
  puttBucketOf,
  bucketOf,
  puttYardsToFeet,
  r2,
} from "@/lib/analytics/core";
import { SAMPLE_THRESHOLDS } from "@/lib/analytics/gates";
import type { ShotRow } from "@/lib/schemas/shot";

// ─── Gap to Tour: the redesign's point of view ────────────────────────────────
//
// The page used to state the Tour gap as two bare percentages and leave the
// subtraction — and the prioritisation — to the reader. The redesign answers
// "where am I furthest from elite, and does it matter?" by ranking each
// benchmarked bucket by OPPORTUNITY (strokes/round lost), not by raw points.
//
// Strokes-vs-Tour is not directly available: `activeBaseline` is a *scratch*
// strokes table and the Tour benchmarks are percentages only (`lib/benchmarks`).
// So we convert each percentage gap into strokes with a transparent, per-shot
// stroke value — the same shape the brief's fallback prescribes, but expressed
// in the SG currency the rest of the app speaks. Both constants are documented
// approximations; the bucket *ranking* is robust to their exact magnitude.

/** Value of converting one missed putt into a make ≈ one stroke (1-putt vs 2). */
const MAKE_STROKE_VALUE = 1.0;
/** Value of hitting a green vs missing it ≈ half a stroke (still get up-and-down some). */
const GREEN_STROKE_VALUE = 0.55;
/** A 3-putt costs ~1 stroke over a 2-putt (here lower is better). */
const THREE_PUTT_STROKE_VALUE = 1.0;
/** Getting up-and-down vs not ≈ saving ~1 stroke. */
const UPDOWN_STROKE_VALUE = 1.0;
/** Distance/lie buckets need n≥10 before a gap can rank or earn a severity colour. */
const BUCKET_GATE = SAMPLE_THRESHOLDS.bucket;

/** Severity 0..3 from strokes/round lost — the magnitude that earns the red. */
function severityOf(sgRd: number): 0 | 1 | 2 | 3 {
  if (sgRd >= -0.04) return 0; // even or ahead of Tour
  if (sgRd > -0.2) return 1; // real but small
  if (sgRd > -0.45) return 2; // worth attention
  return 3; // screaming
}

/** Severity 1..3 for the hero list (already gated, always behind Tour). */
function heroSeverityOf(sgRd: number): 1 | 2 | 3 {
  if (sgRd > -0.2) return 1;
  if (sgRd > -0.45) return 2;
  return 3;
}

/** The consistent gap treatment, computed once per benchmarked bucket. */
export interface GapInfo {
  /** Your rate, 0..1 (make%, 1-putt%, or GIR%). */
  you: number;
  /** Tour band-average rate for this bucket, 0..1. */
  tour: number;
  /** you − tour, signed fraction (raw metric difference). */
  gap: number;
  /** Strokes/round lost vs Tour for this bucket (negative = behind, either direction). */
  sgRd: number;
  /** 0..3 severity driven by `sgRd`; `null` when the bucket is thin (n<gate). */
  sev: 0 | 1 | 2 | 3 | null;
  /** Below the n≥10 floor — never coloured, never drives the headline. */
  thin: boolean;
  /** Attempts in this bucket. */
  n: number;
  /** True for metrics where less is better (e.g. 3-putt%) — flips good/bad direction. */
  lowerIsBetter: boolean;
}

/** One row of the ranked "Biggest gaps to Tour" hero. */
export interface HeroGap {
  /** "Putts 10–20 ft" / "Approach 75–125 yds". */
  label: string;
  group: "Putting" | "Approach";
  you: number;
  tour: number;
  sgRd: number;
  sev: 1 | 2 | 3;
  n: number;
  /** Times you face this shot per round. */
  perRound: number;
  noun: string;
}

/**
 * Build a bucket's gap-to-Tour, or `undefined` when there's no comparison to
 * make (no attempts, or the bucket carries no Tour band).
 */
function buildGap(
  you: number | null,
  tour: number | undefined,
  n: number,
  rounds: number,
  strokeValue: number,
  lowerIsBetter = false,
): GapInfo | undefined {
  if (you == null || tour == null) return undefined;
  const gap = you - tour;
  // Deficit toward "good": positive = worse than Tour, in either metric direction.
  const deficit = lowerIsBetter ? gap : -gap;
  const sgRd = rounds > 0 ? -deficit * (n / rounds) * strokeValue : 0;
  const thin = n < BUCKET_GATE;
  return { you, tour, gap, sgRd, sev: thin ? null : severityOf(sgRd), thin, n, lowerIsBetter };
}

// ─── Row shapes ───────────────────────────────────────────────────────────────

export interface PuttMakeRateRow {
  label: string;
  putts: number;
  makes: number;
  makePct: number | null;
  /** PGA Tour band-average make% for this bucket (D-11); display-only. */
  tourMakePct?: number;
  /** You-vs-Tour gap treatment (redesign); absent when there's nothing to compare. */
  gap?: GapInfo;
}

export interface FirstPuttRow {
  label: string;
  faced: number;
  avgPutts: number | null;
  onePuttPct: number | null;
  threePuttPct: number | null;
  /** PGA Tour band-average 1-putt% (= make%) for this bucket (D-11). */
  tourOnePuttPct?: number;
  /** PGA Tour band-average 3-putt% for this bucket (D-11). */
  tourThreePuttPct?: number;
  /** You-vs-Tour gap on 1-putt% (redesign); does not feed the hero (avoids double-count). */
  gap?: GapInfo;
  /** You-vs-Tour gap on 3-putt% (lower is better); display-only. */
  threePuttGap?: GapInfo;
}

export interface PuttMissRow {
  label: string;
  misses: number;
  highPct: number | null;
  lowPct: number | null;
  shortPct: number | null;
  longPct: number | null;
}

export interface AroundGreenRow {
  label: string;
  shots: number;
  avgQuality: number | null;
  onGreenPct: number | null;
  upDownPct: number | null;
  /** PGA Tour band-average up-and-down% for this bucket (D-11). */
  tourUpDownPct?: number;
  /** You-vs-Tour gap on up-and-down% (redesign); display-only. */
  gap?: GapInfo;
}

export interface ApproachRow {
  label: string;
  shots: number;
  avgQuality: number | null;
  greenHitPct: number | null;
  /** PGA Tour band-average GIR% (green-hit%) for this bucket (D-11). */
  tourGreenHitPct?: number;
  missLPct: number;
  missRPct: number;
  missLongPct: number;
  missShortPct: number;
  /** You-vs-Tour gap on GIR% (redesign). */
  gap?: GapInfo;
}

export interface DistanceSummary {
  makeRate: PuttMakeRateRow[];
  firstPutt: FirstPuttRow[];
  missPatterns: PuttMissRow[];
  aroundGreen: AroundGreenRow[];
  approaches: ApproachRow[];
  /** Ranked top-3 biggest gaps to Tour (strokes/round), gated to n≥10. */
  hero: HeroGap[];
}

// ─── Internal accumulators ────────────────────────────────────────────────────

const isNum = (v: unknown): v is number => typeof v === "number";

/** A finite, on-or-above-zero yardage (matches the `.gs` `yd >= 0` putt guard). */
const validPuttYd = (v: number | null): v is number => isNum(v) && v >= 0;

export function computeDistanceSummary(
  shots: readonly ShotRow[],
): DistanceSummary {
  const roundHoles = aggregateByRoundHole(shots);
  const complete = roundHoles.filter((r) => r.complete);
  // Rounds represented in this window — the denominator for "per round" frequency
  // that weights each gap by how often the shot is faced.
  const rounds = new Set(shots.map((s) => s.round_id)).size;

  // ── Sub-table 1: Make Rate by Distance (every Putter shot) ──
  const makeRate = PUTT_BUCKETS.map((b) => ({
    label: b.label,
    putts: 0,
    makes: 0,
  }));
  for (const row of shots) {
    if (row.club !== "Putter") continue;
    if (!validPuttYd(row.yardage)) continue;
    const ft = puttYardsToFeet(row.yardage);
    const bucket = puttBucketOf(ft);
    if (!bucket) continue;
    const acc = makeRate.find((m) => m.label === bucket.label)!;
    acc.putts++;
    if (row.result === "Make") acc.makes++;
  }

  // ── Sub-table 2: First-Putt Performance (first real putt, complete holes) ──
  const firstPutt = PUTT_BUCKETS.map((b) => ({
    label: b.label,
    faced: 0,
    totalPutts: 0,
    onePutt: 0,
    threePutt: 0,
  }));
  for (const rh of complete) {
    const realPutts = rh.shots.filter(isRealPutt);
    if (realPutts.length === 0) continue;
    const fp = realPutts[0];
    if (!validPuttYd(fp.yardage)) continue;
    const ft = puttYardsToFeet(fp.yardage);
    const bucket = puttBucketOf(ft);
    if (!bucket) continue;
    const acc = firstPutt.find((m) => m.label === bucket.label)!;
    acc.faced++;
    acc.totalPutts += realPutts.length;
    if (realPutts.length === 1) acc.onePutt++;
    if (realPutts.length >= 3) acc.threePutt++;
  }

  // ── Sub-table 3: Putt Miss Patterns (every missed Putter shot) ──
  const missPatt = PUTT_BUCKETS.map((b) => ({
    label: b.label,
    misses: 0,
    high: 0,
    low: 0,
    short: 0,
    long: 0,
  }));
  for (const row of shots) {
    if (row.club !== "Putter") continue;
    if (row.result === "Make") continue; // misses only
    if (!validPuttYd(row.yardage)) continue;
    const ft = puttYardsToFeet(row.yardage);
    const bucket = puttBucketOf(ft);
    if (!bucket) continue;
    const acc = missPatt.find((m) => m.label === bucket.label)!;
    acc.misses++;
    if (row.putt_side === "High") acc.high++;
    else if (row.putt_side === "Low") acc.low++;
    if (row.putt_length === "Short") acc.short++;
    else if (row.putt_length === "Long") acc.long++;
  }

  // ── Sub-table 4: Around the Green (<30 yds, non-putt, complete holes) ──
  const arg = ATG_BUCKETS.map((b) => ({
    label: b.label,
    min: b.min,
    max: b.max,
    shots: 0,
    execSum: 0,
    execCount: 0,
    onGreen: 0,
    upDown: 0,
    upDownEligible: 0,
  }));
  for (const rh of complete) {
    for (let i = 0; i < rh.shots.length; i++) {
      const s = rh.shots[i];
      if (s.club === "Putter") continue;
      if (s.shot_no === 1 && rh.par !== 3) continue; // tee on par 4/5
      const yd = s.yardage;
      if (!isNum(yd) || yd < 0 || yd >= 30) continue;
      const bucket = bucketOf(arg, yd);
      if (!bucket) continue;
      bucket.shots++;
      if (isNum(s.execution) && s.execution > 0) {
        bucket.execSum += s.execution;
        bucket.execCount++;
      }
      if (s.result === "Green") bucket.onGreen++;
      // Up-and-down (D-06): this shot holed, OR the next shot is a made putt.
      bucket.upDownEligible++;
      if (s.result === "Make") {
        bucket.upDown++;
      } else if (i + 1 < rh.shots.length) {
        const next = rh.shots[i + 1];
        if (next.club === "Putter" && next.result === "Make") bucket.upDown++;
      }
    }
  }

  // ── Sub-table 5: Approaches (>=30 yds, every shot; incl. par-3 tees) ──
  const appr = APPROACH_BUCKETS.map((b) => ({
    label: b.label,
    min: b.min,
    max: b.max,
    shots: 0,
    execSum: 0,
    execCount: 0,
    greenHit: 0,
    missL: 0,
    missR: 0,
    missLong: 0,
    missShort: 0,
  }));
  for (const row of shots) {
    if (row.club === "Putter") continue;
    if (row.shot_no === 1 && row.par !== 3) continue; // tee on par 4/5
    const yd = row.yardage;
    if (!isNum(yd) || yd < 30) continue;
    const bucket = bucketOf(appr, yd);
    if (!bucket) continue;
    bucket.shots++;
    if (isNum(row.execution) && row.execution > 0) {
      bucket.execSum += row.execution;
      bucket.execCount++;
    }
    if (row.result === "Green") bucket.greenHit++;
    switch (row.miss_direction) {
      case "Left":
        bucket.missL++;
        break;
      case "Right":
        bucket.missR++;
        break;
      case "Long":
        bucket.missLong++;
        break;
      case "Short":
        bucket.missShort++;
        break;
    }
  }

  const makeRateRows: PuttMakeRateRow[] = makeRate.map((b) => {
    const makePct = b.putts > 0 ? b.makes / b.putts : null;
    const tourMakePct = TOUR_MAKE_PCT[b.label];
    return {
      label: b.label,
      putts: b.putts,
      makes: b.makes,
      makePct,
      tourMakePct,
      gap: buildGap(makePct, tourMakePct, b.putts, rounds, MAKE_STROKE_VALUE),
    };
  });

  const firstPuttRows: FirstPuttRow[] = firstPutt.map((b) => {
    const onePuttPct = b.faced > 0 ? b.onePutt / b.faced : null;
    const threePuttPct = b.faced > 0 ? b.threePutt / b.faced : null;
    const tourOnePuttPct = TOUR_MAKE_PCT[b.label];
    const tourThreePuttPct = TOUR_THREE_PUTT_PCT[b.label];
    return {
      label: b.label,
      faced: b.faced,
      avgPutts: b.faced > 0 ? r2(b.totalPutts / b.faced) : null,
      onePuttPct,
      threePuttPct,
      tourOnePuttPct,
      tourThreePuttPct,
      gap: buildGap(onePuttPct, tourOnePuttPct, b.faced, rounds, MAKE_STROKE_VALUE),
      threePuttGap: buildGap(
        threePuttPct,
        tourThreePuttPct,
        b.faced,
        rounds,
        THREE_PUTT_STROKE_VALUE,
        true, // fewer 3-putts is better
      ),
    };
  });

  const approachRows: ApproachRow[] = appr.map((b) => {
    const greenHitPct = b.shots > 0 ? b.greenHit / b.shots : null;
    const tourGreenHitPct = TOUR_GREEN_PCT[b.label];
    return {
      label: b.label,
      shots: b.shots,
      avgQuality: b.execCount > 0 ? r2(b.execSum / b.execCount) : null,
      greenHitPct,
      tourGreenHitPct,
      missLPct: b.shots > 0 ? b.missL / b.shots : 0,
      missRPct: b.shots > 0 ? b.missR / b.shots : 0,
      missLongPct: b.shots > 0 ? b.missLong / b.shots : 0,
      missShortPct: b.shots > 0 ? b.missShort / b.shots : 0,
      gap: buildGap(greenHitPct, tourGreenHitPct, b.shots, rounds, GREEN_STROKE_VALUE),
    };
  });

  // Hero: the three widest gaps to Tour by strokes/round, gated to n≥10. Built
  // off make-rate + approach only — the cuts that carry a Tour benchmark and don't
  // overlap (first-putt would double-count the putting gap, so it's excluded).
  const heroPool: HeroGap[] = [];
  for (const r of makeRateRows) {
    if (r.gap && !r.gap.thin && r.gap.sgRd < -0.05) {
      heroPool.push({
        label: `Putts ${r.label}`,
        group: "Putting",
        you: r.gap.you,
        tour: r.gap.tour,
        sgRd: r.gap.sgRd,
        sev: heroSeverityOf(r.gap.sgRd),
        n: r.gap.n,
        perRound: rounds > 0 ? r.gap.n / rounds : 0,
        noun: "putts",
      });
    }
  }
  for (const r of approachRows) {
    if (r.gap && !r.gap.thin && r.gap.sgRd < -0.05) {
      heroPool.push({
        label: `Approach ${r.label}`,
        group: "Approach",
        you: r.gap.you,
        tour: r.gap.tour,
        sgRd: r.gap.sgRd,
        sev: heroSeverityOf(r.gap.sgRd),
        n: r.gap.n,
        perRound: rounds > 0 ? r.gap.n / rounds : 0,
        noun: "shots",
      });
    }
  }
  const hero = heroPool.sort((a, b) => a.sgRd - b.sgRd).slice(0, 3);

  return {
    makeRate: makeRateRows,
    firstPutt: firstPuttRows,
    missPatterns: missPatt.map((b) => ({
      label: b.label,
      misses: b.misses,
      highPct: b.misses > 0 ? b.high / b.misses : null,
      lowPct: b.misses > 0 ? b.low / b.misses : null,
      shortPct: b.misses > 0 ? b.short / b.misses : null,
      longPct: b.misses > 0 ? b.long / b.misses : null,
    })),
    aroundGreen: arg.map((b) => {
      const upDownPct = b.upDownEligible > 0 ? b.upDown / b.upDownEligible : null;
      const tourUpDownPct = TOUR_UP_DOWN_PCT[b.label];
      return {
        label: b.label,
        shots: b.shots,
        avgQuality: b.execCount > 0 ? r2(b.execSum / b.execCount) : null,
        onGreenPct: b.shots > 0 ? b.onGreen / b.shots : null,
        upDownPct,
        tourUpDownPct,
        gap: buildGap(upDownPct, tourUpDownPct, b.shots, rounds, UPDOWN_STROKE_VALUE),
      };
    }),
    approaches: approachRows,
    hero,
  };
}
