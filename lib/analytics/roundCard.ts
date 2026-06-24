/**
 * Per-round breakdown for the Rounds browser (expandable card chips).
 *
 * The dashboard answers "where am I, all-time"; this answers the question you
 * actually have the moment a round ends: *did THIS round move my numbers, and
 * which way?* So every chip is framed as a delta vs your own average — not the
 * raw stat — reusing the same signed/direction-aware idea as the Distance
 * `GapChip` and the dashboard momentum copy.
 *
 * Two honesty rules, consistent with the rest of the engine:
 *   1. Leave-one-out baseline. A round is compared to the average of your
 *      *other* rounds, never against a pool that includes itself — otherwise
 *      your latest round always looks closer to "average" than it is.
 *   2. Hole-count-fair. A 9-hole round is compared to a 9-hole expectation
 *      (per-hole baseline × this round's holes), so counts (putts, SG, score)
 *      don't punish/flatter short rounds. Rates (FW%, GIR%, 3-putt%) are
 *      hole-count-independent already.
 *
 * Below the floor (not enough OTHER holes to form a baseline) the deltas are
 * absent and the card shows raw values only — never a guessed comparison.
 *
 * Layer rules: zero Supabase imports; pure over plain arrays; reuses core + sg.
 */

import { aggregateByRoundHole, enrichRoundHole } from "@/lib/analytics/core";
import { perShotSG, SG_CATEGORIES, type SgCategory } from "@/lib/analytics/sg";
import type { ShotRow } from "@/lib/schemas/shot";

/** Minimum OTHER complete holes needed before a delta is trustworthy. */
export const ROUND_CARD_FLOOR_HOLES = 9;

export type MetricKind = "sg" | "rate" | "count" | "score";

export interface RoundMetric {
  key: string;
  /** Short chip label, e.g. "Putting", "FW", "Putts", "Score". */
  label: string;
  kind: MetricKind;
  /** This round's raw value: SG strokes, a 0..1 rate, a count, or vs-par. */
  value: number;
  /** value − your-average expectation; null below the sample floor. */
  delta: number | null;
  /** True when a LOWER raw value is better (putts, 3-putts, score vs par). */
  lowerIsBetter: boolean;
}

export interface RoundBreakdown {
  roundId: string;
  /** Complete holes this round (the basis for every hole-fair comparison). */
  holes: number;
  metrics: RoundMetric[];
  /** Whether deltas are shown (enough other rounds to form a baseline). */
  eligible: boolean;
}

/** Per-round raw rollup, before any cross-round comparison. */
interface RoundRollup {
  roundId: string;
  holes: number;
  vsPar: number;
  putts: number;
  threePutts: number;
  gir: number;
  /** Par-4/5 holes (the fairway-opportunity denominator). */
  fwOpp: number;
  fwHits: number;
  sg: Record<SgCategory, number>;
}

function emptySg(): Record<SgCategory, number> {
  return { "Off the tee": 0, Approach: 0, "Short game": 0, Putting: 0 };
}

/**
 * Build the per-round breakdowns, keyed by round id. Only rounds with at least
 * one complete hole appear (in-progress rounds have no breakdown). `shots`
 * should be tee-distance-filled (see `getEnrichedShots`) so SG is computable.
 */
