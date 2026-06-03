/**
 * Zod schemas for courses and their holes / tees / yardages.
 *
 * Single source of truth for course field constraints (hard rule). A course
 * defines par per hole (and optional tee yardages); the entry flow uses these
 * as defaults. shots.par remains the as-played source of truth for analytics.
 */

import { z } from "zod";

// ─── Course ───────────────────────────────────────────────────────────────────

export const CourseInsertSchema = z.object({
  name: z.string().min(1, "Course name is required").max(100),
});
export type CourseInsert = z.infer<typeof CourseInsertSchema>;

export const CourseRowSchema = CourseInsertSchema.extend({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_at: z.string(),
});
export type CourseRow = z.infer<typeof CourseRowSchema>;

// ─── Course hole (number + par) ───────────────────────────────────────────────

export const CourseHoleInsertSchema = z.object({
  course_id: z.string().uuid(),
  hole_number: z.number().int().min(1).max(18),
  par: z.number().int().refine((v) => [3, 4, 5].includes(v), {
    message: "Par must be 3, 4, or 5",
  }),
});
export type CourseHoleInsert = z.infer<typeof CourseHoleInsertSchema>;

export const CourseHoleRowSchema = CourseHoleInsertSchema.extend({
  id: z.string().uuid(),
});
export type CourseHoleRow = z.infer<typeof CourseHoleRowSchema>;

// ─── Tee (colour / name) ──────────────────────────────────────────────────────

export const CourseTeeInsertSchema = z.object({
  course_id: z.string().uuid(),
  /** Tee colour or name, e.g. "Blue", "White". Unique within a course. */
  name: z.string().min(1, "Tee name is required").max(40),
  /** Optional display colour (hex or CSS colour) for a swatch. */
  color: z.string().max(40).nullish(),
  /** Ordering, back (longest) to forward. */
  sort_order: z.number().int().default(0),
});
export type CourseTeeInsert = z.infer<typeof CourseTeeInsertSchema>;

export const CourseTeeRowSchema = CourseTeeInsertSchema.extend({
  id: z.string().uuid(),
  color: z.string().nullable(),
  sort_order: z.number().int(),
});
export type CourseTeeRow = z.infer<typeof CourseTeeRowSchema>;

// ─── Tee yardage (per hole; optional, filled over time) ───────────────────────

export const TeeYardageInsertSchema = z.object({
  tee_id: z.string().uuid(),
  hole_number: z.number().int().min(1).max(18),
  yardage: z.number().int().positive(),
});
export type TeeYardageInsert = z.infer<typeof TeeYardageInsertSchema>;

export const TeeYardageRowSchema = TeeYardageInsertSchema.extend({
  id: z.string().uuid(),
});
export type TeeYardageRow = z.infer<typeof TeeYardageRowSchema>;
