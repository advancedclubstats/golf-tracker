/**
 * Typical full-shot yardages per club — the smart-yardage prefill (B3).
 *
 * On the "How far?" step the player has just picked a club; the most useful
 * thing we can offer is a one-tap chip with the distance they *usually* have
 * when they pull that club. "Usually" is the operative word: this is the
 * most-TYPICAL distances, not the raw most-recent ones. We bucket every logged
 * full-shot yardage for the club to the nearest 5 and rank those buckets by how
 * often they occur, so a player's stock number floats to the front and a noisy
 * one-off doesn't.
 *
 * `yardage` is "distance to the hole before the shot", so these read naturally
 * as "you usually have ~165 when you hit 7i". Putts are excluded (no club
 * yardage), as are the rare putter-off-green rows (`distance_unit === "ft"`).
 * Driver/wood tee shots on par 4/5 never reach this step (the wizard skips
 * yardage there), so no special tee handling is needed.
 *
 * Layer rules (D-05): plain typed `ShotRow[]` in, plain data out. No Supabase
 * imports, independently testable.
 */

import type { ShotRow } from "@/lib/schemas/shot";

export interface ClubYardageOptions {
  /** Round each yardage to the nearest this-many yards before counting. */
  bucket?: number;
  /** Max chips to surface per club. */
  max?: number;
}

/**
 * Map of club name → its most-typical distances (yards), most-common first,
 * ties broken toward the longer distance. Clubs with no usable full-shot
 * yardage are absent.
 */
export function computeClubYardages(
  shots: ShotRow[],
  { bucket = 5, max = 3 }: ClubYardageOptions = {},
): Record<string, number[]> {
  // Frequency of each bucketed distance, per club.
  const byClub = new Map<string, Map<number, number>>();
  for (const s of shots) {
    if (s.club === "Putter") continue;
    if (s.distance_unit === "ft") continue; // putter-off-green safety
    if (s.yardage == null || s.yardage <= 0) continue;
    const b = Math.round(s.yardage / bucket) * bucket;
    let counts = byClub.get(s.club);
    if (!counts) {
      counts = new Map();
      byClub.set(s.club, counts);
    }
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }

  const out: Record<string, number[]> = {};
  for (const [club, counts] of byClub) {
    out[club] = [...counts.entries()]
      // Most common first; tie-break toward the longer (stock) distance.
      .sort((a, b) => b[1] - a[1] || b[0] - a[0])
      .slice(0, max)
      .map(([dist]) => dist);
  }
  return out;
}
