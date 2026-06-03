import { getAllShots } from "@/lib/db/shots";
import { computeHoleSummary, type HoleSummaryRow } from "@/lib/analytics/holeSummary";
import { DataTable, type ColumnConfig } from "@/components/stats/DataTable";
import { PageHeader } from "@/components/nav/PageHeader";

export const dynamic = "force-dynamic";

const columns: ColumnConfig<HoleSummaryRow>[] = [
  { header: "Hole", key: "hole", align: "left" },
  { header: "Par", key: "par", align: "right" },
  { header: "Rds", key: "rounds", align: "right" },
  { header: "Avg", key: "avgScore", format: "num", align: "right" },
  { header: "Best", key: "best", format: "num", align: "right" },
  { header: "vs Par", key: "avgVsPar", format: "vsParAvg", align: "right" },
  { header: "FW%", key: "fwPct", format: "pct", align: "right" },
  { header: "GIR%", key: "girPct", format: "pct", align: "right" },
  { header: "Scr%", key: "scramblePct", format: "pct", align: "right" },
  { header: "Putts", key: "avgPutts", format: "num", align: "right" },
  { header: "3pt%", key: "threePuttPct", format: "pct", align: "right" },
  { header: "Qual", key: "shotQuality", format: "num", align: "right" },
];

export default async function HoleSummaryPage() {
  const shots = await getAllShots();
  const summary = computeHoleSummary(shots);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Hole Summary" current="holes" />
      <DataTable
        columns={columns}
        rows={summary.rows}
        rowKey="hole"
        empty="No complete holes logged yet."
      />
      {summary.completeCount > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {summary.completeCount} complete hole{summary.completeCount === 1 ? "" : "s"} counted
          {summary.excluded.length > 0 &&
            ` · ${summary.excluded.length} partial hole${summary.excluded.length === 1 ? "" : "s"} excluded`}
        </p>
      )}
    </main>
  );
}
