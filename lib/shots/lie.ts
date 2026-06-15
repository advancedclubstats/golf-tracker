/**
 * Client-side carry-forward for the shot chain: the start lie of shot N defaults
 * to the finish of shot N-1. Mirrors the `recompute_hole_start_lie` SQL function
 * (migration 007/008) so the entry form can pre-fill the lie chip, one tap to
 * override. The DB stays the source of truth for stored/recomputed lies.
 */

import type { Result, StartLie, Obstruction } from "@/lib/constants";

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

/**
 * Obstruction carry-forward (orthogonal to the surface carry above). The
 * obstruction tagged on a shot's *finish* (the resting position) becomes the
 * *start* obstruction of the next shot on the hole — this propagation is the
 * whole mechanism and must never be discarded on commit.
 *
 * The next shot's own obstruction *control* then defaults back to Clear (you've
 * usually extricated): "reset to Clear" refers to that control default, NOT to
 * this propagation. So drive into rough behind a tree → tag the finish Blocked →
 * the next shot starts `obstruction: "Blocked"`, and its control shows Clear
 * until you tag it again.
 */
export function nextStartObstruction(
  finishObstruction: Obstruction | null | undefined,
): Obstruction {
  return finishObstruction ?? "Clear";
}
