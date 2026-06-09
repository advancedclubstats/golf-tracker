/**
 * Dashboard analytics.
 *
 * Returns structured data; the UI formats labels. Pure over plain arrays, zero
 * Supabase imports, reuses core primitives.
 *
 * Signature note: unlike the other analytics functions, this also takes round
 * metadata (`id` + `date`) — in our schema the round date lives on `rounds`, so
 * it's joined in here for recent-rounds ordering.
 *
 * ── Spec 2D (the second engine is deleted) ───────────────────────────────────
 * The heuristic "Strokes Lost" attribution (over → puttsLost → tee vs approach)
 * and the green%/make%/quality "What to Work On" are GONE. Everything
 * prescriptive now flows from Strokes Gained (`lib/analytics/sg.ts`) so no tab
 * contradicts another. What remains here is descriptive only: snapshot, the
 * classic stat line, recent rounds, and course records (best hole/round are
 * celebratory records, not prescriptions).
 *
 * Locked rules honored:
 *   - D-07: "Best Hole" is the lowest CUMULATIVE (strokes - par), not a single
 *     best score.
 *   - D-08: practice rounds are not filtered out (caller passes all rounds).
 */

import {
  aggregateByRoundHole,
  enrichRoundHole,
  r2,
} from "@/lib/analytics/core";
import type { ShotRow } from "@/lib/schemas/shot";
import type { RoundRow } from "@/lib/schemas/round";

// ─── Output shapes ────────────────────────────────────────────────────────────

export interface DashboardSnapshot {
  roundsLogged: number;
  holesLogged: number;
  totalVsPar: number;
  avgVsParPerRound: number;
  avgVsParPerHole: number;
}

export interface DashboardStatLine {
  fwPct: number | null;
  girPct: number;
  scramblePct: number | null;
  avgPutts: number;
  threePuttPct: number;
}

export interface HolePain {
  hole: number;
  par: number;
  vsPar: number;
  rounds: number;
}

export interface RecentRound {
  date: string | null;
  roundId: string;
  holes: number;
  strokes: number;
  par: number;
  vsPar: number;
}

export interface RoundRecord {
  roundId: string;
  holes: number;
  strokes: number;
  vsPar: number;
}

export interface DashboardRecords {
  bestRound: RoundRecord | null;
  worstRound: RoundRecord | null;
  bestHole: HolePain | null;
  birdies: number;
  eagles: number;
}

