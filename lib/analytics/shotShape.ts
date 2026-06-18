/**
 * Shot-shape & contact tendencies by club category.
 *
 * The payoff for the shape/contact capture (migration 016): instead of a flat
 * per-club frequency, roll clubs into five categories and surface, per category,
 * the distribution of ball-flight shapes and strike faults — plus the read that
 * actually changes course strategy: a *one-way* vs *two-way* miss.
 *
 * Rates are over TAGGED shots only (a blank shape ≠ a flush shot — the entry
 * step is skippable), so every row carries its own shape/contact `n`. Cuts below
 * the club sample threshold render as an "early read" and never prescribe
 * (gates.ts), exactly like the rest of the engine.
 *
 * Layer rules (D-05): plain typed `ShotRow[]` in, plain data out. Zero Supabase
 * imports, independently testable.
 */

import { SHOT_SHAPES, SHOT_CONTACTS, type ShotShape, type ShotContact } from "@/lib/constants";
import { tierFor, type SampleTier } from "@/lib/analytics/gates";
import type { ShotRow } from "@/lib/schemas/shot";

/** Club buckets, in display order. Putter is excluded (no shape on a putt). */
export const CLUB_CATEGORIES = [
  "Driver",
  "Woods",
  "Long iron",
  "Short iron",
  "Wedge",
] as const;
export type ClubCategory = (typeof CLUB_CATEGORIES)[number];

/**
 * Map a bag club string to its category. Pattern-based so it survives bag edits:
 *   - D / Driver                          → Driver
 *   - <n>W (3W, 5W, …)                    → Woods
 *   - <n>i, n ≤ 6 (3i–6i)                 → Long iron
 *   - <n>i, n ≥ 7 (7i–9i) and PW, GW      → Short iron
 *   - SW, LW, and lofted wedges (e.g. 56) → Wedge
 * Returns null for the Putter or anything unrecognised (excluded from the matrix).
 */
export function clubCategory(club: string): ClubCategory | null {
  const c = club.trim();
  if (c === "D" || c.toLowerCase() === "driver") return "Driver";
  if (c === "Putter" || c.toLowerCase() === "putter") return null;

  // Numbered woods: 3W, 5W, 7W…
  if (/^\d+W$/i.test(c)) return "Woods";

  // Named wedges.
  if (c === "PW") return "Short iron";
  if (c === "GW" || c === "AW") return "Short iron";
  if (c === "SW" || c === "LW") return "Wedge";

  // Numbered irons: 3i…9i.
  const iron = /^(\d+)i$/i.exec(c);
  if (iron) {
    const n = Number(iron[1]);
    return n <= 6 ? "Long iron" : "Short iron";
  }

  // Bare lofted wedges (50–64°).
  const loft = /^(\d{2})$/.exec(c);
  if (loft && Number(loft[1]) >= 48) return "Wedge";

  return null;
}

/** Curve side a shape resolves to (Straight is center → neither). */
const SHAPE_SIDE: Record<ShotShape, "Left" | "Right" | null> = {
  Hook: "Left",
  Draw: "Left",
  Straight: null,
  Fade: "Right",
  Slice: "Right",
};

/**
 * A category is judged "one-way" when its tagged curves lean hard to one side:
 * the heavy side is ≥ 55% of curved (non-straight) shots and the light side is
 * ≤ 20%. Otherwise it's a two-way (or straight-dominant) miss → null.
 */
const ONE_WAY_HEAVY = 0.55;
const ONE_WAY_LIGHT = 0.2;

