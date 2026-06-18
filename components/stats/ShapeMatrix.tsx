/**
 * Per-category shape & contact tendencies (the migration-016 payoff).
 *
 * One card per club category, each showing a left→right dispersion bar
 * (Hook · Draw · Straight · Fade · Slice — the order the ball finishes), the
 * one-way vs two-way miss read, and the strike-fault rates. Server Component:
 * pure render over `computeShotShapeSummary` rows, no client JS.
 */

import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/format";
import type { ShotShape } from "@/lib/constants";
import type { ShotShapeRow } from "@/lib/analytics/shotShape";

/** Dispersion order: ball finishes furthest-left → furthest-right. */
const SHAPE_ORDER: ShotShape[] = ["Hook", "Draw", "Straight", "Fade", "Slice"];

/** Segment fill per shape — big curves read as faults, the rest as controlled. */
const SHAPE_FILL: Record<ShotShape, string> = {
  Hook: "bg-destructive",
  Draw: "bg-positive",
  Straight: "bg-ink-300",
  Fade: "bg-primary",
  Slice: "bg-clay",
};

function MissRead({ row }: { row: ShotShapeRow }) {
  if (row.shapeN === 0) return null;
  if (row.oneWayMiss) {
    return (
      <span className="font-semibold text-foreground">
        One-way miss · {row.oneWayMiss.toLowerCase()}
        <span className="font-normal text-muted-foreground">
          {" "}
          — aim {row.oneWayMiss === "Right" ? "left" : "right"} side
        </span>
      </span>
    );
  }
  const l = fmtPct(row.curveLeftPct);
  const r = fmtPct(row.curveRightPct);
  return (
    <span className="text-muted-foreground">
      Two-way miss · {l} left / {r} right
    </span>
  );
}

function Card({ row }: { row: ShotShapeRow }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-bold">{row.category}</h3>
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
          {row.tier === "early" && (
            <span className="rounded-full bg-highlight/20 px-2 py-0.5 font-semibold text-foreground">
              early read
            </span>
          )}
          n={row.shapeN}
        </span>
      </div>

      {row.shapeN === 0 ? (
        <p className="text-[13px] text-muted-foreground">No shapes tagged yet.</p>
      ) : (
        <>
          {/* Dispersion bar */}
          <div className="flex h-7 w-full overflow-hidden rounded-lg">
            {SHAPE_ORDER.map((s) => {
              const pct = row.shapePct[s] ?? 0;
              if (pct <= 0) return null;
              return (
                <div
                  key={s}
                  className={cn("min-w-0", SHAPE_FILL[s])}
                  style={{ width: `${pct * 100}%` }}
                  title={`${s} ${fmtPct(pct)}`}
                />
              );
            })}
          </div>

          {/* Per-shape legend row */}
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums">
            {SHAPE_ORDER.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", SHAPE_FILL[s])} />
                <span className="text-muted-foreground">{s}</span>
                <span className="font-semibold text-foreground">
                  {fmtPct(row.shapePct[s])}
                </span>
              </span>
            ))}
          </div>

          {/* Read + contact */}
          <div className="mt-3 flex flex-col gap-1 border-t border-border/50 pt-3 text-[12.5px]">
            <MissRead row={row} />
            <span className="text-muted-foreground">
              Contact{" "}
              {row.contactN === 0 ? (
                "— none tagged"
              ) : (
                <>
                  <span className="font-semibold text-foreground">
                    Thin {fmtPct(row.contactPct.Thin)}
                  </span>{" "}
                  ·{" "}
                  <span className="font-semibold text-foreground">
                    Chunk {fmtPct(row.contactPct.Chunk)}
                  </span>{" "}
                  <span className="font-mono text-[11px]">(n={row.contactN})</span>
                </>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export function ShapeMatrix({ rows }: { rows: ShotShapeRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No full shots logged yet. Shape and contact are tagged on the entry step
        after strike quality.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <Card key={r.category} row={r} />
      ))}
    </div>
  );
}