export interface DashboardData {
  snapshot: DashboardSnapshot;
  statLine: DashboardStatLine;
  recentRounds: RecentRound[];
  records: DashboardRecords;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a round date to a sortable epoch; missing/invalid → 0 (sorts last). */
function dateKey(d: string | null): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

function emptyDashboard(): DashboardData {
  return {
    snapshot: {
      roundsLogged: 0,
      holesLogged: 0,
      totalVsPar: 0,
      avgVsParPerRound: 0,
      avgVsParPerHole: 0,
    },
    statLine: {
      fwPct: null,
      girPct: 0,
      scramblePct: null,
      avgPutts: 0,
      threePuttPct: 0,
    },
    recentRounds: [],
    records: {
      bestRound: null,
      worstRound: null,
      bestHole: null,
      birdies: 0,
      eagles: 0,
    },
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function computeDashboard(
  shots: readonly ShotRow[],
  rounds: readonly Pick<RoundRow, "id" | "date">[],
): DashboardData {
  const dateOf = new Map<string, string>();
  for (const r of rounds) dateOf.set(r.id, r.date);

  const complete = aggregateByRoundHole(shots)
    .filter((r) => r.complete)
    .map(enrichRoundHole);

  if (complete.length === 0) return emptyDashboard();

  // ── Aggregate by round ──
  interface RoundAgg {
    roundId: string;
    date: string | null;
    holes: number;
    strokes: number;
    par: number;
    vsPar: number;
  }
  const byRoundMap = new Map<string, RoundAgg>();
  for (const e of complete) {
    let ra = byRoundMap.get(e.roundId);
    if (!ra) {
      ra = {
        roundId: e.roundId,
        date: dateOf.get(e.roundId) ?? null,
        holes: 0,
        strokes: 0,
        par: 0,
        vsPar: 0,
      };
      byRoundMap.set(e.roundId, ra);
    }
    ra.holes++;
    ra.strokes += e.strokes;
    ra.par += e.par;
  }
  const byRound = Array.from(byRoundMap.values());
  for (const ra of byRound) ra.vsPar = ra.strokes - ra.par;
  byRound.sort((a, b) => dateKey(b.date) - dateKey(a.date)); // newest first

  // ── Snapshot ──
  const totalStrokes = complete.reduce((s, r) => s + r.strokes, 0);
  const totalPar = complete.reduce((s, r) => s + r.par, 0);
  const totalVsPar = totalStrokes - totalPar;

  // ── Stat line ──
  const par45 = complete.filter((r) => r.par >= 4);
  const fwPct =
    par45.length > 0
      ? par45.filter((r) => r.teeResult === "Fairway").length / par45.length
      : null;
  const girPct = complete.filter((r) => r.gir).length / complete.length;
  const totalPutts = complete.reduce((s, r) => s + r.putts, 0);
  const threePuttRate =
    complete.filter((r) => r.putts >= 3).length / complete.length;
  const girMissed = complete.filter((r) => !r.gir);
  const scramblePct =
    girMissed.length > 0
      ? girMissed.filter((r) => r.strokes <= r.par).length / girMissed.length
      : null;

  // ── Best hole (lowest cumulative vs par; D-07) — a record, not a prescription ──
  interface HoleAgg {
    hole: number;
    par: number;
    strokes: number;
    parTotal: number;
    n: number;
  }
  const byHoleMap = new Map<number, HoleAgg>();
  for (const e of complete) {
    let h = byHoleMap.get(e.hole);
    if (!h) {
      h = { hole: e.hole, par: e.par, strokes: 0, parTotal: 0, n: 0 };
      byHoleMap.set(e.hole, h);
    }
    h.strokes += e.strokes;
    h.parTotal += e.par;
    h.n++;
  }
  const holesArr: HolePain[] = Array.from(byHoleMap.values()).map((h) => ({
    hole: h.hole,
    par: h.par,
    vsPar: h.strokes - h.parTotal,
    rounds: h.n,
  }));
  const bestHole =
    holesArr.length > 0
      ? holesArr.reduce((b, h) => (h.vsPar < b.vsPar ? h : b))
      : null;

  // ── Records ──
  const bestRoundAgg =
    byRound.length > 0
      ? byRound.reduce((b, r) => (r.vsPar < b.vsPar ? r : b))
      : null;
  const worstRoundAgg =
    byRound.length > 0
      ? byRound.reduce((w, r) => (r.vsPar > w.vsPar ? r : w))
      : null;
  const birdies = complete.filter((r) => r.strokes === r.par - 1).length;
  const eagles = complete.filter((r) => r.strokes <= r.par - 2).length;

  const toRecord = (r: RoundAgg | null): RoundRecord | null =>
    r ? { roundId: r.roundId, holes: r.holes, strokes: r.strokes, vsPar: r.vsPar } : null;

  return {
    snapshot: {
      roundsLogged: byRound.length,
      holesLogged: complete.length,
      totalVsPar,
      avgVsParPerRound: r2(totalVsPar / byRound.length),
      avgVsParPerHole: r2(totalVsPar / complete.length),
    },
    statLine: {
      fwPct,
      girPct,
      scramblePct,
      avgPutts: r2(totalPutts / complete.length),
      threePuttPct: threePuttRate,
    },
    recentRounds: byRound.slice(0, 5).map((r) => ({
      date: r.date,
      roundId: r.roundId,
      holes: r.holes,
      strokes: r.strokes,
      par: r.par,
      vsPar: r.vsPar,
    })),
    records: {
      bestRound: toRecord(bestRoundAgg),
      worstRound: toRecord(worstRoundAgg),
      bestHole,
      birdies,
      eagles,
    },
  };
}
