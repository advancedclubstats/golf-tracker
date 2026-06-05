/**
 * Strokes-gained baseline: expected strokes to hole out from a given lie and
 * distance, for a ~scratch golfer.
 *
 * These are Broadie-shaped (from "Every Shot Counts") and leveled to roughly a
 * scratch (0-handicap) player — deliberately NOT the PGA Tour table, which
 * would make a scratch player look perpetually negative. Absolute SG magnitudes
 * are approximate; the per-category *shapes* are what make the cross-category
 * leak ranking valid (lose-most-on-approach vs putting vs driving). Swap the
 * tables to recalibrate without touching the SG logic.
 *
 * Non-green lies are keyed by YARDS; the Green (putting) table is keyed by FEET.
 * `expectedStrokes` takes a distance in yards and converts for putts.
 */

import type { StartLie } from "@/lib/constants";

type Table = Record<number, number>;

const TABLES: Record<"Tee" | "Fairway" | "Rough" | "Sand" | "Recovery" | "Green", Table> = {
  // Par 4/5 tee shots (yards).
  Tee: {
    120: 3.1, 150: 3.2, 180: 3.3, 200: 3.4, 220: 3.5, 240: 3.62, 260: 3.74,
    280: 3.86, 300: 3.95, 320: 4.05, 340: 4.13, 360: 4.2, 380: 4.27, 400: 4.33,
    420: 4.4, 440: 4.47, 460: 4.55, 480: 4.62, 500: 4.68, 540: 4.8, 580: 4.9, 620: 5.0,
  },
  // Fairway / first cut / fringe (yards).
  Fairway: {
    10: 2.3, 20: 2.5, 30: 2.58, 40: 2.66, 50: 2.72, 60: 2.78, 75: 2.85, 90: 2.9,
    100: 2.94, 120: 3.0, 140: 3.08, 160: 3.18, 175: 3.25, 200: 3.4, 225: 3.55,
    250: 3.7, 275: 3.83, 300: 3.95,
  },
  // Rough (yards).
  Rough: {
    10: 2.5, 20: 2.7, 30: 2.8, 40: 2.88, 50: 2.95, 60: 3.02, 75: 3.1, 90: 3.16,
    100: 3.2, 120: 3.3, 140: 3.4, 160: 3.52, 175: 3.6, 200: 3.75, 225: 3.9,
    250: 4.05, 275: 4.18, 300: 4.3,
  },
  // Bunkers / sand (yards).
  Sand: {
    10: 2.6, 20: 2.8, 30: 2.95, 40: 3.05, 50: 3.12, 60: 3.2, 75: 3.3, 90: 3.38,
    100: 3.43, 120: 3.5, 140: 3.6, 160: 3.72, 180: 3.85, 200: 3.98, 225: 4.12, 250: 4.28,
  },
  // Recovery / trees / native (yards).
  Recovery: {
    20: 3.6, 50: 3.7, 75: 3.8, 100: 3.85, 130: 3.95, 160: 4.05, 200: 4.2,
    250: 4.4, 300: 4.6,
  },
  // Putting (FEET).
  Green: {
    1: 1.0, 2: 1.03, 3: 1.07, 4: 1.18, 5: 1.3, 6: 1.42, 7: 1.5, 8: 1.57, 9: 1.62,
    10: 1.67, 12: 1.74, 15: 1.83, 20: 1.93, 25: 2.0, 30: 2.07, 40: 2.19, 50: 2.29,
    60: 2.37, 70: 2.45, 80: 2.52, 90: 2.58,
  },
};

type TableKey = keyof typeof TABLES;

/** Map a stored start lie onto its baseline table. Null = no baseline. */
function tableFor(lie: StartLie | null): TableKey | null {
  switch (lie) {
    case "Tee":
      return "Tee";
    case "Fairway":
    case "First cut":
    case "Fringe":
      return "Fairway";
    case "Rough":
      return "Rough";
    case "Native":
    case "Recovery":
      return "Recovery";
    case "Fairway bunker":
    case "Greenside bunker":
    case "Sand":
      return "Sand";
    case "Green":
      return "Green";
    default:
      return null;
  }
}

/** Piecewise-linear interpolation over a sorted distance→strokes table. */
function interpolate(table: Table, dist: number): number {
  const keys = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  if (dist <= keys[0]) return table[keys[0]];
  if (dist >= keys[keys.length - 1]) return table[keys[keys.length - 1]];
  for (let i = 0; i < keys.length - 1; i++) {
    if (dist >= keys[i] && dist <= keys[i + 1]) {
      const f = (dist - keys[i]) / (keys[i + 1] - keys[i]);
      return table[keys[i]] + f * (table[keys[i + 1]] - table[keys[i]]);
    }
  }
  return table[keys[keys.length - 1]];
}

/**
 * Expected strokes to hole out from `lie` at `yards` (the stored, yards-based
 * distance; converted to feet for putts). Returns null when the lie has no
 * baseline (e.g. an unknown/penalty-drop lie) or the distance is missing.
 */
export function expectedStrokes(
  lie: StartLie | null,
  yards: number | null,
): number | null {
  const key = tableFor(lie);
  if (key === null || yards == null) return null;
  const dist = key === "Green" ? yards * 3 : yards; // green table is in feet
  return interpolate(TABLES[key], dist);
}
