"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { V1_USER_ID } from "@/lib/constants";
import {
  CourseInsertSchema,
  CourseHoleInsertSchema,
  CourseTeeInsertSchema,
  TeeYardageInsertSchema,
} from "@/lib/schemas/course";
import { requireOwner } from "@/lib/auth/owner";

/** Revalidate course views (and the new-round form, which lists courses). */
function revalidateCourseViews(id?: string) {
  revalidatePath("/courses");
  if (id) revalidatePath(`/courses/${id}`);
  revalidatePath("/rounds/new");
}

/** Create a course and scaffold its 18 holes at par 4 (edit pars after). */
export async function createCourse(name: string): Promise<{ id: string }> {
  await requireOwner();
  const { name: validName } = CourseInsertSchema.parse({ name });
  const supabase = createServerClient();

  const { data: course, error } = await supabase
    .from("courses")
    .insert({ name: validName, user_id: V1_USER_ID })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create course: ${error.message}`);

  const holes = Array.from({ length: 18 }, (_, i) => ({
    course_id: course.id,
    hole_number: i + 1,
    par: 4,
  }));
  const { error: holesErr } = await supabase.from("course_holes").insert(holes);
  if (holesErr) throw new Error(`Failed to create holes: ${holesErr.message}`);

  revalidateCourseViews(course.id);
  return { id: course.id };
}

export async function renameCourse(id: string, name: string): Promise<void> {
  await requireOwner();
  const { name: validName } = CourseInsertSchema.parse({ name });
  const supabase = createServerClient();
  const { error } = await supabase
    .from("courses")
    .update({ name: validName })
    .eq("id", id);
  if (error) throw new Error(`Failed to rename course: ${error.message}`);
  revalidateCourseViews(id);
}

export async function setHolePar(
  courseId: string,
  holeNumber: number,
  par: number,
): Promise<void> {
  await requireOwner();
  CourseHoleInsertSchema.pick({ hole_number: true, par: true }).parse({
    hole_number: holeNumber,
    par,
  });
  const supabase = createServerClient();
  const { error } = await supabase
    .from("course_holes")
    .update({ par })
    .eq("course_id", courseId)
    .eq("hole_number", holeNumber);
  if (error) throw new Error(`Failed to set par: ${error.message}`);
  revalidateCourseViews(courseId);
}

export async function addTee(
  courseId: string,
  name: string,
  color: string | null,
  sortOrder: number,
): Promise<{ id: string }> {
  await requireOwner();
  const validated = CourseTeeInsertSchema.parse({
    course_id: courseId,
    name,
    color,
    sort_order: sortOrder,
  });
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("course_tees")
    .insert(validated)
    .select("id")
    .single();
  if (error) throw new Error(`Failed to add tee: ${error.message}`);
  revalidateCourseViews(courseId);
  return { id: data.id };
}

export async function deleteTee(teeId: string, courseId: string): Promise<void> {
  await requireOwner();
  const supabase = createServerClient();
  const { error } = await supabase.from("course_tees").delete().eq("id", teeId);
  if (error) throw new Error(`Failed to delete tee: ${error.message}`);
  revalidateCourseViews(courseId);
}

/** Set (or clear, when yardage is null) a tee's yardage for a hole. */
export async function setTeeYardage(
  teeId: string,
  courseId: string,
  holeNumber: number,
  yardage: number | null,
): Promise<void> {
  await requireOwner();
  const supabase = createServerClient();

  if (yardage == null) {
    const { error } = await supabase
      .from("tee_yardages")
      .delete()
      .eq("tee_id", teeId)
      .eq("hole_number", holeNumber);
    if (error) throw new Error(`Failed to clear yardage: ${error.message}`);
  } else {
    const validated = TeeYardageInsertSchema.parse({
      tee_id: teeId,
      hole_number: holeNumber,
      yardage,
    });
    const { error } = await supabase
      .from("tee_yardages")
      .upsert(validated, { onConflict: "tee_id,hole_number" });
    if (error) throw new Error(`Failed to set yardage: ${error.message}`);
  }

  revalidateCourseViews(courseId);
}