export interface ShotShapeRow {
  category: ClubCategory;
  /** Total non-putter full shots played with clubs in this category. */
  shots: number;
  /** Shots with a shape tagged (the denominator for shape rates). */
  shapeN: number;
  /** Shots with a contact fault tagged (the denominator for contact rates). */
  contactN: number;
  /** Raw count per shape. */
  shape: Record<ShotShape, number>;
  /** Share of tagged shots per shape (null when shapeN = 0). */
  shapePct: Record<ShotShape, number | null>;
  /** Raw count per contact fault. */
  contact: Record<ShotContact, number>;
  /** Share of contact-tagged shots per fault (null when contactN = 0). */
  contactPct: Record<ShotContact, number | null>;
  /** Curve-left share (Draw + Hook) over shapeN; null when shapeN = 0. */
  curveLeftPct: number | null;
  /** Curve-right share (Fade + Slice) over shapeN; null when shapeN = 0. */
  curveRightPct: number | null;
  /** Straight share over shapeN; null when shapeN = 0. */
  straightPct: number | null;
  /** "Left" / "Right" when the miss is one-way; null when two-way / insufficient. */
  oneWayMiss: "Left" | "Right" | null;
  /** Sample tier on the shape `n` (club threshold). `early` below 15. */
  tier: SampleTier;
}

interface Acc {
  shots: number;
  shapeN: number;
  contactN: number;
  shape: Record<ShotShape, number>;
  contact: Record<ShotContact, number>;
}

function newAcc(): Acc {
  return {
    shots: 0,
    shapeN: 0,
    contactN: 0,
    shape: Object.fromEntries(SHOT_SHAPES.map((s) => [s, 0])) as Record<ShotShape, number>,
    contact: Object.fromEntries(SHOT_CONTACTS.map((c) => [c, 0])) as Record<ShotContact, number>,
  };
}

/**
 * Compute per-category shape/contact tendencies. Returns one row per category
 * that has at least one shot, in canonical category order.
 */
export function computeShotShapeSummary(shots: readonly ShotRow[]): ShotShapeRow[] {
  const cats = new Map<ClubCategory, Acc>();

  for (const row of shots) {
    if (!row.club || !row.shot_no) continue;
    const cat = clubCategory(row.club);
    if (cat === null) continue;

    let a = cats.get(cat);
    if (!a) {
      a = newAcc();
      cats.set(cat, a);
    }
    a.shots++;

    if (row.shot_shape != null) {
      a.shapeN++;
      a.shape[row.shot_shape]++;
    }
    if (row.shot_contact != null) {
      a.contactN++;
      a.contact[row.shot_contact]++;
    }
  }

  const rows: ShotShapeRow[] = [];
  for (const category of CLUB_CATEGORIES) {
    const a = cats.get(category);
    if (!a) continue;

    const pctOf = (n: number, d: number): number | null => (d > 0 ? n / d : null);
    const shapePct = Object.fromEntries(
      SHOT_SHAPES.map((s) => [s, pctOf(a.shape[s], a.shapeN)]),
    ) as Record<ShotShape, number | null>;
    const contactPct = Object.fromEntries(
      SHOT_CONTACTS.map((c) => [c, pctOf(a.contact[c], a.contactN)]),
    ) as Record<ShotContact, number | null>;

    const left = a.shape.Draw + a.shape.Hook;
    const right = a.shape.Fade + a.shape.Slice;
    const curved = left + right;
    const curveLeftPct = pctOf(left, a.shapeN);
    const curveRightPct = pctOf(right, a.shapeN);

    // One-way read is over *curved* shots (straight pulls neither way).
    let oneWayMiss: "Left" | "Right" | null = null;
    if (curved > 0) {
      const lShare = left / curved;
      const rShare = right / curved;
      if (lShare >= ONE_WAY_HEAVY && rShare <= ONE_WAY_LIGHT) oneWayMiss = "Left";
      else if (rShare >= ONE_WAY_HEAVY && lShare <= ONE_WAY_LIGHT) oneWayMiss = "Right";
    }

    rows.push({
      category,
      shots: a.shots,
      shapeN: a.shapeN,
      contactN: a.contactN,
      shape: a.shape,
      shapePct,
      contact: a.contact,
      contactPct,
      curveLeftPct,
      curveRightPct,
      straightPct: pctOf(a.shape.Straight, a.shapeN),
      oneWayMiss,
      tier: tierFor("club", a.shapeN),
    });
  }

  return rows;
}

// Re-export so display code maps cells without re-importing constants.
export { SHAPE_SIDE };
