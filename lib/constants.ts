/**
 * Shared constants for the golf tracker.
 * Import from here — never redefine these inline in components or schemas.
 */

// ─── Clubs ────────────────────────────────────────────────────────────────────
// The player's current bag. Adding a club = edit this array + redeploy (D-02).
// Order matches display order in the shot-entry club selector.

export const CLUBS = [
  "D",
  "3W",
  "5W",
  "4i",
  "5i",
  "6i",
  "7i",
  "8i",
  "9i",
  "PW",
  "GW",
  "SW",
  "LW",
  "Putter",
] as const;

export type Club = (typeof CLUBS)[number];

// ─── Session types ────────────────────────────────────────────────────────────
// DB values (stored in Postgres). Display labels are in SESSION_TYPE_LABELS (D-03).

export const SESSION_TYPES = [
  "Full18",
  "Practice9",
  "Practice6",
  "Practice3",
] as const;

export type SessionType = (typeof SESSION_TYPES)[number];

// Map DB value → human-readable label for UI components (D-03).
export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  Full18: "18 Holes",
  Practice9: "Practice 9",
  Practice6: "Practice 6",
  Practice3: "Practice 3",
};

// Number of holes a session covers (used when a round has no course to define
// the selectable hole range).
export const SESSION_HOLE_COUNTS: Record<SessionType, number> = {
  Full18: 18,
  Practice9: 9,
  Practice6: 6,
  Practice3: 3,
};

// ─── Shot field enums ─────────────────────────────────────────────────────────

// Finish zone (where the ball came to rest). `Fringe` and `Recovery` were added
// for the strokes-gained shot chain (Fringe ≠ Green; Recovery = trees/punch-out).
//
// This is the canonical/legacy enum: it KEEPS `Recovery` so historical rows
// still validate and read (rule 3 of the obstruction brief). New shots no longer
// use `Recovery` as a surface — a ball behind a tree is now Rough + obstruction
// Blocked (see OBSTRUCTION). The entry grid offers RESULT_GRID, which omits it.
export const RESULTS = [
  "Fairway",
  "Green",
  "Fringe",
  "Rough",
  "Bunker",
  "Recovery",
  "OB",
  "Hazard",
  "Lost",
  "Unplayable",
  "Make",
] as const;

export type Result = (typeof RESULTS)[number];

/**
 * Finishes offered in the shot-entry result grid, in display order. `Recovery`
 * is intentionally absent — it's decomposed into surface + obstruction:Blocked,
 * so surface and obstruction never both encode the trees. `Make` is the separate
 * full-width "Holed it" CTA, not a grid surface.
 */
export const RESULT_GRID = [
  "Fairway",
  "Green",
  "Fringe",
  "Rough",
  "Bunker",
  "OB",
  "Hazard",
  "Lost",
  "Unplayable",
] as const satisfies readonly Result[];

// ─── Obstruction (orthogonal start-state attribute) ───────────────────────────
// Records whether something was *in the way* of a shot — independent of the
// surface the ball sits on (start_lie). Default 'Clear'; the ~80% case costs
// zero taps. See docs/design/obstruction_capture_brief.md.

export const OBSTRUCTION = ["Clear", "Partial", "Blocked"] as const;
export type Obstruction = (typeof OBSTRUCTION)[number];

/** Default for new shots and historical rows (DB column default). */
export const OBSTRUCTION_DEFAULT: Obstruction = "Clear";

/**
 * UI copy for the three levels (the chosen "short verbs" set). The same words
 * are reused for the pill, the expanded option label, and recap tokens so a
 * tired golfer maps the same real situation to the same answer every time.
 *   Clear   — Normal shot at the target available (default).
 *   Partial — Could still advance, but forced into an abnormal shot (flight it).
 *   Blocked — Couldn't advance to target; had to extricate (chip out).
 */
export const OBSTRUCTION_COPY: Record<Obstruction, { label: string; hint: string }> = {
  Clear: { label: "Clear", hint: "Normal shot at the target" },
  Partial: { label: "Flighted", hint: "Forced into an abnormal shot" },
  Blocked: { label: "Chip out", hint: "Couldn't advance to the target" },
};

export const MISS_DIRECTIONS = ["Left", "Right", "Long", "Short"] as const;
export type MissDirection = (typeof MISS_DIRECTIONS)[number];

// ─── Shot shape & contact (two orthogonal, optional flight attributes) ────────
// Captured going forward on full shots only (never putts). Both optional — a
// golfer often recalls one axis and not the other. See migration 016.

/** Ball-flight curve, ordered left→right by where the ball finishes. */
export const SHOT_SHAPES = ["Slice", "Fade", "Straight", "Draw", "Hook"] as const;
export type ShotShape = (typeof SHOT_SHAPES)[number];

/**
 * Ball start-line — where the shot launched relative to the target line. The
 * "cause" axis that pairs with curve (a pull-cut vs a push-draw). Captured on the
 * dedicated start step. Orthogonal to `shot_shape` (curve) and `shot_contact`.
 */
export const SHOT_STARTS = ["Pull", "Straight", "Push"] as const;
export type ShotStart = (typeof SHOT_STARTS)[number];

