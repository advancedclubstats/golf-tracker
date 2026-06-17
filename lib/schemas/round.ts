/**
 * Zod schemas for the `rounds` table.
 *
 * These are the single source of truth for round field constraints (hard rule).
 * Never redefine round validation inline in a component or server action.
 *
 * RoundInsert  — shape required to create a round (sent to the DB).
 * RoundRow     — shape returned from the DB (includes generated fields).
 */

import { z } from "zod";
import { SESSION_TYPES } from "@/lib/constants";
import { uuidString } from "@/lib/schemas/common";

// ─── Insert ───────────────────────────────────────────────────────────────────

export const RoundInsertSchema = z.object({
  /** Round date as YYYY-MM-DD. Defaults to today in the UI. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),

  /** One of the four session types defined in D-03. Retained at the data layer
   *  (written silently as "Full18"); removed from the entry UI per D-13. */
  session_type: z.enum(SESSION_TYPES),

  /** Hole the player tees off on — seeds the opening hole in the log (D-13).
   *  Round length stays derived from logged shots (D-01); this is just a start
   *  position, not a hole count. */
  starting_hole: z.coerce.number().int().min(1).max(18).default(1),

  /** Optional free-text notes about the round. */
  notes: z.string().max(1000).nullish(),

  /** Optional course this round was played on (provides par/yardage defaults). */
  course_id: uuidString.nullish(),

  /** Optional tee played from. */
  tee_id: uuidString.nullish(),
});

export type RoundInsert = z.infer<typeof RoundInsertSchema>;

/** Pre-validation form shape (before Zod coercion/defaults apply). Use this as
 *  the form-state type so react-hook-form sees the raw inputs, while submit
 *  handlers receive the parsed {@link RoundInsert}. */
export type RoundInsertInput = z.input<typeof RoundInsertSchema>;

// ─── Row (returned from DB) ───────────────────────────────────────────────────

export const RoundRowSchema = RoundInsertSchema.extend({
  id: uuidString,
  user_id: uuidString,
  // notes comes back as string | null from Postgres
  notes: z.string().max(1000).nullable(),
  course_id: uuidString.nullable(),
  tee_id: uuidString.nullable(),
  created_at: z.string(),
});

export type RoundRow = z.infer<typeof RoundRowSchema>;
