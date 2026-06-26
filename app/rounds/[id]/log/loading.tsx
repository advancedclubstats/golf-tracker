import { Skeleton } from "@/components/ui/skeleton";

/**
 * Override for the shot-entry focused flow so the parent /rounds list skeleton
 * never bleeds in. Neutral full-height shell — the flow itself is smooth once
 * mounted; this just gives the initial open instant feedback.
 */
export default function LogLoading() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col gap-6 p-6">
      <Skeleton className="size-11 rounded-xl" />
      <Skeleton className="mx-auto mt-6 h-40 w-full rounded-2xl" />
      <div className="mt-auto grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-xl" />
        ))}
      </div>
    </main>
  );
}
