import { getAllShots } from "@/lib/db/shots";
import { getAllRounds } from "@/lib/db/rounds";
import { computeHoleSummary, type HoleSummaryRow } from "@/lib/analytics/holeSummary";
import { getHoleAttribution } from "@/lib/sg-server";
import { DataTable, type ColumnConfig } from "@/components/stats/DataTable";
import { HoleAttributionList } from "@/components/stats/HoleAttribution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/nav/PageHeader";
import { StatsChips } from "@/components/nav/StatsChips";

export const dynamic = "force-dynamic";

const columns: ColumnConfig<HoleSummaryRow>[] = [
  { header: "Hole", key: "hole", align: "left" },
  { header: "Par", key: "par", align: "right" },
  { header: "Rds", key: "rounds", align: "right" },
  { header: "Avg", key: "avgScore", format: "num", align: "right" },
  { header: "Best", key: "best", format: "num", align: "right" },
  { header: "vs Par", key: "avgVsPar", format: "sparkline", trendKey: "vsParTrend", align: "right" },
  { header: "FW%", key: "fwPct", format: "pct", align: "right" },
  { header: "GIR%", key: "girPct", format: "pct", align: "right" },
  { header: "Scr%", key: "scramblePct", format: "pct", align: "right" },
  { header: "Putts", key: "avgPutts", format: "num", align: "right" },
  { header: "3pt%", key: "threePuttPct", format: "pct", align: "right" },
  { header: "Qual", key: "shotQuality", format: "num", align: "right" },
];

export default async function HoleSummaryPage() {
  const [shots, rounds] = await Promise.all([getAllShots(), getAllRounds()]);
  const dateOf = Object.fromEntries(rounds.map((r) => [r.id, r.date]));
  const summary = computeHoleSummary(shots, dateOf);
  const attribution = await getHoleAttribution({ shots, rounds });

  const pickedUp = summary.excluded.filter((e) => e.conceded).length;
  const unfinished = summary.excluded.length - pickedUp;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Hole Summary" />
      <StatsChips current="holes" />

      {/* The killer screen (spec Part 3): per-hole SG attribution — which hole
          costs what, and which part of the game causes it. */}
      <Card size="sm" className="mb-4">
        <CardHeader>
          <CardTitle className="eyebrow">Cost by hole</CardTitle>
        </CardHeader>
        <CardContent>
          <HoleAttributionList rows={attribution} />
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={summary.rows}
        rowKey="hole"
        empty="No complete holes logged yet."
      />
      {summary.completeCount > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {summary.completeCount} complete hole{summary.completeCount === 1 ? "" : "s"} counted
          {pickedUp > 0 && ` · ${pickedUp} picked up`}
          {unfinished > 0 && ` · ${unfinished} unfinished excluded`}
          {" · "}vs-par sparkline = last 10 plays
        </p>
      )}
    </main>
  );
}
