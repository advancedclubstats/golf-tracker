import Link from "next/link";
import { HomeIcon } from "lucide-react";
import { getCourses, getCourseTees } from "@/lib/db/courses";
import { NewRoundForm, type CourseOption } from "./NewRoundForm";

export const dynamic = "force-dynamic";

export default async function NewRoundPage() {
  // Open to everyone: the owner logs real rounds, visitors log into their sandbox.
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
      {/* This is a focused create flow with no bottom bar, so it carries its own
          escape: a Home link back to the dashboard. */}
      <Link
        href="/"
        aria-label="Home"
        className="flex size-11 items-center justify-center rounded-xl border-[1.5px] border-input bg-card text-foreground shadow-sm transition-colors hover:border-ink-300"
      >
        <HomeIcon className="size-5" />
      </Link>
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
