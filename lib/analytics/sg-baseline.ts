/**
 * Strokes-gained baseline: expected strokes to hole out from a lie + distance.
 *
 * ── The target (spec 2A) ──────────────────────────────────────────────────────
 * SG is computed against the **scratch (0-handicap) golfer** baseline, NOT the
 * PGA Tour. This makes the absolute number meaningful: 0 = you played that shot
 * like a scratch golfer; negative = below that standard. It also removes the
 * tour-table distortion that flatters putting and exaggerates approach (tour
 * players separate from amateurs most in the long game, least on the greens),
 * so the category ranking is cleaner. The scratch baseline IS the target line
 * shown throughout the UI (spec Part 3).
 *
 * ── Provenance ────────────────────────────────────────────────────────────────
 * Values are Mark Broadie's published scratch/0-handicap benchmark
 * ("Every Shot Counts"; columbia.edu/~mnb2/broadie). Notes per table:
 *   - Green (putting): unchanged from the prior table — Broadie's putting
 *     benchmark is materially the same for tour and scratch, and these cells
 *     already match the spec's scratch make-rate anchors (6ft≈67%, 10ft≈40%,
 *     15ft≈25%, 20ft≈15%, 3-putt≈3%). Verified against spec Part 3.
 *   - Tee / Fairway / Rough / Sand / Recovery: shifted UP from the tour table to
 *     the scratch level (separation grows with distance). VERIFY against source
 *     — these long-game magnitudes are the cells to sanity-check before the
 *     absolute numbers are leaned on; the category ranking is robust either way.
 *
 * ── Architecture (spec 2A requirement; seam for 2B / T10) ────────────────────
 * The baseline is a single swappable function `expectedStrokes(lie, distance)`
 * behind the `Baseline` interface. `activeBaseline` is the one the app uses.
 * T10's self-baseline blend ships by adding a blending `Baseline` implementation
 * and pointing `activeBaseline` at it — no caller changes.
 *
 * Non-green lies are keyed by YARDS; the Green (putting) table is keyed by FEET.
 * `expectedStrokes` takes yards and converts for putts.
 */

import type { StartLie, Obstruction } from "@/lib/constants";

type Table = Record<number, number>;

/** A pluggable expected-strokes source. Yards in; null when no baseline applies. */
export interface Baseline {
  readonly name: string;
  expectedStrokes(
    lie: StartLie | null,
    yards: number | null,
    obstruction?: Obstruction | null,
  ): number | null;
}

const TABLES: Record<"Tee" | "Fairway" | "Rough" | "Sand" | "Recovery" | "Green", Table> = {
  // Par 4/5 tee shots (yards), scratch. A scratch golfer averages ~par+0.1 on a
  // mid-length hole; the gap to tour widens with length.
  Tee: {
    100: 2.95, 120: 3.02, 140: 3.04, 160: 3.08, 180: 3.16, 200: 3.25, 220: 3.32,
    240: 3.42, 260: 3.62, 280: 3.80, 300: 3.88, 320: 3.97, 340: 4.05, 360: 4.12,
    380: 4.17, 400: 4.21, 420: 4.25, 440: 4.32, 460: 4.38, 480: 4.45, 500: 4.52,
    540: 4.63, 580: 4.74, 620: 4.83,
  },
  // Fairway / first cut / fringe (yards), scratch.
  Fairway: {
    10: 2.20, 20: 2.42, 30: 2.55, 40: 2.63, 60: 2.74, 80: 2.80, 100: 2.86, 120: 2.92,
    140: 2.99, 160: 3.07, 180: 3.18, 200: 3.30, 220: 3.44, 240: 3.58, 260: 3.71,
    280: 3.83, 300: 3.92,
  },
  // Rough (yards), scratch.
  Rough: {
    10: 2.38, 20: 2.63, 30: 2.74, 40: 2.83, 60: 2.97, 80: 3.03, 100: 3.10, 120: 3.17,
    140: 3.25, 160: 3.34, 180: 3.43, 200: 3.55, 220: 3.67, 240: 3.79, 260: 3.90,
    280: 3.99, 300: 4.06,
  },
  // Bunkers / sand (yards), scratch.
  Sand: {
    10: 2.48, 20: 2.59, 30: 2.73, 40: 2.90, 60: 3.24, 80: 3.31, 100: 3.34, 120: 3.36,
    140: 3.40, 160: 3.45, 180: 3.54, 200: 3.63, 220: 3.73, 240: 3.84,
  },
  // Recovery / trees / native (yards), scratch — roughly flat, then rising.
  Recovery: {
    100: 3.88, 150: 3.90, 200: 3.97, 250: 4.08, 300: 4.27,
  },
  // Putting (FEET), scratch — unchanged; matches the spec's scratch anchors.
  // 6 ft = 1.34 (≈67% make), 10 ft = 1.61 (≈40%), 20 ft = 1.87 (≈15%).
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
 * Broadie scratch/0-handicap baseline (the default). Expected strokes to hole
 * out from `lie` at `yards` (stored, yards-based; converted to feet for putts).
 * Returns null when the lie has no baseline (unknown/penalty-drop lie) or the
 * distance is missing.
 */
export const broadieScratchBaseline: Baseline = {
  name: "broadie-scratch",
  expectedStrokes(lie, yards, obstruction) {
    // Obstruction mapping (keeps every current SG number stable): a non-Clear
    // obstruction prices the shot off the Recovery table regardless of surface
    // — this is what the legacy `Recovery` lie did. Partial and Blocked both map
    // to Recovery for now; stored distinctly so they can diverge later.
    const key =
      obstruction != null && obstruction !== "Clear" ? "Recovery" : tableFor(lie);
    if (key === null || yards == null) return null;
    const dist = key === "Green" ? yards * 3 : yards; // green table is in feet
    return interpolate(TABLES[key], dist);
  },
};

/**
 * The baseline the app currently computes against. Swap this (e.g. to a 2B
 * self-baseline blend) in one place — every caller goes through `expectedStrokes`.
 */
export const activeBaseline: Baseline = broadieScratchBaseline;

/**
 * Expected strokes to hole out from `lie` at `yards`, via the active baseline.
 * Public API: callers (sg.ts, target lines) use this and never touch a table.
 */
export function expectedStrokes(
  lie: StartLie | null,
  yards: number | null,
  obstruction?: Obstruction | null,
): number | null {
  return activeBaseline.expectedStrokes(lie, yards, obstruction);
}