export function computeRoundBreakdowns(
  shots: readonly ShotRow[],
): Map<string, RoundBreakdown> {
  // ── Per-round raw rollup over complete holes ──
  const rollups = new Map<string, RoundRollup>();
  const ensure = (id: string): RoundRollup => {
    let r = rollups.get(id);
    if (!r) {
      r = {
        roundId: id,
        holes: 0,
        vsPar: 0,
        putts: 0,
        threePutts: 0,
        gir: 0,
        fwOpp: 0,
        fwHits: 0,
        sg: emptySg(),
      };
      rollups.set(id, r);
    }
    return r;
  };

  for (const h of aggregateByRoundHole(shots).filter((rh) => rh.complete)) {
    const e = enrichRoundHole(h);
    const r = ensure(e.roundId);
    r.holes++;
    r.vsPar += e.strokes - e.par;
    r.putts += e.putts;
    if (e.putts >= 3) r.threePutts++;
    if (e.gir) r.gir++;
    if (e.par >= 4) {
      r.fwOpp++;
      if (e.teeResult === "Fairway") r.fwHits++;
    }
  }

  // Per-shot SG → per-round category sums (covered shots only).
  for (const { shot, sg, category } of perShotSG(shots).entries) {
    const r = rollups.get(shot.round_id);
    if (r) r.sg[category] += sg;
  }

  // ── Global totals (for the leave-one-out baselines) ──
  const all = [...rollups.values()];
  const tot = {
    holes: 0,
    vsPar: 0,
    putts: 0,
    threePutts: 0,
    gir: 0,
    fwOpp: 0,
    fwHits: 0,
    sg: emptySg(),
  };
  for (const r of all) {
    tot.holes += r.holes;
    tot.vsPar += r.vsPar;
    tot.putts += r.putts;
    tot.threePutts += r.threePutts;
    tot.gir += r.gir;
    tot.fwOpp += r.fwOpp;
    tot.fwHits += r.fwHits;
    for (const c of SG_CATEGORIES) tot.sg[c] += r.sg[c];
  }

  const out = new Map<string, RoundBreakdown>();
  for (const r of all) {
    const otherHoles = tot.holes - r.holes;
    const eligible = otherHoles >= ROUND_CARD_FLOOR_HOLES;

    /** Leave-one-out expectation for a per-hole count/SG metric, scaled to this round. */
    const looScaled = (total: number, mine: number): number | null =>
      eligible ? ((total - mine) / otherHoles) * r.holes : null;

    /** Leave-one-out average rate (count/opportunity), excluding this round. */
    const looRate = (
      totalHits: number,
      totalOpp: number,
      myHits: number,
      myOpp: number,
    ): number | null => {
      const opp = totalOpp - myOpp;
      return eligible && opp > 0 ? (totalHits - myHits) / opp : null;
    };

    const metrics: RoundMetric[] = [];

    // SG categories — the spine. Higher is better.
    for (const c of SG_CATEGORIES) {
      const exp = looScaled(tot.sg[c], r.sg[c]);
      metrics.push({
        key: `sg:${c}`,
        // The SgCategory value is itself the display label, kept consistent
        // app-wide ("Off the tee", not "Driving") with the dashboard / SG pages.
        label: c,
        kind: "sg",
        value: r.sg[c],
        delta: exp == null ? null : r.sg[c] - exp,
        lowerIsBetter: false,
      });
    }

    // Fairways hit % (par 4/5 only). Higher is better. Null if no opp this round.
    if (r.fwOpp > 0) {
      const base = looRate(tot.fwHits, tot.fwOpp, r.fwHits, r.fwOpp);
      const value = r.fwHits / r.fwOpp;
      metrics.push({
        key: "fw",
        label: "FW",
        kind: "rate",
        value,
        delta: base == null ? null : value - base,
        lowerIsBetter: false,
      });
    }

    // Greens in regulation %. Higher is better.
    {
      const base = looRate(tot.gir, tot.holes, r.gir, r.holes);
      const value = r.gir / r.holes;
      metrics.push({
        key: "gir",
        label: "GIR",
        kind: "rate",
        value,
        delta: base == null ? null : value - base,
        lowerIsBetter: false,
      });
    }

    // Total putts. Lower is better.
    {
      const exp = looScaled(tot.putts, r.putts);
      metrics.push({
        key: "putts",
        label: "Putts",
        kind: "count",
        value: r.putts,
        delta: exp == null ? null : r.putts - exp,
        lowerIsBetter: true,
      });
    }

    // 3-putts (count). Lower is better.
    {
      const exp = looScaled(tot.threePutts, r.threePutts);
      metrics.push({
        key: "3putt",
        label: "3-putt",
        kind: "count",
        value: r.threePutts,
        delta: exp == null ? null : r.threePutts - exp,
        lowerIsBetter: true,
      });
    }

    // Score vs par. Lower is better.
    {
      const exp = looScaled(tot.vsPar, r.vsPar);
      metrics.push({
        key: "score",
        label: "Score",
        kind: "score",
        value: r.vsPar,
        delta: exp == null ? null : r.vsPar - exp,
        lowerIsBetter: true,
      });
    }

    out.set(r.roundId, { roundId: r.roundId, holes: r.holes, metrics, eligible });
  }

  return out;
}
