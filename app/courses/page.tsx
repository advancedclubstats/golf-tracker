import Link from "next/link";
import { getCourses } from "@/lib/db/courses";
import { PageHeader } from "@/components/nav/PageHeader";
import { NewCourseForm } from "@/components/courses/NewCourseForm";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const courses = await getCourses();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 p-4">
      <PageHeader title="Courses" current="courses" />
      <NewCourseForm />

      <ul className="mt-4 flex flex-col gap-2">
        {courses.map((c) => (
          <li key={c.id}>
            <Link
              href={`/courses/${c.id}`}
              className="flex items-center justify-between rounded-xl bg-card px-4 py-3 text-sm ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">Edit →</span>
            </Link>
          </li>
        ))}
        {courses.length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">
            No courses yet — add one above.
          </p>
        )}
      </ul>
    </main>
  );
}
