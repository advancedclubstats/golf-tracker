import { notFound, redirect } from "next/navigation";
import {
  getCourse,
  getCourseHoles,
  getCourseTees,
  getTeeYardages,
} from "@/lib/db/courses";
import { isOwner } from "@/lib/auth/owner";
import { PageHeader } from "@/components/nav/PageHeader";
import { CourseEditor } from "@/components/courses/CourseEditor";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CourseEditPage({ params }: Props) {
  if (!(await isOwner())) redirect("/"); // course editor is owner-only
  const { id } = await params;
  const course = await getCourse(id);
  if (!course) notFound();

  const [holes, tees] = await Promise.all([
    getCourseHoles(id),
    getCourseTees(id),
  ]);
  const yardages = await getTeeYardages(tees.map((t) => t.id));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title={course.name} current="courses" />
      <CourseEditor
        courseId={id}
        initialName={course.name}
        holes={holes.map((h) => ({ hole: h.hole_number, par: h.par }))}
        tees={tees.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
        yardages={yardages.map((y) => ({
          teeId: y.tee_id,
          hole: y.hole_number,
          yardage: y.yardage,
        }))}
      />
    </main>
  );
}
