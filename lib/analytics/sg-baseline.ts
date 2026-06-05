/**
 * Strokes-gained baseline: expected strokes to hole out from a lie + distance.
 *
 * These are Mark Broadie's published **PGA Tour** benchmark values (ShotLink
 * 2004–2012, from "Assessing Golfer Performance on the PGA Tour" / "Every Shot
 * Counts"). SG computed against this table reads as "vs Tour average" — a real,
 * citable, correctly-cross-calibrated reference. A scratch/amateur reads
 * negative against it, which is honest; the category leak ranking is the point.
 * Source: Broadie, columbia.edu/~mnb2/broadie.
 *
 * Non-green lies are keyed by YARDS; the Green (putting) table is keyed by FEET.
 * `expectedStrokes` takes yards and converts for putts.
 */

import type { StartLie } from "@/lib/constants";

type Table = Record<number, number>;

const TABLES: Record<"Tee" | "Fairway" | "Rough" | "Sand" | "Recovery" | "Green", Table> = {
  // Par 4/5 tee shots (yards). 400 yd ≈ 3.99 (a 400-yd hole averages ~4.0).
  Tee: {
    100: 2.92, 120: 2.99, 140: 2.97, 160: 2.99, 180: 3.05, 200: 3.12, 220: 3.17,
    240: 3.25, 260: 3.45, 280: 3.65, 300: 3.71, 320: 3.79, 340: 3.86, 360: 3.92,
    380: 3.96, 400: 3.99, 420: 4.02, 440: 4.08, 460: 4.13, 480: 4.19, 500: 4.25,
    540: 4.34, 580: 4.43, 620: 4.5,
  },
  // Fairway / first cut / fringe (yards). 150 ≈ 2.95, 100 = 2.80.
  Fairway: {
    10: 2.18, 20: 2.4, 30: 2.52, 40: 2.6, 60: 2.7, 80: 2.75, 100: 2.8, 120: 2.85,
    140: 2.91, 160: 2.98, 180: 3.08, 200: 3.19, 220: 3.32, 240: 3.45, 260: 3.58,
    280: 3.69, 300: 3.78,
  },
  // Rough (yards). 100 = 3.02.
  Rough: {
    10: 2.34, 20: 2.59, 30: 2.7, 40: 2.78, 60: 2.91, 80: 2.96, 100: 3.02, 120: 3.08,
    140: 3.15, 160: 3.23, 180: 3.31, 200: 3.42, 220: 3.53, 240: 3.64, 260: 3.74,
    280: 3.83, 300: 3.9,
  },
  // Bunkers / sand (yards). Crosses rough: worse than rough under ~15 / over ~34 yd.
  Sand: {
    10: 2.43, 20: 2.53, 30: 2.66, 40: 2.82, 60: 3.15, 80: 3.21, 100: 3.23, 120: 3.24,
    140: 3.27, 160: 3.31, 180: 3.39, 200: 3.47, 220: 3.56, 240: 3.66,
  },
  // Recovery / trees / native (yards) — roughly flat, then rising.
  Recovery: {
    100: 3.8, 150: 3.81, 200: 3.87, 250: 3.97, 300: 4.15,
  },
  // Putting (FEET). 8 ft = 1.50, 20 ft = 1.87.
  Green: {
    1: 1.0, 2: 1.01, 3: 1.04, 4: 1.13, 5: 1.23, 6: 1.34, 7: 1.42, 8: 1.5, 9: 1.56,
    10: 1.61, 12: 1.7, 15: 1.78, 20: 1.87, 25: 1.94, 30: 2.0, 40: 2.09, 50: 2.18,
    60: 2.25, 70: 2.32, 80: 2.38, 90: 2.44,
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
