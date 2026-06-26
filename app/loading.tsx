import { PageHeader } from "@/components/nav/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant fallback for the dashboard (and the root-level default). The header
 * is real and static so it paints immediately; the streamed analytics fill in
 * behind these placeholders. Mirrors the Calm Brief narrow editorial column.
 */
export default function HomeLoading() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-[22px] pb-[30px] pt-6">
      <PageHeader title="Dashboard" />

      {/* Hero (biggest leak) */}
      <Skeleton className="mb-9 h-28 w-full rounded-2xl" />

      {/* A couple of editorial sections: eyebrow + stacked rows */}
      {[0, 1, 2].map((s) => (
        <section key={s} className="mb-9">
          <Skeleton className="mb-4 h-3 w-24" />
          <div className="space-y-3">
            {[0, 1, 2].map((r) => (
              <div key={r} className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
