import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant fallback shared by all five Stats pages. The active chip isn't known
 * at this point (loading.tsx can't read the target route), so the chip row and
 * title stream in as placeholders alongside the data table.
 */
export default function StatsLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      {/* Title */}
      <Skeleton className="mb-4 h-7 w-44" />

      {/* Chip sub-nav */}
      <div className="mb-4 flex gap-2">
        {[14, 12, 13, 16, 8].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-full" style={{ width: `${w * 6}px` }} />
        ))}
      </div>

      {/* A headline card */}
      <Skeleton className="mb-4 h-24 w-full rounded-xl" />

      {/* Table rows */}
      <div className="space-y-2.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-md" />
        ))}
      </div>
    </main>
  );
}
