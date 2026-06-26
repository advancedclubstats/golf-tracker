/**
 * Database query functions for courses (reads).
 * Call from Server Components and server actions only.
 */

import { z } from "zod";
import { unstable_cache } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { withRetry } from "@/lib/supabase/retry";
import {
  CourseRowSchema,
  CourseHoleRowSchema,
  CourseTeeRowSchema,
  TeeYardageRowSchema,
  type CourseRow,
  type CourseHoleRow,
  type CourseTeeRow,
  type TeeYardageRow,
} from "@/lib/schemas/course";
import { getDataScopeUserId } from "@/lib/auth/scope";

const CourseRowsSchema = z.array(CourseRowSchema);
const CourseHoleRowsSchema = z.array(CourseHoleRowSchema);
const CourseTeeRowsSchema = z.array(CourseTeeRowSchema);
const TeeYardageRowsSchema = z.array(TeeYardageRowSchema);

/** All courses for the v1 user, by name. */
export async function getCourses(): Promise<CourseRow[]> {
  const supabase = createServerClient();
  const userId = await getDataScopeUserId();
  const { data, error } = await withRetry(() =>
    supabase
      .from("courses")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true }),
  );
  if (error) throw new Error(`Failed to fetch courses: ${error.message}`);
  return CourseRowsSchema.parse(data);
}

/** A single course by id (scoped to the caller), or null if not found. */
export async function getCourse(id: string): Promise<CourseRow | null> {
  const supabase = createServerClient();
  const userId = await getDataScopeUserId();
  const { data, error } = await withRetry(() =>
    supabase.from("courses").select("*").eq("id", id).eq("user_id", userId).single(),
  );
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch course: ${error.message}`);
  }
  return CourseRowSchema.parse(data);
}

/** All yardages for the given tee ids. */
export async function getTeeYardages(teeIds: string[]): Promise<TeeYardageRow[]> {
  if (teeIds.length === 0) return [];
  const supabase = createServerClient();
  const { data, error } = await withRetry(() =>
    supabase.from("tee_yardages").select("*").in("tee_id", teeIds),
  );
  if (error) throw new Error(`Failed to fetch tee yardages: ${error.message}`);
  return TeeYardageRowsSchema.parse(data);
}

/** A course's holes, ascending by hole number. */
export async function getCourseHoles(courseId: string): Promise<CourseHoleRow[]> {
  const supabase = createServerClient();
  const { data, error } = await withRetry(() =>
    supabase
      .from("course_holes")
      .select("*")
      .eq("course_id", courseId)
      .order("hole_number", { ascending: true }),
  );
  if (error) throw new Error(`Failed to fetch course holes: ${error.message}`);
  return CourseHoleRowsSchema.parse(data);
}

/**
 * Tag for the global, unscoped course-geometry reads (getAllCourseTees /
 * getAllTeeYardages). They feed the SG tee-distance fill on every analytics
 * page, but the geometry itself changes only when Setup is edited — so we cache
 * them and bust the cache from the course-mutating actions (and the sandbox
 * seed, as a backstop). Not user-scoped and no cookies read inside, so no
 * per-request key is needed and they're safe under unstable_cache. The 1h
 * revalidate is just a backstop for any out-of-band DB edit; tag invalidation
 * handles the normal Setup-edit path immediately. The per-course readers
 * (getCourseTees / getTeeYardages) are intentionally left uncached so the
 * Setup screen always reflects edits live.
 */
export const COURSE_GEOMETRY_TAG = "course-geometry";

/** Every tee across all courses (small table; used to map tee → course). */
export const getAllCourseTees = unstable_cache(
  async (): Promise<CourseTeeRow[]> => {
    const supabase = createServerClient();
    const { data, error } = await withRetry(() =>
      supabase.from("course_tees").select("*"),
    );
    if (error) throw new Error(`Failed to fetch tees: ${error.message}`);
    return CourseTeeRowsSchema.parse(data);
  },
  ["all-course-tees"],
  { tags: [COURSE_GEOMETRY_TAG], revalidate: 3600 },
);

/** Every tee yardage across all courses (used to default tee-shot distances). */
export const getAllTeeYardages = unstable_cache(
  async (): Promise<TeeYardageRow[]> => {
    const supabase = createServerClient();
    const { data, error } = await withRetry(() =>
      supabase.from("tee_yardages").select("*"),
    );
    if (error) throw new Error(`Failed to fetch tee yardages: ${error.message}`);
    return TeeYardageRowsSchema.parse(data);
  },
  ["all-tee-yardages"],
  { tags: [COURSE_GEOMETRY_TAG], revalidate: 3600 },
);

/** A course's tees, ordered back-to-forward. */
export async function getCourseTees(courseId: string): Promise<CourseTeeRow[]> {
  const supabase = createServerClient();
  const { data, error } = await withRetry(() =>
    supabase
      .from("course_tees")
      .select("*")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true }),
  );
  if (error) throw new Error(`Failed to fetch course tees: ${error.message}`);
  return CourseTeeRowsSchema.parse(data);
}
