import { redirect } from "next/navigation";
import { getCourses, getCourseTees } from "@/lib/db/courses";
import { isOwner } from "@/lib/auth/owner";
import { NewRoundForm, type CourseOption } from "./NewRoundForm";

export const dynamic = "force-dynamic";

export default async function NewRoundPage() {
  if (!(await isOwner())) redirect("/rounds"); // owner-only (read-only demo)
  const courses = await getCourses();
  const options: CourseOption[] = await Promise.all(
    courses.map(async (c) => ({
      id: c.id,
      name: c.name,
      tees: (await getCourseTees(c.id)).map((t) => ({ id: t.id, name: t.name })),
    })),
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">New Round</h1>
        <p className="text-sm text-muted-foreground">
          Fill in the details, then log your shots hole by hole.
        </p>
      </div>
      <NewRoundForm courses={options} />
    </main>
  );
}
