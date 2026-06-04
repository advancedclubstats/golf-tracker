/**
 * Zod schema for the user's editable club bag.
 *
 * Single source of truth for club-row constraints (hard rule). The `clubs`
 * table is the *bag that appears in the entry selector*; shots store `club` as
 * a free string (no FK), so removing a club from the bag never alters logged
 * shots or analytics — historical club strings stay intact.
 */

import { z } from "zod";
import { uuidString } from "@/lib/schemas/common";

/** A club name as stored on a shot / in the bag, e.g. "7i", "Putter". */
export const ClubNameSchema = z.string().trim().min(1, "Club name is required").max(12);

export const ClubInsertSchema = z.object({
  name: ClubNameSchema,
  sort_order: z.number().int().default(0),
});
export type ClubInsert = z.infer<typeof ClubInsertSchema>;

export const ClubRowSchema = ClubInsertSchema.extend({
  id: uuidString,
  user_id: uuidString,
  sort_order: z.number().int(),
  created_at: z.string(),
});
export type ClubRow = z.infer<typeof ClubRowSchema>;
