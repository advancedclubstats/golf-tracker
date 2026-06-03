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
  CLUBS,
  RESULTS,
  MISS_DIRECTIONS,
  PUTT_SIDES,
  PUTT_LENGTHS,
} from "@/lib/constants";

// ─── Insert ───────────────────────────────────────────────────────────────────

export const ShotInsertSchema = z.object({
  /** UUID of the round this shot belongs to. */
  round_id: z.string().uuid(),

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
   * Club used. Validated here (D-02); no CHECK constraint in the DB.
   * To add a new club: edit CLUBS in lib/constants.ts and redeploy.
   */
  club: z.enum(CLUBS),

  /** Distance to target in yards. Putts entered in yards (1 yd = 3 ft). */
  yardage: z.number().min(0).nullish(),

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
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  // Fields with DB defaults come back as concrete types, not optional.
  mulligan: z.boolean(),
  penalty: z.number().int().min(0),
  // Nullable fields come back as their type | null from Postgres.
  execution: z.number().int().min(1).max(4).nullable(),
  yardage: z.number().nullable(),
  result: z.enum(RESULTS).nullable(),
  miss_direction: z.enum(MISS_DIRECTIONS).nullable(),
  putt_side: z.enum(PUTT_SIDES).nullable(),
  putt_length: z.enum(PUTT_LENGTHS).nullable(),
  notes: z.string().nullable(),
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
  execution: true,
  result: true,
  miss_direction: true,
  putt_side: true,
  putt_length: true,
  mulligan: true,
  penalty: true,
});

export type ShotUpdate = z.infer<typeof ShotUpdateSchema>;
