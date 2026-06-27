/**
 * First-domino root-cause read (DL-016).
 *
 * SG blames each shot on its hole independently, but a blow-up hole is a
 * cascade: one swing puts you behind a tree / in a hazard, and every shot after
 * it is a *forced recovery*, not a fresh mistake. This helper surfaces the one
 * shot where the hole turned — the first domino — so the recall view can name it
 * and de-emphasize the recoveries that followed. It is the POSITIONING.md domino
 * metaphor made real.
 *
 * Pure and typed (D-05): it takes a single hole's shots plus that hole's
 * `perShotSG` entries and never reaches for a DB or guesses past a coverage gap.
 *
 *   SG(shot) comes from `perShotSG` (lib/analytics/sg.ts) — already chained.
 *   A "blow-up" is gated below; only those holes surface anything.
 *
 * Honesty rule (mirrors the sample/coverage rules): if any shot on the hole
 * lacks a computable SG, we cannot trust the chain — we return
 * `rootCauseShotNo: null, sgCovered: false` and name nothing.
 */

import { totalPenalties } from "@/lib/analytics/core";
import type { ShotSG, SgCategory } from "@/lib/analytics/sg";
import { perShotSG } from "@/lib/analytics/sg";
import type { ShotRow } from "@/lib/schemas/shot";

/**
 * A shot is the root-cause candidate once its SG drops to/below this. On the
 * Broadie scratch baseline a clean shot sits near 0 and ordinary dispersion
 * lands within roughly ±0.3 of expectation; a half-stroke loss is a genuine
 * error (a penalty, a chunk, a real misjudge) rather than noise. Picking the
 * *first* shot past this line skips a small early leak and lands on the real
 * mistake — exactly the known failure mode of "blame shot 1 by default".
 */
export const ROOT_CAUSE_SG_THRESHOLD = -0.5;

/** Score-side blow-up gate: a hole at or past double bogey. */
export const BLOWUP_VS_PAR = 2;

/**
 * SG-side blow-up gate, measured on *gross* loss — the sum of the hole's
 * negative shots, not the net. Net SG ≈ (expected from the tee − strokes), so a
 * net gate is just the score gate in disguise; gross loss is what's distinct. At
 * −2.0 it catches the hole that *scored* better than its swings deserved (an OB
 * plus a chunk scrambled to a bogey): independent per-shot SG is most misleading
 * exactly there, so it's worth a root-cause read even though the score line is calm.
 */
export const BLOWUP_SG_LOSS = -2.0;

export interface FirstDomino {
  /** Hole number (1–18). */
  hole: number;
  /** The shot the hole turned on, or null when no single domino can be named. */
  rootCauseShotNo: number | null;
  /** SG category of the root-cause shot (null when none). */
  rootCauseCategory: SgCategory | null;
  /** SG of the root-cause shot (null when none). */
  rootCauseSg: number | null;
  /** Shot numbers after the root cause — the forced recoveries to mute. */
  recoveryShotNos: number[];
  /** Total covered SG on the hole (negative = a loss). */
  holeSgTotal: number;
  /** True only when every shot on the hole has a computable SG. */
  sgCovered: boolean;
}

/**
 * Read a single hole. Returns `null` for any hole that is not a genuine blow-up
 * (a routine hole surfaces nothing). For a blow-up with a coverage gap it
 * returns an object with `rootCauseShotNo: null, sgCovered: false` rather than
 * guessing.
 *
 * `holeShots` are all shots for one (round, hole); `sgEntries` are that same
 * hole's `perShotSG().entries`. Both are re-sorted internally, so call order
 * doesn't matter.
 */
export function firstDominoForHole(
  holeShots: readonly ShotRow[],
  sgEntries: readonly ShotSG[],
): FirstDomino | null {
  if (holeShots.length === 0) return null;

  const shots = [...holeShots].sort((a, b) => a.shot_no - b.shot_no);
  const hole = shots[0].hole;
  const par = shots[0].par;
  const lastShotNo = shots[shots.length - 1].shot_no;

  // Only assess a hole that was actually finished (last shot holed out). An
  // unfinished / conceded hole has no real score and usually a missing tail —
  // a root-cause read there would be meaningless.
  const complete = shots[shots.length - 1].result === "Make";
  if (!complete) return null;

  const strokes = lastShotNo + totalPenalties(shots);
  const vsPar = strokes - par;
  const holeSgTotal = sgEntries.reduce((sum, e) => sum + e.sg, 0);
  const grossLoss = sgEntries.reduce((sum, e) => sum + (e.sg < 0 ? e.sg : 0), 0);

  const isBlowup = vsPar >= BLOWUP_VS_PAR || grossLoss <= BLOWUP_SG_LOSS;
  if (!isBlowup) return null;

  // Coverage gate: every shot must have a computable SG, or we name nothing.
  const sgCovered = sgEntries.length === shots.length;
  if (!sgCovered) {
    return {
      hole,
      rootCauseShotNo: null,
      rootCauseCategory: null,
      rootCauseSg: null,
      recoveryShotNos: [],
      holeSgTotal,
      sgCovered: false,
    };
  }

  // The first shot whose SG is materially negative is the root cause; every
  // shot after it is a recovery.
  const ordered = [...sgEntries].sort((a, b) => a.shot.shot_no - b.shot.shot_no);
  const root = ordered.find((e) => e.sg <= ROOT_CAUSE_SG_THRESHOLD);
  if (!root) {
    // A blow-up with no single materially-bad shot (death by small leaks). Be
    // honest: surface the loss but name no domino.
    return {
      hole,
      rootCauseShotNo: null,
      rootCauseCategory: null,
      rootCauseSg: null,
      recoveryShotNos: [],
      holeSgTotal,
      sgCovered: true,
    };
  }

  const rootShotNo = root.shot.shot_no;
  const recoveryShotNos = shots
    .filter((s) => s.shot_no > rootShotNo)
    .map((s) => s.shot_no);

  return {
    hole,
    rootCauseShotNo: rootShotNo,
    rootCauseCategory: root.category,
    rootCauseSg: root.sg,
    recoveryShotNos,
    holeSgTotal,
    sgCovered: true,
  };
}

/** A first-domino read tagged with the round it belongs to. */
export interface RoundHoleFirstDomino extends FirstDomino {
  roundId: string;
}

/**
 * Run the first-domino read across many rounds' shots. Groups by (round, hole),
 * chains SG once via `perShotSG`, and returns one entry per blow-up hole
 * (routine holes are omitted). Worst-first by total SG lost.
 */
export function computeFirstDominoes(
  shots: readonly ShotRow[],
): RoundHoleFirstDomino[] {
  const { entries } = perShotSG(shots);

  const shotsByHole = new Map<string, ShotRow[]>();
  for (const s of shots) {
    const key = `${s.round_id}|${s.hole}`;
    const arr = shotsByHole.get(key);
    if (arr) arr.push(s);
    else shotsByHole.set(key, [s]);
  }

  const sgByHole = new Map<string, ShotSG[]>();
  for (const e of entries) {
    const key = `${e.shot.round_id}|${e.shot.hole}`;
    const arr = sgByHole.get(key);
    if (arr) arr.push(e);
    else sgByHole.set(key, [e]);
  }

  const out: RoundHoleFirstDomino[] = [];
  for (const [key, holeShots] of shotsByHole) {
    const result = firstDominoForHole(holeShots, sgByHole.get(key) ?? []);
    if (result) out.push({ roundId: holeShots[0].round_id, ...result });
  }

  out.sort((a, b) => a.holeSgTotal - b.holeSgTotal);
  return out;
}
