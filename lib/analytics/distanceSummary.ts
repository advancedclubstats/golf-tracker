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
import type { ShotRow } from "@/lib/schemas/shot";

// ─── Row shapes ───────────────────────────────────────────────────────────────

export interface PuttMakeRateRow {
  label: string;
  putts: number;
  makes: number;
  makePct: number | null;
  /** PGA Tour band-average make% for this bucket (D-11); display-only. */
  tourMakePct?: number;
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
}

export interface DistanceSummary {
  makeRate: PuttMakeRateRow[];
  firstPutt: FirstPuttRow[];
  missPatterns: PuttMissRow[];
  aroundGreen: AroundGreenRow[];
  approaches: ApproachRow[];
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

  return {
    makeRate: makeRate.map((b) => ({
      label: b.label,
      putts: b.putts,
      makes: b.makes,
      makePct: b.putts > 0 ? b.makes / b.putts : null,
      tourMakePct: TOUR_MAKE_PCT[b.label],
    })),
    firstPutt: firstPutt.map((b) => ({
      label: b.label,
      faced: b.faced,
      avgPutts: b.faced > 0 ? r2(b.totalPutts / b.faced) : null,
      onePuttPct: b.faced > 0 ? b.onePutt / b.faced : null,
      threePuttPct: b.faced > 0 ? b.threePutt / b.faced : null,
      tourOnePuttPct: TOUR_MAKE_PCT[b.label],
      tourThreePuttPct: TOUR_THREE_PUTT_PCT[b.label],
    })),
    missPatterns: missPatt.map((b) => ({
      label: b.label,
      misses: b.misses,
      highPct: b.misses > 0 ? b.high / b.misses : null,
      lowPct: b.misses > 0 ? b.low / b.misses : null,
      shortPct: b.misses > 0 ? b.short / b.misses : null,
      longPct: b.misses > 0 ? b.long / b.misses : null,
    })),
    aroundGreen: arg.map((b) => ({
      label: b.label,
      shots: b.shots,
      avgQuality: b.execCount > 0 ? r2(b.execSum / b.execCount) : null,
      onGreenPct: b.shots > 0 ? b.onGreen / b.shots : null,
      upDownPct: b.upDownEligible > 0 ? b.upDown / b.upDownEligible : null,
      tourUpDownPct: TOUR_UP_DOWN_PCT[b.label],
    })),
    approaches: appr.map((b) => ({
      label: b.label,
      shots: b.shots,
      avgQuality: b.execCount > 0 ? r2(b.execSum / b.execCount) : null,
      greenHitPct: b.shots > 0 ? b.greenHit / b.shots : null,
      tourGreenHitPct: TOUR_GREEN_PCT[b.label],
      missLPct: b.shots > 0 ? b.missL / b.shots : 0,
      missRPct: b.shots > 0 ? b.missR / b.shots : 0,
      missLongPct: b.shots > 0 ? b.missLong / b.shots : 0,
      missShortPct: b.shots > 0 ? b.missShort / b.shots : 0,
    })),
  };
}
