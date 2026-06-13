import { getAllShots } from "@/lib/db/shots";
import { getAllRounds } from "@/lib/db/rounds";
import { computeClubSummary, type ClubSummaryRow } from "@/lib/analytics/clubSummary";
import { DataTable, type ColumnConfig } from "@/components/stats/DataTable";
import { PageHeader } from "@/components/nav/PageHeader";

export const dynamic = "force-dynamic";

const columns: ColumnConfig<ClubSummaryRow>[] = [
  { header: "Club", key: "club", align: "left" },
  { header: "Shots", key: "shots", align: "right" },
  { header: "Qual", key: "avgQuality", format: "deltaGlyph", trendKey: "qualTrend", align: "right", sortable: false },
  { header: "Yds", key: "avgYds", format: "num", align: "right" },
  { header: "FW%", key: "fwPct", format: "pct", align: "right" },
  { header: "Grn%", key: "greenPct", format: "pct", align: "right" },
  { header: "Miss L", key: "missLPct", format: "pct", align: "right" },
  { header: "Miss R", key: "missRPct", format: "pct", align: "right" },
  { header: "Long", key: "missLongPct", format: "pct", align: "right" },
  { header: "Short", key: "missShortPct", format: "pct", align: "right" },
  { header: "Bnkr", key: "bunkerPct", format: "pct", align: "right" },
];

export default async function ClubSummaryPage() {
  const [shots, rounds] = await Promise.all([getAllShots(), getAllRounds()]);
  const dateOf = Object.fromEntries(rounds.map((r) => [r.id, r.date]));
  const rows = computeClubSummary(shots, dateOf);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Club Summary" current="clubs" />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey="club"
        empty="No shots logged yet."
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Qual ▲▼ = strike trend vs your prior 20 shots with that club (needs 40+).
      </p>
    </main>
  );
}
