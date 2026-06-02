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

// ─── Insert ───────────────────────────────────────────────────────────────────

export const RoundInsertSchema = z.object({
  /** Round date as YYYY-MM-DD. Defaults to today in the UI. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),

  /** One of the four session types defined in D-03. */
  session_type: z.enum(SESSION_TYPES),

  /** Optional free-text notes about the round. */
  notes: z.string().max(1000).nullish(),
});

export type RoundInsert = z.infer<typeof RoundInsertSchema>;

// ─── Row (returned from DB) ───────────────────────────────────────────────────

export const RoundRowSchema = RoundInsertSchema.extend({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  // notes comes back as string | null from Postgres
  notes: z.string().max(1000).nullable(),
  created_at: z.string(),
});

export type RoundRow = z.infer<typeof RoundRowSchema>;
