"use client";

/**
 * Hole-level SG attribution (spec Part 3, the killer screen). Each row reads
 * "Hole 7 · par 4 · +0.89/rd — 70% Approach" and drills to the full per-hole SG
 * breakdown (tee / approach / short / putt) — which hole + which part of the
 * game in one place. Presentational; takes computed HoleAttribution rows.
 */

import { useState } from "react";
import { fmtVsParAvg, fmtSg, sgColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HoleAttribution } from "@/lib/analytics/holeAttribution";

function HoleRow({ row }: { row: HoleAttribution }) {
  const [open, setOpen] = useState(false);
  const over = row.avgVsPar;

  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 py-2 text-left"
      >
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-mono text-sm font-semibold tabular-nums">
            Hole {row.hole}
          </span>
          <span className="text-xs text-muted-foreground">
            par {row.par} · {row.rounds} rd{row.rounds === 1 ? "" : "s"}
          </span>
          {row.worstCategory && row.worstShare != null && (
            <span className="truncate text-xs text-muted-foreground">
              — {Math.round(row.worstShare * 100)}% {row.worstCategory}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "font-mono text-sm font-semibold tabular-nums",
              over > 0.001 ? "text-destructive" : over < -0.001 ? "text-positive" : "text-foreground",
            )}
          >
            {fmtVsParAvg(over)}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">/rd</span>
          </span>
          <span className={cn("text-muted-foreground transition-transform", open && "rotate-90")}>›</span>
        </div>
      </button>

      <div className="pl-1 text-xs text-muted-foreground">
        avg {row.avgScore.toFixed(2)} · SG {fmtSg(row.sgPerRound)}/rd
      </div>

      {open && (
        <div className="mt-2 rounded-xl bg-muted/40 p-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground/70">
            SG breakdown · per round
          </p>
          <div className="space-y-1.5">
            {row.categories.map((c) => (
              <div key={c.category} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  {c.category}
                  <span className="ml-1.5 text-[11px] text-muted-foreground/60">
                    {c.shots} shot{c.shots === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {c.lossShare != null && (
                    <span className="text-[11px] text-destructive">
                      {Math.round(c.lossShare * 100)}%
                    </span>
                  )}
                  <span className={cn("w-14 text-right font-mono tabular-nums", sgColorClass(c.perRound))}>
                    {c.shots > 0 ? fmtSg(c.perRound) : "—"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function HoleAttributionList({ rows }: { rows: HoleAttribution[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        No complete holes with SG data yet.
      </p>
    );
  }
  return (
    <div className="divide-y divide-border/40">
      {rows.map((r) => (
        <HoleRow key={r.hole} row={r} />
      ))}
    </div>
  );
}
