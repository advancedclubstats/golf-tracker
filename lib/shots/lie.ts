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
}

/**
 * The default start lie for the next shot given the previous shot's finish.
 * Returns null when it can't be inferred (penalty drop, untagged finish) — the
 * caller should fall back to a safe default and let the player set it.
 *
 * Bunker defaults to greenside (the common case); a long fairway bunker is one
 * tap to override. (The backfill SQL refines this by distance, but distance
 * isn't known yet when the chip is shown.)
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
      return "Greenside bunker";
    case "Recovery":
      return "Recovery";
    // Penalty drops (OB / Hazard / Lost / Unplayable) and an untagged finish
    // (null) leave the next lie unknown — caller falls back / prompts.
    default:
      return null;
  }
}
