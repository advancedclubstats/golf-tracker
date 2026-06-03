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
  type CourseRow,
  type CourseHoleRow,
  type CourseTeeRow,
} from "@/lib/schemas/course";
import { V1_USER_ID } from "@/lib/constants";

const CourseRowsSchema = z.array(CourseRowSchema);
const CourseHoleRowsSchema = z.array(CourseHoleRowSchema);
const CourseTeeRowsSchema = z.array(CourseTeeRowSchema);

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
