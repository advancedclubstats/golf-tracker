import { getAllShots } from "@/lib/db/shots";
import {
  computeDistanceSummary,
  type PuttMakeRateRow,
  type FirstPuttRow,
  type PuttMissRow,
  type AroundGreenRow,
  type ApproachRow,
} from "@/lib/analytics/distanceSummary";
import { DataTable, type Column } from "@/components/stats/DataTable";
import { PageHeader } from "@/components/nav/PageHeader";
import { fmtPct, fmtNum } from "@/lib/format";

const makeRateCols: Column<PuttMakeRateRow>[] = [
  { header: "Distance", cell: (r) => r.label },
  { header: "Putts", cell: (r) => r.putts, align: "right" },
  { header: "Makes", cell: (r) => r.makes, align: "right" },
  { header: "Make%", cell: (r) => fmtPct(r.makePct), align: "right" },
];

const firstPuttCols: Column<FirstPuttRow>[] = [
  { header: "Distance", cell: (r) => r.label },
  { header: "Faced", cell: (r) => r.faced, align: "right" },
  { header: "Avg Putts", cell: (r) => fmtNum(r.avgPutts), align: "right" },
  { header: "1-Putt%", cell: (r) => fmtPct(r.onePuttPct), align: "right" },
  { header: "3-Putt%", cell: (r) => fmtPct(r.threePuttPct), align: "right" },
];

const missCols: Column<PuttMissRow>[] = [
  { header: "Distance", cell: (r) => r.label },
  { header: "Misses", cell: (r) => r.misses, align: "right" },
  { header: "High%", cell: (r) => fmtPct(r.highPct), align: "right" },
  { header: "Low%", cell: (r) => fmtPct(r.lowPct), align: "right" },
  { header: "Short%", cell: (r) => fmtPct(r.shortPct), align: "right" },
  { header: "Long%", cell: (r) => fmtPct(r.longPct), align: "right" },
];

const aroundGreenCols: Column<AroundGreenRow>[] = [
  { header: "Distance", cell: (r) => r.label },
  { header: "Shots", cell: (r) => r.shots, align: "right" },
  { header: "Qual", cell: (r) => fmtNum(r.avgQuality), align: "right" },
  { header: "On Green%", cell: (r) => fmtPct(r.onGreenPct), align: "right" },
  { header: "Up&Down%", cell: (r) => fmtPct(r.upDownPct), align: "right" },
];

const approachCols: Column<ApproachRow>[] = [
  { header: "Distance", cell: (r) => r.label },
  { header: "Shots", cell: (r) => r.shots, align: "right" },
  { header: "Qual", cell: (r) => fmtNum(r.avgQuality), align: "right" },
  { header: "Green%", cell: (r) => fmtPct(r.greenHitPct), align: "right" },
  { header: "Miss L", cell: (r) => fmtPct(r.missLPct), align: "right" },
  { header: "Miss R", cell: (r) => fmtPct(r.missRPct), align: "right" },
  { header: "Long", cell: (r) => fmtPct(r.missLongPct), align: "right" },
  { header: "Short", cell: (r) => fmtPct(r.missShortPct), align: "right" },
];

function SubTable<T>({
  title,
  columns,
  rows,
  getKey,
}: {
  title: string;
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T, index: number) => string | number;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <DataTable columns={columns} rows={rows} getKey={getKey} />
    </section>
  );
}

export const dynamic = "force-dynamic";

export default async function DistanceSummaryPage() {
  const shots = await getAllShots();
  const summary = computeDistanceSummary(shots);

  // Display layer hides the miss-patterns sub-table when nothing is tagged
  // (the analytics always compute it — see distanceSummary.ts).
  const showMissPatterns = summary.missPatterns.some((b) => b.misses > 0);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Distance Summary" current="distance" />

      <SubTable
        title="Putting — Make Rate by Distance"
        columns={makeRateCols}
        rows={summary.makeRate}
        getKey={(r) => r.label}
      />
      <SubTable
        title="Putting — Performance by First-Putt Distance"
        columns={firstPuttCols}
        rows={summary.firstPutt}
        getKey={(r) => r.label}
      />
      {showMissPatterns && (
        <SubTable
          title="Putting — Miss Patterns"
          columns={missCols}
          rows={summary.missPatterns}
          getKey={(r) => r.label}
        />
      )}
      <SubTable
        title="Around the Green (under 30 yds)"
        columns={aroundGreenCols}
        rows={summary.aroundGreen}
        getKey={(r) => r.label}
      />
      <SubTable
        title="Approach Shots (30+ yds)"
        columns={approachCols}
        rows={summary.approaches}
        getKey={(r) => r.label}
      />
    </main>
  );
}
