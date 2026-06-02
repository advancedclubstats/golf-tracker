import { getAllShots } from "@/lib/db/shots";
import { computeClubSummary, type ClubSummaryRow } from "@/lib/analytics/clubSummary";
import { DataTable, type Column } from "@/components/stats/DataTable";
import { StatsNav } from "@/components/nav/StatsNav";
import { fmtPct, fmtNum } from "@/lib/format";

const columns: Column<ClubSummaryRow>[] = [
  { header: "Club", cell: (r) => r.club },
  { header: "Shots", cell: (r) => r.shots, align: "right" },
  { header: "Qual", cell: (r) => fmtNum(r.avgQuality), align: "right" },
  { header: "Yds", cell: (r) => fmtNum(r.avgYds), align: "right" },
  { header: "FW%", cell: (r) => fmtPct(r.fwPct), align: "right" },
  { header: "Grn%", cell: (r) => fmtPct(r.greenPct), align: "right" },
  { header: "Miss L", cell: (r) => fmtPct(r.missLPct), align: "right" },
  { header: "Miss R", cell: (r) => fmtPct(r.missRPct), align: "right" },
  { header: "Long", cell: (r) => fmtPct(r.missLongPct), align: "right" },
  { header: "Short", cell: (r) => fmtPct(r.missShortPct), align: "right" },
  { header: "Bnkr", cell: (r) => fmtPct(r.bunkerPct), align: "right" },
];

export default async function ClubSummaryPage() {
  const shots = await getAllShots();
  const rows = computeClubSummary(shots);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <h1 className="mb-3 text-xl font-semibold tracking-tight">Club Summary</h1>
      <StatsNav current="clubs" />
      <DataTable
        columns={columns}
        rows={rows}
        getKey={(r) => r.club}
        empty="No shots logged yet."
      />
    </main>
  );
}
