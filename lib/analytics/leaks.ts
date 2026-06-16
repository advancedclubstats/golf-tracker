/**
 * Leak ranking (spec Part 3).
 *
 * "One ranked list, three depths." Cuts every covered shot's SG into leaks
 * ranked by **strokes recoverable per round** (most-negative SG/round first),
 * each carrying the data for three drill-down depths:
 *   1. Raw     — the number (e.g. "Approach 175+: 27% greens").
 *   2. Meaning — vs the scratch target (the SG gap; scratch = 0 SG/shot).
 *   3. Impact  — `shotsDetail`: every qualifying shot, what it cost, the miss.
 *
 * Sample-gated (spec 2C, via `gates.ts`): distance buckets need n≥10. Below
 * threshold a leak still surfaces but as an "early read"
 * (`prescribable=false`) and must never be presented as a recommendation.
 *
 * Pure; builds on `perShotSG`. The SG gap (vs 0) is the spine; `target`/`raw`
 * carry the descriptive stat + its scratch anchor where one is defensible.
 */

import {
  APPROACH_BUCKETS,
  ATG_BUCKETS,
  type MissDirection,
  type Result,
  type DecisionQuality,
} from "@/lib/constants";
import { puttBucketOf, bucketOf, puttYardsToFeet } from "@/lib/analytics/core";
import { perShotSG, type SgCategory } from "@/lib/analytics/sg";
import { tierFor, type SampleTier, type SampleKind } from "@/lib/analytics/gates";
import type { ShotRow } from "@/lib/schemas/shot";

/**
 * Scratch targets for the descriptive stat behind each cut (fraction 0–1).
 * Putt make-rate is anchored to the spec's Part 3 values; approach green-hit and
 * around-the-green on-green rates are reasonable scratch levels — VERIFY against
 * a source before leaning on the descriptive line. The SG gap (vs 0) is exact
 * regardless; these only annotate the raw % shown alongside it.
 */
const PUTT_MAKE_TARGET: Record<string, number> = {
  "0–3 ft": 0.99,
  "3–6 ft": 0.78,
  "6–10 ft": 0.5,
  "10–20 ft": 0.22,
  "20+ ft": 0.07,
};
const APPROACH_GREEN_TARGET: Record<string, number> = {
  "30–75 yds": 0.8,
  "75–125 yds": 0.7,
  "125–175 yds": 0.58,
  "175+ yds": 0.42,
};
const ATG_ONGREEN_TARGET: Record<string, number> = {
  "0–10 yds": 0.92,
  "10–30 yds": 0.82,
};

/** A single qualifying shot for the Impact (depth 3) layer. */
export interface LeakShot {
  id: string;
  hole: number;
  /** SG for this shot (negative = a loss). */
  sg: number;
  yards: number | null;
  miss: MissDirection | null;
  result: Result | null;
  decision: DecisionQuality;
}

export type LeakKind = "approach" | "putt" | "atg";

export interface Leak {
  /** Stable key (kind + label). */
  id: string;
  kind: LeakKind;
  label: string;
  category: SgCategory | null;
  /** Sample size (covered shots in this cut). */
  shots: number;
  tier: SampleTier;
  /** True only when the sample clears its gate — eligible to be prescribed. */
  prescribable: boolean;
  /** Total SG for the cut (negative = a leak). */
  sg: number;
  /** Strokes recoverable per round — the ranking key (negative = losing). */
  sgPerRound: number;
  sgPerShot: number;
  /** Descriptive stat for depth 1 (fraction 0–1), or null when none applies. */
  raw: { label: string; value: number } | null;
  /** Scratch target for `raw` (fraction 0–1), or null. */
  target: number | null;
  /** Impact layer: qualifying shots, worst (most negative) first. */
  shotsDetail: LeakShot[];
}

interface Bucketed {
  kind: LeakKind;
  label: string;
  category: SgCategory | null;
  sampleKind: SampleKind;
  sg: number;
  shots: LeakShot[];
  /** Numerator for the descriptive raw stat (e.g. greens hit). */
  rawHits: number;
  rawLabel: string | null;
  target: number | null;
}

function toLeakShot(s: ShotRow, sg: number): LeakShot {
  return {
    id: s.id,
    hole: s.hole,
    sg,
    yards: s.yardage,
    miss: s.miss_direction,
    result: s.result,
    decision: s.decision_quality,
  };
}

/**
 * Rank leaks across approach/putt/around-the-green distance buckets.
 * Returns every cut (sorted most-negative SG/round first) with its tier; the
 * consumer shows prescribable ones as the recommendation list and the rest as
 * early reads.
 */
export function computeLeaks(shots: readonly ShotRow[]): {
  leaks: Leak[];
  rounds: number;
} {
  const { entries, rounds } = perShotSG(shots);
  const cuts = new Map<string, Bucketed>();

  const get = (
    kind: LeakKind,
    label: string,
    category: SgCategory | null,
    sampleKind: SampleKind,
    rawLabel: string | null,
    target: number | null,
  ): Bucketed => {
    const id = `${kind}:${label}`;
    let c = cuts.get(id);
    if (!c) {
      c = { kind, label, category, sampleKind, sg: 0, shots: [], rawHits: 0, rawLabel, target };
      cuts.set(id, c);
    }
    return c;
  };

  for (const { shot, sg, category } of entries) {
    const detail = toLeakShot(shot, sg);

    // No club cut: a club is a proxy for distance, already covered by the
    // approach / around-the-green / putt distance buckets below.
    if (category === "Putting") {
      const b = shot.yardage != null ? puttBucketOf(puttYardsToFeet(shot.yardage)) : null;
      if (b) {
        const c = get("putt", b.label, "Putting", "bucket", "made", PUTT_MAKE_TARGET[b.label] ?? null);
        c.sg += sg;
        c.shots.push(detail);
        if (shot.result === "Make") c.rawHits++;
      }
    } else if (category === "Short game") {
      const b = shot.yardage != null ? bucketOf(ATG_BUCKETS, shot.yardage) : null;
      if (b) {
        const c = get("atg", b.label, "Short game", "bucket", "on green", ATG_ONGREEN_TARGET[b.label] ?? null);
        c.sg += sg;
        c.shots.push(detail);
        if (shot.result === "Green" || shot.result === "Make") c.rawHits++;
      }
    } else if (category === "Approach") {
      const b = shot.yardage != null ? bucketOf(APPROACH_BUCKETS, shot.yardage) : null;
      if (b) {
        const c = get("approach", b.label, "Approach", "bucket", "greens", APPROACH_GREEN_TARGET[b.label] ?? null);
        c.sg += sg;
        c.shots.push(detail);
        if (shot.result === "Green" || shot.result === "Make") c.rawHits++;
      }
    }
  }

  const leaks: Leak[] = [...cuts.values()].map((c) => {
    const n = c.shots.length;
    const tier = tierFor(c.sampleKind, n);
    return {
      id: `${c.kind}:${c.label}`,
      kind: c.kind,
      label: c.label,
      category: c.category,
      shots: n,
      tier,
      prescribable: tier === "stable",
      sg: c.sg,
      sgPerRound: rounds > 0 ? c.sg / rounds : 0,
      sgPerShot: n > 0 ? c.sg / n : 0,
      raw: c.rawLabel ? { label: c.rawLabel, value: n > 0 ? c.rawHits / n : 0 } : null,
      target: c.target,
      shotsDetail: c.shots.slice().sort((a, b) => a.sg - b.sg),
    };
  });

  // Rank by strokes recoverable per round: most-negative first.
  leaks.sort((a, b) => a.sgPerRound - b.sgPerRound);
  return { leaks, rounds };
}
