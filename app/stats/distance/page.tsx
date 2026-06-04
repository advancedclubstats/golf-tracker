import { getAllShots } from "@/lib/db/shots";
import {
  computeDistanceSummary,
  type PuttMakeRateRow,
  type FirstPuttRow,
  type PuttMissRow,
  type AroundGreenRow,
  type ApproachRow,
} from "@/lib/analytics/distanceSummary";
import { DataTable, type ColumnConfig } from "@/components/stats/DataTable";
import { PageHeader } from "@/components/nav/PageHeader";

export const dynamic = "force-dynamic";

// Distance/bucket label columns keep their natural order (sortable: false).
const makeRateCols: ColumnConfig<PuttMakeRateRow>[] = [
  { header: "Distance", key: "label", align: "left", sortable: false },
  { header: "Putts", key: "putts", align: "right" },
  { header: "Makes", key: "makes", align: "right" },
  { header: "Make%", key: "makePct", format: "pct", align: "right" },
];

const firstPuttCols: ColumnConfig<FirstPuttRow>[] = [
  { header: "Distance", key: "label", align: "left", sortable: false },
  { header: "Faced", key: "faced", align: "right" },
  { header: "Avg Putts", key: "avgPutts", format: "num", align: "right" },
  { header: "1-Putt%", key: "onePuttPct", format: "pct", align: "right" },
  { header: "3-Putt%", key: "threePuttPct", format: "pct", align: "right" },
];

const missCols: ColumnConfig<PuttMissRow>[] = [
  { header: "Distance", key: "label", align: "left", sortable: false },
  { header: "Misses", key: "misses", align: "right" },
  { header: "High%", key: "highPct", format: "pct", align: "right" },
  { header: "Low%", key: "lowPct", format: "pct", align: "right" },
  { header: "Short%", key: "shortPct", format: "pct", align: "right" },
  { header: "Long%", key: "longPct", format: "pct", align: "right" },
];

const aroundGreenCols: ColumnConfig<AroundGreenRow>[] = [
  { header: "Distance", key: "label", align: "left", sortable: false },
  { header: "Shots", key: "shots", align: "right" },
  { header: "Qual", key: "avgQuality", format: "num", align: "right" },
  { header: "On Green%", key: "onGreenPct", format: "pct", align: "right" },
  { header: "Up&Down%", key: "upDownPct", format: "pct", align: "right" },
];

const approachCols: ColumnConfig<ApproachRow>[] = [
  { header: "Distance", key: "label", align: "left", sortable: false },
  { header: "Shots", key: "shots", align: "right" },
  { header: "Qual", key: "avgQuality", format: "num", align: "right" },
  { header: "Green%", key: "greenHitPct", format: "pct", align: "right" },
  { header: "Miss L", key: "missLPct", format: "pct", align: "right" },
  { header: "Miss R", key: "missRPct", format: "pct", align: "right" },
  { header: "Long", key: "missLongPct", format: "pct", align: "right" },
  { header: "Short", key: "missShortPct", format: "pct", align: "right" },
];

function SubTable<T extends { label: string }>({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: ColumnConfig<T>[];
  rows: T[];
}) {
  return (
    <section className="mb-6">
      <h2 className="eyebrow mb-2">{title}</h2>
      <DataTable columns={columns} rows={rows} rowKey="label" />
    </section>
  );
}

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
      />
      <SubTable
        title="Putting — Performance by First-Putt Distance"
        columns={firstPuttCols}
        rows={summary.firstPutt}
      />
      {showMissPatterns && (
        <SubTable
          title="Putting — Miss Patterns"
          columns={missCols}
          rows={summary.missPatterns}
        />
      )}
      <SubTable
        title="Around the Green (under 30 yds)"
        columns={aroundGreenCols}
        rows={summary.aroundGreen}
      />
      <SubTable
        title="Approach Shots (30+ yds)"
        columns={approachCols}
        rows={summary.approaches}
      />
    </main>
  );
}
