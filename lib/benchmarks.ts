/**
 * PGA Tour benchmark values for the Distance Summary screen (D-11).
 *
 * These let the player compare their own make%, 3-putt%, up-and-down%, and GIR%
 * against "what good looks like" — the kind of context PGA broadcasts overlay.
 *
 * IMPORTANT — representative band averages, not exact figures. Tour data is
 * published per single distance (e.g. make% from exactly 8 ft), but our tables
 * bucket into ranges. Each value below is a representative average for the band,
 * not a precise per-distance number. Source: ShotLink / Mark Broadie, "Every
 * Shot Counts".
 *
 * Keys are the EXACT bucket labels from PUTT_BUCKETS / ATG_BUCKETS /
 * APPROACH_BUCKETS in `lib/constants.ts` — keep them in sync. Values are 0–1
 * floats to match the existing "pct" cell format.
 */

/** Make% (= 1-putt%) by putt bucket. */
export const TOUR_MAKE_PCT: Record<string, number> = {
  "0–3 ft": 0.98,
  "3–6 ft": 0.77,
  "6–10 ft": 0.5,
  "10–20 ft": 0.2,
  "20+ ft": 0.08,
};

/** 3-putt% by putt bucket. */
export const TOUR_THREE_PUTT_PCT: Record<string, number> = {
  "0–3 ft": 0.0,
  "3–6 ft": 0.01,
  "6–10 ft": 0.02,
  "10–20 ft": 0.03,
  "20+ ft": 0.09,
};

/** Up-and-down% by around-the-green bucket. */
export const TOUR_UP_DOWN_PCT: Record<string, number> = {
  "0–10 yds": 0.8,
  "10–30 yds": 0.5,
};

/** GIR% (green-hit%) by approach bucket. */
export const TOUR_GREEN_PCT: Record<string, number> = {
  "30–75 yds": 0.85,
  "75–125 yds": 0.78,
  "125–175 yds": 0.66,
  "175+ yds": 0.5,
};
