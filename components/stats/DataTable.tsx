"use client";

/**
 * Sortable, column-driven table for the stats pages.
 *
 * Columns are a *serializable* config (no render functions), so a Server
 * Component page can define them and pass them across the boundary to this
 * Client Component. Formatting is selected by a `format` kind; sorting uses the
 * raw `row[key]` value. Click a header to sort asc → desc → back to original.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { fmtPct, fmtNum, fmtVsParAvg } from "@/lib/format";
import { Sparkline } from "@/components/dashboard/Sparkline";

export type CellFormat = "text" | "num" | "pct" | "vsParAvg" | "sparkline" | "deltaGlyph";

export interface ColumnConfig<T> {
  header: string;
  key: keyof T & string;
  format?: CellFormat;
  align?: "left" | "right";
  /** Sortable unless explicitly false (e.g. distance-bucket label columns). */
  sortable?: boolean;
  /** Companion field holding the in-cell trend object (Ask 2). */
  trendKey?: keyof T & string;
}

type Dir = "asc" | "desc";

/** vs-par trend (Holes); see holeSummary HoleVsParTrend. */
interface SparklineTrend {
  points: number[] | null;
  plays: number;
  floor: number;
  improving: boolean | null;
}
/** delta glyph (Clubs); recent vs prior of a metric. */
interface DeltaTrend {
  delta: number | null;
  count: number;
  floor: number;
}

function renderCell(value: unknown, format: CellFormat = "text") {
  switch (format) {
    case "pct":
      return fmtPct(value as number | null);
    case "num":
      return fmtNum(value as number | null);
    case "vsParAvg":
      return value == null ? "—" : fmtVsParAvg(value as number);
    default:
      return value == null ? "—" : String(value);
  }
}

/** "▲4" / "▼0.3" — the glyph carries direction, so no sign char. */
function deltaText(d: number): string {
  return `${d >= 0 ? "▲" : "▼"}${Math.round(Math.abs(d) * 10) / 10}`;
}

/** vs-par value + an in-cell sparkline (Holes), or the value + "needs N plays". */
function TrendSparkCell({ value, trend }: { value: number | null; trend?: SparklineTrend }) {
  const v = value == null ? "—" : fmtVsParAvg(value);
  if (!trend || trend.points == null) {
    return (
      <span className="inline-flex flex-col items-end leading-tight">
        <span>{v}</span>
        {trend && (
          <span className="font-sans text-[9px] text-ink-300">needs {trend.floor} plays</span>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <Sparkline
        points={trend.points}
        width={56}
        height={20}
        className={trend.improving ? "text-positive" : "text-destructive"}
      />
      <span>{v}</span>
    </span>
  );
}

/** metric value + an in-cell ▲/▼ delta (Clubs), or a faint em-dash below floor. */
function TrendGlyphCell({ value, trend }: { value: number | null; trend?: DeltaTrend }) {
  const v = value == null ? "—" : fmtNum(value);
  if (!trend || trend.delta == null) {
    return (
      <span>
        {v} <span className="text-ink-300">—</span>
      </span>
    );
  }
  return (
    <span>
      {v}{" "}
      <span
        className={cn(
          "text-[0.72rem] font-bold",
          trend.delta >= 0 ? "text-positive" : "text-destructive",
        )}
      >
        {deltaText(trend.delta)}
      </span>
    </span>
  );
}

function compare(av: unknown, bv: unknown, dir: Dir): number {
  const an = av == null;
  const bn = bv == null;
  if (an && bn) return 0;
  if (an) return 1; // nulls always sort last
  if (bn) return -1;
  const r =
    typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv));
  return dir === "asc" ? r : -r;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty = "No data yet.",
}: {
  columns: ColumnConfig<T>[];
  rows: T[];
  rowKey: keyof T & string;
  empty?: string;
}) {
  const [sort, setSort] = useState<{ key: keyof T & string; dir: Dir } | null>(
    null,
  );

  if (rows.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{empty}</p>;
  }

  const sorted = sort
    ? [...rows].sort((a, b) => compare(a[sort.key], b[sort.key], sort.dir))
    : rows;

  function cycle(col: ColumnConfig<T>) {
    if (col.sortable === false) return;
    setSort((cur) => {
      if (!cur || cur.key !== col.key) return { key: col.key, dir: "asc" };
      if (cur.dir === "asc") return { key: col.key, dir: "desc" };
      return null; // third click clears back to the original order
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-muted-foreground">
            {columns.map((c, ci) => {
              const active = sort?.key === c.key;
              const sortable = c.sortable !== false;
              return (
                <th
                  key={ci}
                  aria-sort={
                    active
                      ? sort!.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  className={cn(
                    "whitespace-nowrap px-2 py-2 font-medium",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => cycle(c)}
                      className={cn(
                        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                        active && "text-foreground",
                        c.align === "right" && "flex-row-reverse",
                      )}
                    >
                      {c.header}
                      <span
                        className={cn(
                          "text-[0.6rem]",
                          active ? "opacity-100" : "opacity-30",
                        )}
                        aria-hidden
                      >
                        {active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {sorted.map((row) => (
            <tr key={String(row[rowKey])}>
              {columns.map((c, ci) => (
                <td
                  key={ci}
                  className={cn(
                    "whitespace-nowrap px-2 py-2",
                    c.align === "right" ? "text-right" : "text-left",
                    // Numbers in the data face; text columns stay sans.
                    c.format && c.format !== "text" && "font-mono",
                  )}
                >
                  {c.format === "sparkline" ? (
                    <TrendSparkCell
                      value={row[c.key] as number | null}
                      trend={c.trendKey ? (row[c.trendKey] as unknown as SparklineTrend) : undefined}
                    />
                  ) : c.format === "deltaGlyph" ? (
                    <TrendGlyphCell
                      value={row[c.key] as number | null}
                      trend={c.trendKey ? (row[c.trendKey] as unknown as DeltaTrend) : undefined}
                    />
                  ) : (
                    renderCell(row[c.key], c.format)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