/** Strike fault — independent of shape (you can hit a fat pull). In the entry UI
 *  "Clean" is the third option and is stored as a null `shot_contact` (no fault),
 *  so this enum stays the two faults. */
export const SHOT_CONTACTS = ["Thin", "Chunk"] as const;
export type ShotContact = (typeof SHOT_CONTACTS)[number];

/**
 * Where a shot finished relative to the pin/target — the "outcome" direction axis
 * (generalizes `miss_direction`, which only fired on a missed surface). A 3×3
 * pin-relative grid; `Center` = at the target ("at pin" on an approach, "middle"
 * off the tee). Off-the-tee drives only use the lateral subset {Left, Center,
 * Right}. Diagnostic only — does not feed Strokes Gained (magnitude already comes
 * from the next shot's distance). See docs/design/flight_and_target_offset_brief.md.
 */
export const TARGET_OFFSETS = [
  "LongLeft",
  "Long",
  "LongRight",
  "Left",
  "Center",
  "Right",
  "ShortLeft",
  "Short",
  "ShortRight",
] as const;
export type TargetOffset = (typeof TARGET_OFFSETS)[number];

export const PUTT_SIDES = ["High", "Low"] as const;
export type PuttSide = (typeof PUTT_SIDES)[number];

export const PUTT_LENGTHS = ["Short", "Long"] as const;
export type PuttLength = (typeof PUTT_LENGTHS)[number];

// ─── Strokes-gained shot-chain fields (Option A; captured going forward) ──────

/** Where a shot starts from. Carries forward from the prior shot's finish. */
export const START_LIES = [
  "Tee",
  "Fairway",
  "First cut",
  "Rough",
  "Bunker",
  "Recovery",
  "Fringe",
  "Green",
  "Native",
] as const;
export type StartLie = (typeof START_LIES)[number];

/**
 * Decision quality (spec 1A): the one signal SG can't compute. Default Good;
 * flag Bad only for a genuine process error (too much risk / wrong club /
 * wrong line / acted hastily) — not a good play that drew a bad result inside
 * normal dispersion. Splits lost strokes into execution loss (Good → practice)
 * vs decision loss (Bad → thinking).
 */
export const DECISION_QUALITIES = ["Good", "Bad"] as const;
export type DecisionQuality = (typeof DECISION_QUALITIES)[number];

/** The "domino" field: did this shot improve or compound the situation? */
export const SITUATIONS = [
  "Improved",
  "Neutral",
  "Constrained",
  "Severe trouble",
] as const;
export type Situation = (typeof SITUATIONS)[number];

/** Display/entry unit for `distance_to_hole`. `yardage` is always stored in
 *  yards; `ft` means show/enter as yardage×3 (used for putts / on the green). */
export const DISTANCE_UNITS = ["yd", "ft"] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

/** Course-level trouble flanking a hole (entered once in Setup, per side). */
export const HOLE_TROUBLE = [
  "None",
  "Trees",
  "Rough",
  "Bunker",
  "Water",
  "OB",
  "Native",
] as const;
export type HoleTrouble = (typeof HOLE_TROUBLE)[number];

// ─── Analytics bucket definitions ────────────────────────────────────────────
// Boundaries must match golf_stats.gs exactly (D-05).

/** Putt buckets are upper-inclusive: a 6-ft putt falls in "3–6 ft". */
export const PUTT_BUCKETS = [
  { label: "0–3 ft",   minExc: -Infinity, maxInc: 3 },
  { label: "3–6 ft",   minExc: 3,         maxInc: 6 },
  { label: "6–10 ft",  minExc: 6,         maxInc: 10 },
  { label: "10–20 ft", minExc: 10,        maxInc: 20 },
  { label: "20+ ft",   minExc: 20,        maxInc: Infinity },
] as const;

/** Around-the-green buckets are half-open lower: [min, max). */
export const ATG_BUCKETS = [
  { label: "0–10 yds",  min: 0,  max: 10 },
  { label: "10–30 yds", min: 10, max: 30 },
] as const;

/** Approach buckets are half-open lower: [min, max). */
export const APPROACH_BUCKETS = [
  { label: "30–75 yds",   min: 30,  max: 75 },
  { label: "75–125 yds",  min: 75,  max: 125 },
  { label: "125–175 yds", min: 125, max: 175 },
  { label: "175+ yds",    min: 175, max: Infinity },
] as const;

/** Multiply putt yardage by this to convert to feet for bucketing. */
export const PUTT_YD_TO_FT = 3;

// ─── Tee colours ──────────────────────────────────────────────────────────────
// Preset swatches for the course tee picker (the usual golf tee colours).

export const PRESET_TEE_COLORS = [
  { name: "Black", hex: "#000000" },
  { name: "Blue", hex: "#2563eb" },
  { name: "White", hex: "#ffffff" },
  { name: "Red", hex: "#dc2626" },
  { name: "Gold", hex: "#d4af37" },
  { name: "Green", hex: "#16a34a" },
  { name: "Silver", hex: "#9ca3af" },
] as const;

// ─── Hardcoded v1 user ────────────────────────────────────────────────────────
// Used in server actions when inserting rows. Replace with auth.uid() post-v1.

export const V1_USER_ID = "1b3a0171-726e-4c64-a8e0-f97a717f2851";
