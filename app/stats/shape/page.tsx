import { getAllShots } from "@/lib/db/shots";
import { computeShotShapeSummary } from "@/lib/analytics/shotShape";
import { ShapeMatrix } from "@/components/stats/ShapeMatrix";
import { PageHeader } from "@/components/nav/PageHeader";
import { StatsChips } from "@/components/nav/StatsChips";

export const dynamic = "force-dynamic";

export default async function ShapePage() {
  const shots = await getAllShots();
  const rows = computeShotShapeSummary(shots);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Shape & Contact" />
      <StatsChips current="shape" />
      <ShapeMatrix rows={rows} />
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Rates are over <em>tagged</em> shots per category (a blank shape isn&apos;t
        a flush — the entry step is skippable), so each row shows its own n. The
        bar runs left→right by where the ball finishes: Hook · Draw · Straight ·
        Fade · Slice. A one-way miss means you can aim away from trouble;
        categories below 15 tagged shots read as provisional.
      </p>
    </main>
  );
}
