import { PageHeader } from "@/components/nav/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant fallback for the Practice section (game selection + leaderboard).
 * Header is real; the cards stream in behind these placeholders — matches the
 * tab-perf pattern used by the other sections.
 */
export default function PracticeLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Practice" />
      <Skeleton className="mb-4 h-[120px] w-full rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[60px] w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
