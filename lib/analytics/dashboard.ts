/**
 * Dashboard (P2-T5).
 *
 * Pure port of `rebuildDashboard` from `docs/golf_stats.gs` (lines ~646–1036),
 * minus the spreadsheet I/O and the display-string assembly. Returns structured
 * data; the UI formats labels like "Hole 7 (par 4) · +5 across 3 rounds".
 *
 * Signature note: unlike the other analytics functions, this also takes round
 * metadata (`id` + `date`). In the sheet model `Date` lived on each shot row;
 * in our schema it lives on `rounds`, so dates are joined in here.
 *
 * Locked rules honored:
 *   - Strokes-lost attribution (SPEC §Strokes-lost attribution; deferred from
 *     P2-T1): over → puttsLost → nonPuttLost → tee vs approach.
 *   - D-06 is not needed here (no up-and-down on the dashboard).
 *   - D-07: "Best Hole" is the lowest CUMULATIVE (strokes - par), not a single
 *     best score.
 *   - D-08: practice rounds are not filtered out (caller passes all rounds).
 *
 * Layer rules: zero Supabase imports; pure over plain arrays; reuses core
 * primitives. `.gs` '' sentinels become `null`.
 */

import {
  PUTT_BUCKETS,
  APPROACH_BUCKETS,
} from "@/lib/constants";
import {
  aggregateByRoundHole,
  enrichRoundHole,
  puttBucketOf,
  bucketOf,
  puttYardsToFeet,
  r2,
  type EnrichedRoundHole,
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

export interface StrokesLost {
  tee: number;
  approach: number;
  putting: number;
  total: number;
  /** Each category's share of `total`. `null` when `total` is 0. */
  teePct: number | null;
  approachPct: number | null;
  puttingPct: number | null;
}

export interface HolePain {
  hole: number;
  par: number;
  vsPar: number;
  rounds: number;
}

export interface WorstApproach {
  label: string;
  greenHitPct: number;
  shots: number;
}

export interface WorstPutt {
  label: string;
  makePct: number;
  putts: number;
}

export interface WorstClub {
  club: string;
  avgQuality: number;
  shots: number;
}

export interface WhatToWorkOn {
  worstHole: HolePain | null;
  worstApproach: WorstApproach | null;
  worstPutt: WorstPutt | null;
  worstClub: WorstClub | null;
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

export type MulliganCategory = "tee" | "approach" | "shortGame" | "putt";

export interface MulliganEntry {
  date: string | null;
  roundId: string;
  hole: number;
  shotNo: number;
  club: string;
  category: MulliganCategory;
}

export interface DashboardMulligans {
  total: number;
  perRound: number;
  byCategory: Record<MulliganCategory, number>;
  recent: MulliganEntry[];
}

export interface DashboardData {
  snapshot: DashboardSnapshot;
  statLine: DashboardStatLine;
  strokesLost: StrokesLost;
  whatToWorkOn: WhatToWorkOn;
  recentRounds: RecentRound[];
  records: DashboardRecords;
  mulligans: DashboardMulligans;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isNum = (v: unknown): v is number => typeof v === "number";

/** Parse a round date to a sortable epoch; missing/invalid → 0 (sorts last). */
function dateKey(d: string | null): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Per-hole strokes-lost attribution (SPEC §Strokes-lost attribution). */
interface Attribution {
  teeLost: number;
  approachLost: number;
  puttsLost: number;
}
function attribute(e: EnrichedRoundHole): Attribution {
  const over = Math.max(0, e.strokes - e.par);
  const puttsLost = Math.max(0, e.putts - 2);
  const nonPuttLost = Math.max(0, over - puttsLost);

  const teeShot = e.shots[0];
  const fwHit = e.teeResult === "Fairway";
  const teeMissTagged = teeShot != null && teeShot.miss_direction != null;
  // Only blame the tee when par >= 4, the fairway was missed, AND the miss was
  // explicitly tagged on the tee shot.
  const teeLost = e.par >= 4 && teeMissTagged && !fwHit ? nonPuttLost : 0;
  const approachLost = nonPuttLost - teeLost;

  return { teeLost, approachLost, puttsLost };
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
    strokesLost: {
      tee: 0,
      approach: 0,
      putting: 0,
      total: 0,
      teePct: null,
      approachPct: null,
      puttingPct: null,
    },
    whatToWorkOn: {
      worstHole: null,
      worstApproach: null,
      worstPutt: null,
      worstClub: null,
    },
    recentRounds: [],
    records: {
      bestRound: null,
      worstRound: null,
      bestHole: null,
      birdies: 0,
      eagles: 0,
    },
    mulligans: {
      total: 0,
      perRound: 0,
      byCategory: { tee: 0, approach: 0, shortGame: 0, putt: 0 },
      recent: [],
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

  // ── Strokes lost ──
  let teeLostTotal = 0;
  let apprLostTotal = 0;
  let puttLostTotal = 0;
  for (const e of complete) {
    const a = attribute(e);
    teeLostTotal += a.teeLost;
    apprLostTotal += a.approachLost;
    puttLostTotal += a.puttsLost;
  }
  const totalLost = teeLostTotal + apprLostTotal + puttLostTotal;

  // ── Hole pain points (cumulative vs par; D-07) ──
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
  const worstHole =
    holesArr.length > 0
      ? holesArr.reduce((w, h) => (h.vsPar > w.vsPar ? h : w))
      : null;
  const bestHole =
    holesArr.length > 0
      ? holesArr.reduce((b, h) => (h.vsPar < b.vsPar ? h : b))
      : null;

  // ── Worst club (avg quality, min 3 shots, non-putter) ──
  interface ClubAgg {
    club: string;
    shots: number;
    execSum: number;
    execCount: number;
  }
  const clubMap = new Map<string, ClubAgg>();
  for (const row of shots) {
    if (!row.club || !row.shot_no || row.club === "Putter") continue;
    let c = clubMap.get(row.club);
    if (!c) {
      c = { club: row.club, shots: 0, execSum: 0, execCount: 0 };
      clubMap.set(row.club, c);
    }
    c.shots++;
    if (isNum(row.execution) && row.execution > 0) {
      c.execSum += row.execution;
      c.execCount++;
    }
  }
  const eligibleClubs = Array.from(clubMap.values()).filter(
    (c) => c.shots >= 3 && c.execCount > 0,
  );
  const worstClub: WorstClub | null =
    eligibleClubs.length > 0
      ? (() => {
          const w = eligibleClubs.reduce((a, b) =>
            b.execSum / b.execCount < a.execSum / a.execCount ? b : a,
          );
          return {
            club: w.club,
            avgQuality: r2(w.execSum / w.execCount),
            shots: w.shots,
          };
        })()
      : null;

  // ── Worst approach bucket (min 3 shots) ──
  const apprAgg = APPROACH_BUCKETS.map((b) => ({
    label: b.label,
    min: b.min,
    max: b.max,
    shots: 0,
    greenHit: 0,
  }));
  for (const row of shots) {
    if (row.club === "Putter") continue;
    if (row.shot_no === 1 && row.par !== 3) continue;
    const yd = row.yardage;
    if (!isNum(yd) || yd < 30) continue;
    const b = bucketOf(apprAgg, yd);
    if (!b) continue;
    b.shots++;
    if (row.result === "Green") b.greenHit++;
  }
  const eligibleAppr = apprAgg.filter((b) => b.shots >= 3);
  const worstApproach: WorstApproach | null =
    eligibleAppr.length > 0
      ? (() => {
          const w = eligibleAppr.reduce((a, b) =>
            b.greenHit / b.shots < a.greenHit / a.shots ? b : a,
          );
          return { label: w.label, greenHitPct: w.greenHit / w.shots, shots: w.shots };
        })()
      : null;

  // ── Worst putt bucket (min 3 putts, excluding tap-ins) ──
  const puttAgg = PUTT_BUCKETS.map((b) => ({
    label: b.label,
    putts: 0,
    makes: 0,
  }));
  for (const row of shots) {
    if (row.club !== "Putter") continue;
    const yd = row.yardage;
    if (!isNum(yd) || yd < 0) continue;
    const bucket = puttBucketOf(puttYardsToFeet(yd));
    if (!bucket) continue;
    const acc = puttAgg.find((p) => p.label === bucket.label)!;
    acc.putts++;
    if (row.result === "Make") acc.makes++;
  }
  const eligiblePutt = puttAgg.filter(
    (b) => b.putts >= 3 && b.label !== "0–3 ft",
  );
  const worstPutt: WorstPutt | null =
    eligiblePutt.length > 0
      ? (() => {
          const w = eligiblePutt.reduce((a, b) =>
            b.makes / b.putts < a.makes / a.putts ? b : a,
          );
          return { label: w.label, makePct: w.makes / w.putts, putts: w.putts };
        })()
      : null;

  // ── Mulligans (mulligan column always present in our schema) ──
  const byCategory: Record<MulliganCategory, number> = {
    tee: 0,
    approach: 0,
    shortGame: 0,
    putt: 0,
  };
  const mulliganEntries: MulliganEntry[] = [];
  for (const row of shots) {
    if (!row.mulligan) continue;
    let category: MulliganCategory;
    if (row.club === "Putter") category = "putt";
    else if (row.shot_no === 1 && row.par !== 3) category = "tee";
    else if (isNum(row.yardage) && row.yardage < 30) category = "shortGame";
    else category = "approach";
    byCategory[category]++;
    mulliganEntries.push({
      date: dateOf.get(row.round_id) ?? null,
      roundId: row.round_id,
      hole: row.hole,
      shotNo: row.shot_no,
      club: row.club,
      category,
    });
  }
  mulliganEntries.sort((a, b) => dateKey(b.date) - dateKey(a.date));
  const totalMulligans = mulliganEntries.length;

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
    strokesLost: {
      tee: teeLostTotal,
      approach: apprLostTotal,
      putting: puttLostTotal,
      total: totalLost,
      teePct: totalLost > 0 ? teeLostTotal / totalLost : null,
      approachPct: totalLost > 0 ? apprLostTotal / totalLost : null,
      puttingPct: totalLost > 0 ? puttLostTotal / totalLost : null,
    },
    whatToWorkOn: { worstHole, worstApproach, worstPutt, worstClub },
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
    mulligans: {
      total: totalMulligans,
      perRound: byRound.length > 0 ? r2(totalMulligans / byRound.length) : 0,
      byCategory,
      recent: mulliganEntries.slice(0, 5),
    },
  };
}
