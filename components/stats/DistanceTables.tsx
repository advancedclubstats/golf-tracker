"use client";

/**
 * Distance tables with a single global Recent/All-time filter (Ask 2 fallback).
 *
 * The five bucketed putt/approach tables can't fit a per-cell trend glyph, so
 * the handoff prescribes ONE global control that recomputes every row. Adapted
 * to the app's native unit (last N rounds, not "20 shots", since the rows are
 * bucketed aggregates). The page computes both summaries; this swaps which set
 * renders. No per-row trend, no extra columns.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { DataTable, type ColumnConfig } from "@/components/stats/DataTable";
import { DistanceGapHero } from "@/components/stats/DistanceGapHero";
import type {
  DistanceSummary,
  PuttMakeRateRow,
  FirstPuttRow,
  PuttMissRow,
  AroundGreenRow,
  ApproachRow,
} from "@/lib/analytics/distanceSummary";

const makeRateCols: ColumnConfig<PuttMakeRateRow>[] = [
  { header: "Distance", key: "label", align: "left", sortable: false },
  { header: "Putts", key: "putts", align: "right" },
  { header: "Makes", key: "makes", align: "right" },
  { header: "Make%", key: "makePct", format: "pct", align: "right" },
  { header: "vs Tour", key: "gap", format: "gapCell", align: "left", sortable: false },
];
const firstPuttCols: ColumnConfig<FirstPuttRow>[] = [
  { header: "Distance", key: "label", align: "left", sortable: false },
  { header: "Faced", key: "faced", align: "right" },
  { header: "Avg Putts", key: "avgPutts", format: "num", align: "right" },
  { header: "1-Putt%", key: "onePuttPct", format: "pct", align: "right" },
  { header: "vs Tour", key: "gap", format: "gapCell", align: "left", sortable: false },
  { header: "3-Putt%", key: "threePuttPct", format: "pct", align: "right" },
  { header: "vs Tour", key: "threePuttGap", format: "gapCell", align: "left", sortable: false },
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
  { header: "vs Tour", key: "gap", format: "gapCell", align: "left", sortable: false },
];
const approachCols: ColumnConfig<ApproachRow>[] = [
  { header: "Distance", key: "label", align: "left", sortable: false },
  { header: "Shots", key: "shots", align: "right" },
  { header: "Qual", key: "avgQuality", format: "num", align: "right" },
  { header: "Green%", key: "greenHitPct", format: "pct", align: "right" },
  { header: "vs Tour", key: "gap", format: "gapCell", align: "left", sortable: false },
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

export function DistanceTables({
  all,
  recent,
  recentRounds,
}: {
  all: DistanceSummary;
  recent: DistanceSummary;
  recentRounds: number;
}) {
  const [view, setView] = useState<"recent" | "all">("all");
  const s = view === "recent" ? recent : all;
  const showMiss = s.missPatterns.some((b) => b.misses > 0);
  const winLabel = view === "recent" ? `last ${recentRounds} rounds` : "all time";

  return (
    <>
      {/* Global filter — white pill on a sunk track. */}
      <div className="mb-5 inline-flex rounded-full bg-muted p-[3px]">
        {(["recent", "all"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              view === v
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {v === "recent" ? `Last ${recentRounds} rounds` : "All time"}
          </button>
        ))}
      </div>

      <DistanceGapHero hero={s.hero} winLabel={winLabel} />

      <SubTable title="Putting — Make Rate by Distance" columns={makeRateCols} rows={s.makeRate} />
      <SubTable
        title="Putting — Performance by First-Putt Distance"
        columns={firstPuttCols}
        rows={s.firstPutt}
      />
      {showMiss && (
        <SubTable title="Putting — Miss Patterns" columns={missCols} rows={s.missPatterns} />
      )}
      <SubTable
        title="Around the Green (under 30 yds)"
        columns={aroundGreenCols}
        rows={s.aroundGreen}
      />
      <SubTable title="Approach Shots (30+ yds)" columns={approachCols} rows={s.approaches} />
    </>
  );
}
