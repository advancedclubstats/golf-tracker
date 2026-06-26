import { PageHeader } from "@/components/nav/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

/** Instant fallback for the Setup (courses) tab. */
export default function CoursesLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Setup" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
