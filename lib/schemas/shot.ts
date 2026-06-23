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
  DECISION_QUALITIES,
  DISTANCE_UNITS,
  OBSTRUCTION,
  SHOT_SHAPES,
  SHOT_CONTACTS,
  SHOT_STARTS,
  TARGET_OFFSETS,
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
   * True when the player overrode the carry-forward `start_lie`. The chain
   * recompute (on insert/delete) preserves manual lies. Optional — the DB
   * defaults it to false, so non-wizard inserts needn't set it.
   */
  start_lie_manual: z.boolean().optional(),

  /**
   * Obstruction at this shot's START — whether something was in the way of the
   * shot. ORTHOGONAL to `start_lie` (surface): a ball in the rough behind a tree
   * is Rough + Blocked. Carries forward from the prior shot's tagged finish
   * (then the next shot's control defaults back to Clear). Default 'Clear' (DB
   * default), so non-wizard inserts and historical rows needn't set it.
   */
  obstruction: z.enum(OBSTRUCTION).optional(),

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
   * Decision quality (spec 1A). The one signal SG can't compute: it separates
   * process from outcome. Default Good (DB default); flag Bad only for a genuine
   * process error. One tap in the wizard. Optional on insert — the DB defaults
   * it to Good, so non-wizard inserts and historical rows needn't set it.
   */
  decision_quality: z.enum(DECISION_QUALITIES).optional(),

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
   * Ball-flight shape (Slice…Hook). Optional, full shots only — tagged on the
   * dedicated shape step after strike quality. Orthogonal to `shot_contact`.
   */
  shot_shape: z.enum(SHOT_SHAPES).nullish(),

  /**
   * Strike fault (Thin/Chunk). Optional and independent of `shot_shape` — a
   * shot can be a fat pull. Full shots only; putts stay null. A clean strike is
   * stored as null (no fault).
   */
  shot_contact: z.enum(SHOT_CONTACTS).nullish(),

  /**
   * Ball start-line (Pull/Straight/Push) — the "cause" axis paired with
   * `shot_shape` (curve). Full shots only; putts stay null.
   */
  shot_start: z.enum(SHOT_STARTS).nullish(),

  /**
   * Where the shot finished relative to the pin/target (3×3 pin-relative grid;
   * generalizes `miss_direction`). Diagnostic only — not an SG input. Full shots
   * only; putts stay null.
   */
  target_offset: z.enum(TARGET_OFFSETS).nullish(),

  /**
   * Putt side miss. Only for Putter shots; only when miss is material
   * (outside ~3-foot gimme circle).
   */
  putt_side: z.enum(PUTT_SIDES).nullish(),

  /**
   * Putt length miss. Only for Putter shots; only when miss is material.
   */
  putt_length: z.enum(PUTT_LENGTHS).nullish(),

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
  penalty: z.number().int().min(0),
  // Nullable fields come back as their type | null from Postgres.
  execution: z.number().int().min(1).max(4).nullable(),
  yardage: z.number().nullable(),
  distance_unit: z.enum(DISTANCE_UNITS).nullable(),
  start_lie: z.enum(START_LIES).nullable(),
  start_lie_manual: z.boolean(),
  // Concrete (not nullable): the DB column is NOT NULL DEFAULT 'Clear'.
  obstruction: z.enum(OBSTRUCTION),
  situation_created: z.enum(SITUATIONS).nullable(),
  short_sided: z.boolean().nullable(),
  decision_quality: z.enum(DECISION_QUALITIES),
  result: z.enum(RESULTS).nullable(),
  miss_direction: z.enum(MISS_DIRECTIONS).nullable(),
  shot_shape: z.enum(SHOT_SHAPES).nullable(),
  shot_contact: z.enum(SHOT_CONTACTS).nullable(),
  shot_start: z.enum(SHOT_STARTS).nullable(),
  target_offset: z.enum(TARGET_OFFSETS).nullable(),
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
  decision_quality: true,
  execution: true,
  result: true,
  miss_direction: true,
  shot_shape: true,
  shot_contact: true,
  putt_side: true,
  putt_length: true,
  penalty: true,
});

export type ShotUpdate = z.infer<typeof ShotUpdateSchema>;
