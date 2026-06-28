/**
 * Zod schemas for the practice-game tables (`practice_sessions`,
 * `practice_results`). Single source of truth for practice field constraints —
 * never redefine inline (hard rule). Games themselves are CODE config
 * (lib/practice/games.ts); these schemas only validate the stored raw results.
 */

import { z } from "zod";
import { uuidString } from "@/lib/schemas/common";

// ─── Insert (a whole session written in one action) ─────────────────────────

/** One ball's raw result. `strokes` is the only required input. */
export const PracticeResultInsertSchema = z.object({
  station_index: z.coerce.number().int().min(0),
  ball_index: z.coerce.number().int().min(0),
  strokes: z.coerce.number().int().min(1).max(15),
  putts: z.coerce.number().int().min(0).max(15).nullish(),
  finish: z.string().max(40).nullish(),
});

export type PracticeResultInsert = z.infer<typeof PracticeResultInsertSchema>;

/** Payload to create a session: the game + date + every ball's result. */
export const PracticeSessionInsertSchema = z.object({
  game_id: z.string().min(1).max(60),
  played_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  results: z.array(PracticeResultInsertSchema).min(1),
});

export type PracticeSessionInsert = z.infer<typeof PracticeSessionInsertSchema>;
export type PracticeSessionInsertInput = z.input<typeof PracticeSessionInsertSchema>;

// ─── Rows (returned from DB) ────────────────────────────────────────────────

export const PracticeSessionRowSchema = z.object({
  id: uuidString,
  user_id: uuidString,
  game_id: z.string(),
  played_on: z.string(),
  created_at: z.string(),
});

export type PracticeSessionRow = z.infer<typeof PracticeSessionRowSchema>;

export const PracticeResultRowSchema = z.object({
  id: uuidString,
  session_id: uuidString,
  station_index: z.number().int(),
  ball_index: z.number().int(),
  strokes: z.number().int(),
  putts: z.number().int().nullable(),
  finish: z.string().nullable(),
});

export type PracticeResultRow = z.infer<typeof PracticeResultRowSchema>;
