/**
 * Club Summary (P2-T3).
 *
 * Pure port of `rebuildClubSummary` from `docs/golf_stats.gs` (lines ~296–396),
 * minus the spreadsheet I/O. Produces per-club performance stats as plain data.
 *
 * Important: unlike the hole summary, this aggregates EVERY shot row (the `.gs`
 * iterates the raw data, not complete round-holes) — shots on partial holes
 * still count toward club stats. The Putter is excluded (it's covered by the
 * distance summary).
 *
 * Sort order uses the canonical `CLUBS` array from `lib/constants.ts` rather
 * than re-defining the `.gs` CLUB_ORDER list — equivalent for our bag and keeps
 * the club ordering single-sourced. Unknown clubs sort last, alphabetically.
 *
 * Layer rules: zero Supabase imports; pure function over a `ShotRow[]`.
 * Sentinels: `.gs` '' becomes `null` (Avg Quality / Avg Yds with no data,
 * FW% with no tee shots, Green% with no approaches).
 */

import { CLUBS } from "@/lib/constants";
import { r2 } from "@/lib/analytics/core";
import type { ShotRow } from "@/lib/schemas/shot";

/** One row of the club summary table — stats for a single club. */
export interface ClubSummaryRow {
  club: string;
  shots: number;
  /** Average execution rating. `null` if no rated shots. */
  avgQuality: number | null;
  /** Average yardage (rounded to an integer). `null` if no yardages logged. */
  avgYds: number | null;
  /** Fairways hit / tee shots on par 4-5. `null` if never hit off the tee. */
  fwPct: number | null;
  /** Greens hit / approach shots. `null` if never used as an approach. */
  greenPct: number | null;
  missLPct: number;
  missRPct: number;
  missLongPct: number;
  missShortPct: number;
  bunkerPct: number;
}

interface ClubAcc {
  club: string;
  shots: number;
  execSum: number;
  execCount: number;
  ydSum: number;
  ydCount: number;
  teeShots: number;
  fwHits: number;
  approachShots: number;
  greenHits: number;
  missL: number;
  missR: number;
  missLong: number;
  missShort: number;
  bunkerShots: number;
}

function newAcc(club: string): ClubAcc {
  return {
    club,
    shots: 0,
    execSum: 0,
    execCount: 0,
    ydSum: 0,
    ydCount: 0,
    teeShots: 0,
    fwHits: 0,
    approachShots: 0,
    greenHits: 0,
    missL: 0,
    missR: 0,
    missLong: 0,
    missShort: 0,
    bunkerShots: 0,
  };
}

/** Compute per-club stats from raw shot rows. */
export function computeClubSummary(shots: readonly ShotRow[]): ClubSummaryRow[] {
  const clubs = new Map<string, ClubAcc>();

  for (const row of shots) {
    const club = row.club;
    if (!club || !row.shot_no) continue;
    if (club === "Putter") continue; // handled in the distance summary

    let c = clubs.get(club);
    if (!c) {
      c = newAcc(club);
      clubs.set(club, c);
    }

    c.shots++;

    const exec = row.execution;
    if (typeof exec === "number" && exec > 0) {
      c.execSum += exec;
      c.execCount++;
    }

    const yd = row.yardage;
    if (typeof yd === "number" && yd > 0) {
      c.ydSum += yd;
      c.ydCount++;
    }

    if (row.shot_no === 1 && row.par !== 3) {
      // tee shot on a par 4/5
      c.teeShots++;
      if (row.result === "Fairway") c.fwHits++;
    } else {
      // approach (includes par-3 tee shots)
      c.approachShots++;
      if (row.result === "Green") c.greenHits++;
    }

    switch (row.miss_direction) {
      case "Left":
        c.missL++;
        break;
      case "Right":
        c.missR++;
        break;
      case "Long":
        c.missLong++;
        break;
      case "Short":
        c.missShort++;
        break;
    }

    if (row.result === "Bunker") c.bunkerShots++;
  }

  const sorted = Array.from(clubs.values()).sort((a, b) => {
    const ai = CLUBS.indexOf(a.club as (typeof CLUBS)[number]);
    const bi = CLUBS.indexOf(b.club as (typeof CLUBS)[number]);
    if (ai === -1 && bi === -1) return a.club.localeCompare(b.club);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return sorted.map((c) => ({
    club: c.club,
    shots: c.shots,
    avgQuality: c.execCount > 0 ? r2(c.execSum / c.execCount) : null,
    avgYds: c.ydCount > 0 ? Math.round(c.ydSum / c.ydCount) : null,
    fwPct: c.teeShots > 0 ? c.fwHits / c.teeShots : null,
    greenPct: c.approachShots > 0 ? c.greenHits / c.approachShots : null,
    missLPct: c.shots > 0 ? c.missL / c.shots : 0,
    missRPct: c.shots > 0 ? c.missR / c.shots : 0,
    missLongPct: c.shots > 0 ? c.missLong / c.shots : 0,
    missShortPct: c.shots > 0 ? c.missShort / c.shots : 0,
    bunkerPct: c.shots > 0 ? c.bunkerShots / c.shots : 0,
  }));
}
