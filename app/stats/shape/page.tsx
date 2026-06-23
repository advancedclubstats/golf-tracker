import { getAllShots } from "@/lib/db/shots";
import { computeShotShapeSummary } from "@/lib/analytics/shotShape";
import { computeTargetDispersion } from "@/lib/analytics/targetDispersion";
import { ShapeMatrix } from "@/components/stats/ShapeMatrix";
import { DispersionMatrix } from "@/components/stats/DispersionMatrix";
import { PageHeader } from "@/components/nav/PageHeader";
import { StatsChips } from "@/components/nav/StatsChips";

export const dynamic = "force-dynamic";

export default async function ShapePage() {
  const shots = await getAllShots();
  const shapeRows = computeShotShapeSummary(shots);
  const dispersionRows = computeTargetDispersion(shots);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Shape & dispersion" />
      <StatsChips current="shape" />

      <h2 className="mb-1 text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
        How it flew
      </h2>
      <ShapeMatrix rows={shapeRows} />
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Rates are over <em>tagged</em> shots per category (a blank shape isn&apos;t
        a flush — the entry step is skippable), so each row shows its own n. The
        bar runs left→right by where the ball finishes: Hook · Draw · Straight ·
        Fade · Slice. A one-way miss means you can aim away from trouble;
        categories below 15 tagged shots read as provisional.
      </p>

      <h2 className="mb-1 mt-8 text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
        Where it finished
      </h2>
      <DispersionMatrix rows={dispersionRows} />
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Where shots finished relative to the pin/target. <em>Distance control</em>{" "}
        (short ↔ long) is the read nothing else captures — magnitude comes from the
        next shot, so only direction is tagged. Diagnostic, not a Strokes-Gained
        figure. Categories below 15 tagged shots read as provisional.
      </p>
    </main>
  );
}
