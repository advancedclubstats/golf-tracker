/**
 * Client-side carry-forward for the shot chain: the start lie of shot N defaults
 * to the finish of shot N-1. Mirrors the `recompute_hole_start_lie` SQL function
 * (migration 007/008) so the entry form can pre-fill the lie chip, one tap to
 * override. The DB stays the source of truth for stored/recomputed lies.
 */

import type { Result, StartLie } from "@/lib/constants";

export interface PrevFinish {
  result: Result | null;
  club: string;
  yardage: number | null;
  /** The lie this shot was played *from* — used to replay stroke-and-distance
   *  penalties (OB / Lost), where you re-hit from the same spot. */
  startLie?: StartLie | null;
}

/**
 * The default start lie for the next shot given the previous shot's finish.
 * Returns null when it can't be inferred (drop of unknown lie, untagged
 * finish) — the caller should fall back to a safe default and let the player
 * set it.
 *
 * Bunker is a single lie (no greenside/fairway split — SG prices them the same).
 */
export function nextStartLie(prev: PrevFinish | null): StartLie | null {
  if (!prev) return "Tee"; // shot 1
  if (prev.result === "Make") return null; // hole done — no next shot
  if (prev.club === "Putter") return "Green"; // still on the green after a putt
  switch (prev.result) {
    case "Fairway":
      return "Fairway";
    case "Green":
      return "Green";
    case "Fringe":
      return "Fringe";
    case "Rough":
      return "Rough";
    case "Bunker":
      return "Bunker";
    case "Recovery":
      return "Recovery";
    // Stroke-and-distance: you replay from where you just hit, so the next
    // shot's lie is this shot's own start lie (a re-tee stays on the Tee).
    case "OB":
    case "Lost":
      return prev.startLie ?? null;
    // Hazard / Unplayable get a drop of an ambiguous lie, and an untagged
    // finish (null) is unknown — caller falls back / prompts.
    default:
      return null;
  }
}
