/**
 * Sample-size gates (spec 2C).
 *
 * The anti-noise rule: nothing is *prescribed* below threshold. A cut may still
 * be shown for curiosity, visibly marked "early read," but it must never drive a
 * recommendation or "biggest leak." This kills the "Worst Club: 5i (7 shots)"
 * failure mode.
 *
 * Thresholds (spec): clubs n≥15; distance / lie buckets n≥10.
 *
 * Pure and dependency-free. Display code calls `tierFor` to decide whether a cut
 * renders at full weight (eligible to be prescribed) or as a provisional "early
 * read", and `isPrescribable` as the hard gate before any cut becomes advice.
 */

/** What kind of cut a sample count belongs to — sets which threshold applies. */
export type SampleKind = "club" | "bucket";

/** Two visual tiers (spec Part 3). */
export type SampleTier = "stable" | "early";

/** Minimum sample to be eligible for prescription, by cut kind. */
export const SAMPLE_THRESHOLDS: Record<SampleKind, number> = {
  club: 15,
  bucket: 10,
};

/** The tier a cut renders at: `stable` (full weight) or `early` (provisional). */
export function tierFor(kind: SampleKind, n: number): SampleTier {
  return n >= SAMPLE_THRESHOLDS[kind] ? "stable" : "early";
}

/**
 * Hard gate: may this cut be surfaced as a recommendation / "biggest leak"?
 * True only when the sample clears its threshold. Below threshold a cut may
 * display (marked early read) but is never prescriptive.
 */
export function isPrescribable(kind: SampleKind, n: number): boolean {
  return tierFor(kind, n) === "stable";
}
