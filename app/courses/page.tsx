import Link from "next/link";
import { getCourses } from "@/lib/db/courses";
import { getClubs } from "@/lib/db/clubs";
import { PageHeader } from "@/components/nav/PageHeader";
import { NewCourseForm } from "@/components/courses/NewCourseForm";
import { ClubsEditor } from "@/components/clubs/ClubsEditor";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const [courses, clubs] = await Promise.all([getCourses(), getClubs()]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Setup" current="courses" />

      <section className="mb-8">
        <h2 className="eyebrow mb-3">Your bag</h2>
        <ClubsEditor initialClubs={clubs.map((c) => ({ id: c.id, name: c.name }))} />
      </section>

      <h2 className="eyebrow mb-3">Courses</h2>
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
