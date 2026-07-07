/**
 * Dashboard "Birdie board" — which holes you've birdied this season and which
 * are still open. A calm scorecard grid of all 18 holes (the "collection" view):
 * a birdied hole gets the lime fill (the one celebratory moment), a played hole
 * without one yet is a quiet outline, and a hole not played this season is a
 * muted dashed cell. Each cell carries its birdie rate. Seasonal — Hayden Lake
 * runs April→October, so the count resets each year.
 *
 * Presentational; takes a computed `BirdieBoard`.
 */

import { cn } from "@/lib/utils";
import type { BirdieBoard, HoleBirdie } from "@/lib/analytics/birdies";

function Cell({ h }: { h: HoleBirdie }) {
  const unplayed = h.played === 0;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg py-2",
        h.birdied
          ? "bg-highlight text-fairway-900"
          : unplayed
            ? "border border-dashed border-border text-ink-300"
            : "border border-border bg-card text-ink-700",
      )}
      title={
        unplayed
          ? `Hole ${h.hole} · par ${h.par} · not played yet this season`
          : `Hole ${h.hole} · par ${h.par} · ${h.birdies}/${h.played} birdied`
      }
    >
      <span className="font-mono text-[15px] font-bold leading-none tabular-nums">{h.hole}</span>
      <span
        className={cn(
          "mt-1 text-[10px] leading-none tabular-nums",
          h.birdied ? "text-fairway-900/70" : "text-muted-foreground",
        )}
      >
        {h.rate == null ? "—" : `${Math.round(h.rate * 100)}%`}
      </span>
    </div>
  );
}

export function BirdieBoard({ board }: { board: BirdieBoard }) {
  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="eyebrow">Birdie board</p>
        <p className="font-mono text-[12px] tabular-nums text-muted-foreground">
          {board.year} season
        </p>
      </div>
      <p className="mb-3 text-[12px] text-muted-foreground">
        <span className="font-semibold text-ink-700">
          {board.birdied}/{board.total}
        </span>{" "}
        holes birdied · {board.remaining} to go. Cell shows birdie rate.
      </p>

      <div className="grid grid-cols-6 gap-2">
        {board.holes.map((h) => (
          <Cell key={h.hole} h={h} />
        ))}
      </div>
    </section>
  );
}
