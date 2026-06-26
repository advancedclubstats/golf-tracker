import { Skeleton } from "@/components/ui/skeleton";

/**
 * Override for the New Round focused flow so the parent /rounds list skeleton
 * never bleeds in. Mirrors the form shell: top escape + stacked field rows.
 */
export default function NewRoundLoading() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6">
      <Skeleton className="size-11 rounded-xl" />
      <Skeleton className="h-7 w-40" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}
