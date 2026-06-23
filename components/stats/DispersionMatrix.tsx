/**
 * Per-category target-direction dispersion (the target_offset payoff).
 *
 * One card per club category, each with two axes — distance control (short ↔
 * long) led first because it's the signal nothing else captures, then lateral
 * (left ↔ right) — plus the at-pin rate and a prescriptive read. Server
 * Component: pure render over `computeTargetDispersion` rows, no client JS.
 */

import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/format";
import type { TargetDispersionRow } from "@/lib/analytics/targetDispersion";

interface Seg {
  label: string;
  pct: number | null;
  fill: string;
}

/** A 3-segment axis bar (centered "good" band flanked by the two misses). */
function AxisBar({ segs }: { segs: Seg[] }) {
  return (
    <>
      <div className="flex h-7 w-full overflow-hidden rounded-lg">
        {segs.map((s) => {
          const pct = s.pct ?? 0;
          if (pct <= 0) return null;
          return (
            <div
              key={s.label}
              className={cn("min-w-0", s.fill)}
              style={{ width: `${pct * 100}%` }}
              title={`${s.label} ${fmtPct(s.pct)}`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums">
        {segs.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", s.fill)} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-semibold text-foreground">{fmtPct(s.pct)}</span>
          </span>
        ))}
      </div>
    </>
  );
}

function DistanceRead({ row }: { row: TargetDispersionRow }) {
  if (row.distanceBias === "Short") {
    return (
      <span className="font-semibold text-foreground">
        Leaves it short
        <span className="font-normal text-muted-foreground"> — club up, trust the number</span>
      </span>
    );
  }
  if (row.distanceBias === "Long") {
    return (
      <span className="font-semibold text-foreground">
        Runs it long
        <span className="font-normal text-muted-foreground"> — club down, easier swing</span>
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      Distance two-way · {fmtPct(row.shortPct)} short / {fmtPct(row.longPct)} long
    </span>
  );
}

function LateralRead({ row }: { row: TargetDispersionRow }) {
  if (row.lateralBias) {
    const aim = row.lateralBias === "Right" ? "left" : "right";
    return (
      <span className="font-semibold text-foreground">
        Misses {row.lateralBias.toLowerCase()}
        <span className="font-normal text-muted-foreground"> — aim {aim} side</span>
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      Two-way · {fmtPct(row.leftPct)} left / {fmtPct(row.rightPct)} right
    </span>
  );
}

function Card({ row }: { row: TargetDispersionRow }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-bold">{row.category}</h3>
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
          {row.tier === "early" && row.offsetN > 0 && (
            <span className="rounded-full bg-highlight/20 px-2 py-0.5 font-semibold text-foreground">
              early read
            </span>
          )}
          n={row.offsetN}
        </span>
      </div>

      {row.offsetN === 0 ? (
        <p className="text-[13px] text-muted-foreground">No finishes tagged yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Distance control — the headline axis. */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="eyebrow">Distance control</span>
              {row.distanceN > 0 && (
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {fmtPct(row.atPinPct)} at pin
                </span>
              )}
            </div>
            {row.distanceN === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                Not captured off the tee.
              </p>
            ) : (
              <>
                <AxisBar
                  segs={[
                    { label: "Short", pct: row.shortPct, fill: "bg-clay" },
                    { label: "Pin-high", pct: row.pinHighPct, fill: "bg-positive" },
                    { label: "Long", pct: row.longPct, fill: "bg-ink-300" },
                  ]}
                />
                <p className="mt-2 text-[12.5px]">
                  <DistanceRead row={row} />
                </p>
              </>
            )}
          </div>

          {/* Lateral — secondary axis. */}
          <div className="border-t border-border/50 pt-3">
            <span className="eyebrow">Lateral</span>
            <div className="mt-1.5">
              <AxisBar
                segs={[
                  { label: "Left", pct: row.leftPct, fill: "bg-clay" },
                  { label: "On-line", pct: row.onLinePct, fill: "bg-positive" },
                  { label: "Right", pct: row.rightPct, fill: "bg-ink-300" },
                ]}
              />
            </div>
            <p className="mt-2 text-[12.5px]">
              <LateralRead row={row} />
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function DispersionMatrix({ rows }: { rows: TargetDispersionRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No full shots logged yet. Where a shot finished vs the pin is tagged on the
        entry step after the result.
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
