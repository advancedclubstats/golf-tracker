/**
 * Zod schemas for the `shots` table.
 *
 * These are the single source of truth for shot field constraints (hard rule).
 * Never redefine shot validation inline in a component or server action.
 *
 * ShotInsert   — shape required to create a shot (sent to the DB).
 * ShotRow      — shape returned from the DB (includes generated fields).
 */

import { z } from "zod";
import {
  RESULTS,
  MISS_DIRECTIONS,
  PUTT_SIDES,
  PUTT_LENGTHS,
  START_LIES,
  SITUATIONS,
  DISTANCE_UNITS,
} from "@/lib/constants";
import { uuidString } from "@/lib/schemas/common";
import { ClubNameSchema } from "@/lib/schemas/club";

// ─── Insert ───────────────────────────────────────────────────────────────────

export const ShotInsertSchema = z.object({
  /** UUID of the round this shot belongs to. */
  round_id: uuidString,

  /** Hole number (1–18). */
  hole: z.number().int().min(1).max(18),

  /**
   * Par for this hole. Must match all other shots on the same (round_id, hole)
   * pair — the DB trigger will reject a mismatch (D-09).
   */
  par: z.number().int().refine((v) => [3, 4, 5].includes(v), {
    message: "Par must be 3, 4, or 5",
  }),

  /** Shot number within the hole. 1 = tee shot. */
  shot_no: z.number().int().min(1),

  /**
   * Club used. A free string (not a closed enum) so the bag is user-editable
   * via the Setup page (`clubs` table). No FK to `clubs` — removing a club from
   * the bag leaves logged shots and analytics untouched. The entry/edit UI only
   * offers clubs from the current bag, so values stay clean in practice.
   */
  club: ClubNameSchema,

  /**
   * Distance to the hole before this shot, stored canonically in YARDS (putts
   * too: 1 yd = 3 ft). Skippable — SG just can't be computed for a shot (and
   * its predecessor's leave) without it. See `distance_unit` for display.
   */
  yardage: z.number().min(0).nullish(),

  /**
   * Display/entry unit for `yardage`. `ft` (putts / on the green) means show as
   * yardage×3; `yd` otherwise. `yardage` is always stored in yards regardless,
   * so legacy analytics are untouched.
   */
  distance_unit: z.enum(DISTANCE_UNITS).nullish(),

  /**
   * Where this shot starts from. Carries forward from the prior shot's finish
   * (one tap to override). The single highest-value SG add. Null on historical
   * shots the chain couldn't recover (penalty drops, untagged sequences).
   */
  start_lie: z.enum(START_LIES).nullish(),

  /**
   * The "domino" field: did this shot improve or compound the position?
   * One tap, default Neutral. Captured going forward only.
   */
  situation_created: z.enum(SITUATIONS).nullish(),

  /**
   * Short-sided flag for greenside / missed-approach context. Captured going
   * forward only.
   */
  short_sided: z.boolean().nullish(),

  /**
   * Shot quality: 1 = bad, 2 = okay, 3 = good, 4 = excellent.
   * Optional: some imported sheet rows have a blank execution, and the
   * analytics treat a missing rating as "unrated" (skipped). The shot-entry UI
   * still requires it for newly entered shots.
   */
  execution: z.number().int().min(1).max(4).nullish(),

  /** Where the ball ended up. Blank is allowed for backward compatibility. */
  result: z.enum(RESULTS).nullish(),

  /** Miss direction. Only populated when result implies a miss. */
  miss_direction: z.enum(MISS_DIRECTIONS).nullish(),

  /**
   * Putt side miss. Only for Putter shots; only when miss is material
   * (outside ~3-foot gimme circle).
   */
  putt_side: z.enum(PUTT_SIDES).nullish(),

  /**
   * Putt length miss. Only for Putter shots; only when miss is material.
   */
  putt_length: z.enum(PUTT_LENGTHS).nullish(),

  /** "I'd materially redo this shot." Retrospective, player-judged. */
  mulligan: z.boolean().default(false),

  /**
   * Penalty strokes incurred on this shot (typically 0 or 1).
   * Stored on the offending shot — drops do not get their own row.
   */
  penalty: z.number().int().min(0).default(0),

  /** Optional free-text note on this shot. */
  notes: z.string().max(500).nullish(),
});

export type ShotInsert = z.infer<typeof ShotInsertSchema>;

// ─── Row (returned from DB) ───────────────────────────────────────────────────

export const ShotRowSchema = ShotInsertSchema.extend({
  id: uuidString,
  user_id: uuidString,
  // Fields with DB defaults come back as concrete types, not optional.
  mulligan: z.boolean(),
  penalty: z.number().int().min(0),
  // Nullable fields come back as their type | null from Postgres.
  execution: z.number().int().min(1).max(4).nullable(),
  yardage: z.number().nullable(),
  distance_unit: z.enum(DISTANCE_UNITS).nullable(),
  start_lie: z.enum(START_LIES).nullable(),
  situation_created: z.enum(SITUATIONS).nullable(),
  short_sided: z.boolean().nullable(),
  result: z.enum(RESULTS).nullable(),
  miss_direction: z.enum(MISS_DIRECTIONS).nullable(),
  putt_side: z.enum(PUTT_SIDES).nullable(),
  putt_length: z.enum(PUTT_LENGTHS).nullable(),
  notes: z.string().nullable(),
  /** True if this shot marks the hole as picked up / conceded. */
  conceded: z.boolean().optional(),
  created_at: z.string(),
});

export type ShotRow = z.infer<typeof ShotRowSchema>;

// ─── Update (editable fields only) ────────────────────────────────────────────
// Structural fields (round_id, hole, par, shot_no) are NOT editable per-shot:
// par is hole-level (D-09 trigger), and shot_no is managed by the renumber
// logic on delete. Only the descriptive fields can be edited.

export const ShotUpdateSchema = ShotInsertSchema.pick({
  club: true,
  yardage: true,
  distance_unit: true,
  start_lie: true,
  situation_created: true,
  short_sided: true,
  execution: true,
  result: true,
  miss_direction: true,
  putt_side: true,
  putt_length: true,
  mulligan: true,
  penalty: true,
});

export type ShotUpdate = z.infer<typeof ShotUpdateSchema>;
