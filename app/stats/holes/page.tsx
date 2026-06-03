import { getAllShots } from "@/lib/db/shots";
import { computeHoleSummary, type HoleSummaryRow } from "@/lib/analytics/holeSummary";
import { DataTable, type Column } from "@/components/stats/DataTable";
import { StatsNav } from "@/components/nav/StatsNav";
import { fmtVsParAvg, fmtPct, fmtNum } from "@/lib/format";

const columns: Column<HoleSummaryRow>[] = [
  { header: "Hole", cell: (r) => r.hole },
  { header: "Par", cell: (r) => r.par, align: "right" },
  { header: "Rds", cell: (r) => r.rounds, align: "right" },
  { header: "Avg", cell: (r) => fmtNum(r.avgScore), align: "right" },
  { header: "Best", cell: (r) => r.best, align: "right" },
  { header: "vs Par", cell: (r) => fmtVsParAvg(r.avgVsPar), align: "right" },
  { header: "FW%", cell: (r) => fmtPct(r.fwPct), align: "right" },
  { header: "GIR%", cell: (r) => fmtPct(r.girPct), align: "right" },
  { header: "Scr%", cell: (r) => fmtPct(r.scramblePct), align: "right" },
  { header: "Putts", cell: (r) => fmtNum(r.avgPutts), align: "right" },
  { header: "3pt%", cell: (r) => fmtPct(r.threePuttPct), align: "right" },
  { header: "Qual", cell: (r) => fmtNum(r.shotQuality), align: "right" },
];

export const dynamic = "force-dynamic";

export default async function HoleSummaryPage() {
  const shots = await getAllShots();
  const summary = computeHoleSummary(shots);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <h1 className="mb-3 text-xl font-semibold tracking-tight">Hole Summary</h1>
      <StatsNav current="holes" />
      <DataTable
        columns={columns}
        rows={summary.rows}
        getKey={(r) => r.hole}
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
