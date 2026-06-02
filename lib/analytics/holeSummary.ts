/**
 * Hole Summary (P2-T2).
 *
 * Pure port of `rebuildHoleSummary` from `docs/golf_stats.gs` (lines ~187–294),
 * minus the spreadsheet I/O and formatting. Produces a per-hole stats table as
 * plain data: for each hole number, the averages across every complete round.
 *
 * Layer rules (same as core): zero Supabase imports; pure function over a
 * `ShotRow[]`; reuses the core primitives rather than re-deriving strokes /
 * putts / GIR.
 *
 * Sentinels: the `.gs` writes '' for "not applicable" cells. Here those are
 * `null` (FW% on a par 3, Scramble% with no missed greens, Shot Quality with no
 * non-putt data) — the display layer decides how to render them.
 */

import { aggregateByRoundHole, enrichRoundHole, r2 } from "@/lib/analytics/core";
import type { ShotRow } from "@/lib/schemas/shot";

/** One row of the hole summary table — stats for a single hole across rounds. */
export interface HoleSummaryRow {
  hole: number;
  par: number;
  /** Number of complete rounds logged on this hole. */
  rounds: number;
  avgScore: number;
  /** Lowest score recorded on this hole. */
  best: number;
  avgVsPar: number;
  /** Cumulative `(strokes - par)` across all rounds on this hole. */
  allTimeVsPar: number;
  /** Fairways hit on the tee, as a fraction. `null` on par 3s. */
  fwPct: number | null;
  /** Greens in regulation, as a fraction. */
  girPct: number;
  /** Of greens missed, fraction saved (strokes ≤ par). `null` if none missed. */
  scramblePct: number | null;
  avgPutts: number;
  /** Fraction of rounds with 3+ putts on this hole. */
  threePuttPct: number;
  /** Average non-putt execution rating. `null` if no rated non-putt shots. */
  shotQuality: number | null;
}

/** A round-hole that was excluded from the summary (last shot wasn't 'Make'). */
export interface ExcludedRoundHole {
  roundId: string;
  hole: number;
}

export interface HoleSummary {
  /** One row per hole, ascending by hole number. */
  rows: HoleSummaryRow[];
  /** Count of complete round-holes that fed the summary. */
  completeCount: number;
  /** Incomplete round-holes excluded from all aggregates (sorted). */
  excluded: ExcludedRoundHole[];
}

/**
 * Compute the hole summary from raw shot rows.
 *
 * Only complete round-holes (last shot's result is 'Make') are aggregated;
 * partial holes are excluded and reported in `excluded` (matches the `.gs`
 * "Complete round-holes counted / excluded" footer).
 */
export function computeHoleSummary(shots: readonly ShotRow[]): HoleSummary {
  const roundHoles = aggregateByRoundHole(shots);
  const complete = roundHoles.filter((r) => r.complete).map(enrichRoundHole);
  const incomplete = roundHoles.filter((r) => !r.complete);

  // Group complete round-holes by hole number.
  const byHole = new Map<number, ReturnType<typeof enrichRoundHole>[]>();
  for (const r of complete) {
    const list = byHole.get(r.hole);
    if (list) list.push(r);
    else byHole.set(r.hole, [r]);
  }

  const holes = Array.from(byHole.keys()).sort((a, b) => a - b);
  const rows: HoleSummaryRow[] = [];

  for (const hole of holes) {
    const group = byHole.get(hole)!;
    const par = group[0].par;
    const n = group.length;

    const totalStrokes = group.reduce((s, r) => s + r.strokes, 0);
    const avgScore = totalStrokes / n;
    const best = Math.min(...group.map((r) => r.strokes));
    const allTimeVsPar = totalStrokes - par * n;

    const fwPct =
      par >= 4
        ? group.filter((r) => r.teeResult === "Fairway").length / n
        : null;

    const girPct = group.filter((r) => r.gir).length / n;

    const girMissed = group.filter((r) => !r.gir);
    const scramblePct =
      girMissed.length > 0
        ? girMissed.filter((r) => r.strokes <= par).length / girMissed.length
        : null;

    const avgPutts = group.reduce((s, r) => s + r.putts, 0) / n;
    const threePuttPct = group.filter((r) => r.putts >= 3).length / n;

    const tnps = group.reduce((s, r) => s + r.nonPuttExecSum, 0);
    const tnpc = group.reduce((s, r) => s + r.nonPuttExecCount, 0);
    const shotQuality = tnpc > 0 ? r2(tnps / tnpc) : null;

    rows.push({
      hole,
      par,
      rounds: n,
      avgScore: r2(avgScore),
      best,
      avgVsPar: r2(avgScore - par),
      allTimeVsPar,
      fwPct,
      girPct,
      scramblePct,
      avgPutts: r2(avgPutts),
      threePuttPct,
      shotQuality,
    });
  }

  const excluded: ExcludedRoundHole[] = incomplete
    .map((r) => ({ roundId: r.roundId, hole: r.hole }))
    .sort((a, b) =>
      `${a.roundId}${a.hole}`.localeCompare(`${b.roundId}${b.hole}`),
    );

  return { rows, completeCount: complete.length, excluded };
}
