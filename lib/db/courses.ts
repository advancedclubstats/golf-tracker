/**
 * Database query functions for courses (reads).
 * Call from Server Components and server actions only.
 */

import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
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
import { V1_USER_ID } from "@/lib/constants";

const CourseRowsSchema = z.array(CourseRowSchema);
const CourseHoleRowsSchema = z.array(CourseHoleRowSchema);
const CourseTeeRowsSchema = z.array(CourseTeeRowSchema);
const TeeYardageRowsSchema = z.array(TeeYardageRowSchema);

/** All courses for the v1 user, by name. */
export async function getCourses(): Promise<CourseRow[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", V1_USER_ID)
    .order("name", { ascending: true });
  if (error) throw new Error(`Failed to fetch courses: ${error.message}`);
  return CourseRowsSchema.parse(data);
}

/** A single course by id, or null if not found. */
export async function getCourse(id: string): Promise<CourseRow | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .single();
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
  const { data, error } = await supabase
    .from("tee_yardages")
    .select("*")
    .in("tee_id", teeIds);
  if (error) throw new Error(`Failed to fetch tee yardages: ${error.message}`);
  return TeeYardageRowsSchema.parse(data);
}

/** A course's holes, ascending by hole number. */
export async function getCourseHoles(courseId: string): Promise<CourseHoleRow[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("course_holes")
    .select("*")
    .eq("course_id", courseId)
    .order("hole_number", { ascending: true });
  if (error) throw new Error(`Failed to fetch course holes: ${error.message}`);
  return CourseHoleRowsSchema.parse(data);
}

/** Every tee across all courses (small table; used to map tee → course). */
export async function getAllCourseTees(): Promise<CourseTeeRow[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("course_tees").select("*");
  if (error) throw new Error(`Failed to fetch tees: ${error.message}`);
  return CourseTeeRowsSchema.parse(data);
}

/** Every tee yardage across all courses (used to default tee-shot distances). */
export async function getAllTeeYardages(): Promise<TeeYardageRow[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("tee_yardages").select("*");
  if (error) throw new Error(`Failed to fetch tee yardages: ${error.message}`);
  return TeeYardageRowsSchema.parse(data);
}

/** A course's tees, ordered back-to-forward. */
export async function getCourseTees(courseId: string): Promise<CourseTeeRow[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("course_tees")
    .select("*")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Failed to fetch course tees: ${error.message}`);
  return CourseTeeRowsSchema.parse(data);
}
