/**
 * Dashboard "Birdie board" — which holes you've birdied and which are still
 * open. A calm scorecard grid of all 18 holes (the "collection" view): a birdied
 * hole gets the lime fill (the one celebratory moment), a played hole without one
 * yet is a quiet outline, and a hole not played in the window is a muted dashed
 * cell. Each cell carries its birdie rate.
 *
 * Two controls (client): a season selector (All time + each season year — Hayden
 * Lake runs April→October, so a year is one season) and an "only remaining"
 * toggle that filters the grid to the holes still open. Presentational — takes
 * pre-computed boards, one per window.
 */

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BirdieBoard as BirdieBoardData, HoleBirdie } from "@/lib/analytics/birdies";

export interface BirdieBoardOption {
  /** Stable key: "all" or the year as a string. */
  key: string;
  /** Display label: "All time" or the year. */
  label: string;
  board: BirdieBoardData;
}

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
          ? `Hole ${h.hole} · par ${h.par} · not played yet`
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

export function BirdieBoard({ boards }: { boards: BirdieBoardOption[] }) {
  const [key, setKey] = useState(boards?.[0]?.key ?? "all");
  const [remainingOnly, setRemainingOnly] = useState(false);

  if (!boards || boards.length === 0) return null;
  const active = boards.find((b) => b.key === key) ?? boards[0];
  if (!active) return null;
  const { board } = active;

  const cells = remainingOnly ? board.holes.filter((h) => !h.birdied) : board.holes;

  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="eyebrow">Birdie board</p>
        {boards.length > 1 ? (
          <select
            value={key}
            onChange={(e) => setKey(e.target.value)}
            aria-label="Season"
            className="rounded-md border border-border bg-card px-2 py-1 font-mono text-[12px] tabular-nums text-ink-700"
          >
            {boards.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="font-mono text-[12px] tabular-nums text-muted-foreground">{active.label}</p>
        )}
      </div>

      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-[12px] text-muted-foreground">
          <span className="font-semibold text-ink-700">
            {board.birdied}/{board.total}
          </span>{" "}
          holes birdied · {board.remaining} to go
        </p>
        <div className="flex overflow-hidden rounded-md border border-border text-[11px]">
          <button
            type="button"
            onClick={() => setRemainingOnly(false)}
            className={cn(
              "px-2 py-1",
              !remainingOnly ? "bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            All 18
          </button>
          <button
            type="button"
            onClick={() => setRemainingOnly(true)}
            className={cn(
              "border-l border-border px-2 py-1",
              remainingOnly ? "bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            Remaining
          </button>
        </div>
      </div>

      {cells.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-4 text-center text-[13px] text-ink-300">
          Every hole birdied — nothing left this window.
        </p>
      ) : (
        <div className="grid grid-cols-6 gap-2">
          {cells.map((h) => (
            <Cell key={h.hole} h={h} />
          ))}
        </div>
      )}
    </section>
  );
}
