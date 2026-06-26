import { PageHeader } from "@/components/nav/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant fallback for the Rounds list and a round's detail view. Header is
 * real; the round cards stream in behind these placeholders. (The focused
 * flows — /rounds/new and /rounds/[id]/log — override this with their own
 * loading.tsx so this list skeleton never bleeds into them.)
 */
export default function RoundsLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Rounds" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
