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

export const RESULTS = [
  "Fairway",
  "Green",
  "Rough",
  "Bunker",
  "OB",
  "Hazard",
  "Lost",
  "Unplayable",
  "Make",
] as const;

export type Result = (typeof RESULTS)[number];

export const MISS_DIRECTIONS = ["Left", "Right", "Long", "Short"] as const;
export type MissDirection = (typeof MISS_DIRECTIONS)[number];

export const PUTT_SIDES = ["High", "Low"] as const;
export type PuttSide = (typeof PUTT_SIDES)[number];

export const PUTT_LENGTHS = ["Short", "Long"] as const;
export type PuttLength = (typeof PUTT_LENGTHS)[number];

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

// ─── Hardcoded v1 user ────────────────────────────────────────────────────────
// Used in server actions when inserting rows. Replace with auth.uid() post-v1.

export const V1_USER_ID = "1b3a0171-726e-4c64-a8e0-f97a717f2851";
