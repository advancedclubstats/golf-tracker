"use client";

/**
 * The ranked leak list (spec Part 3): "one ranked list, three depths."
 *
 * Each row is the same screen at three depths:
 *   1. Raw     — the headline number (recoverable/round + the descriptive stat).
 *   2. Meaning — vs the scratch target (the SG gap; scratch = 0/shot).
 *   3. Impact  — every qualifying shot, what it cost, where it missed.
 * Tap a row to drill from depth 1 to 2 + 3. Sample-gated cuts (spec 2C) below
 * threshold render as a muted "early reads" chip footnote — never prescribed,
 * never expanded (not enough data to be worth a drill-in).
 */

import { useState } from "react";
import { fmtSg, fmtPct, sgColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { leakTitle } from "@/components/dashboard/leakTitle";
import type { Leak, LeakShot } from "@/lib/analytics/leaks";

const MAX_PRESCRIBED = 5;
const MAX_EARLY = 5;
const MAX_SHOTS_SHOWN = 8;

/** Distance + outcome for one impact-layer shot. */
function shotLine(leak: Leak, s: LeakShot): string {
  const dist =
    s.yards == null
      ? ""
      : leak.kind === "putt"
        ? `${Math.round(s.yards * 3)} ft`
        : `${Math.round(s.yards)} yd`;
  const outcome = s.miss ? `missed ${s.miss.toLowerCase()}` : (s.result ?? "");
  return [`Hole ${s.hole}`, dist, outcome].filter(Boolean).join(" · ");
}

function LeakRow({ leak, rank }: { leak: Leak; rank: number }) {
  const [open, setOpen] = useState(false);
  const shown = leak.shotsDetail.slice(0, MAX_SHOTS_SHOWN);
  const extra = leak.shotsDetail.length - shown.length;

  return (
    <div className="py-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="block w-full text-left"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-baseline gap-2.5">
            <span className="font-mono text-[13px] text-ink-300">{rank}.</span>
            <span className="truncate text-[15.5px] font-semibold tracking-[-0.01em]">
              {leakTitle(leak)}
            </span>
          </span>
          {/* Depth 1: strokes recoverable per round. */}
          <span
            className={cn(
              "shrink-0 whitespace-nowrap font-mono text-[15.5px] font-bold tabular-nums",
              sgColorClass(leak.sgPerRound),
            )}
          >
            {fmtSg(leak.sgPerRound)}
            <span className="ml-[3px] text-[10.5px] font-medium text-ink-300">/rd</span>
          </span>
        </div>
        {/* Depth 1 sub-line: descriptive stat with its scratch target + sample. */}
        <div className="mt-[3px] pl-[23px] text-[12.5px] text-muted-foreground">
          {leak.raw && (
            <>
              {fmtPct(leak.raw.value)} {leak.raw.label}
              {leak.target != null && <> · scratch ≈ {fmtPct(leak.target)}</>}
              {" · "}
            </>
          )}
          {leak.shots} shot{leak.shots === 1 ? "" : "s"}
        </div>
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-xl bg-muted/40 p-3 text-sm">
          {/* Depth 2: meaning vs the scratch target. */}
          <p className="text-muted-foreground">
            You&apos;re{" "}
            <span className={cn("font-mono font-semibold", sgColorClass(leak.sgPerShot))}>
              {fmtSg(leak.sgPerShot)}/shot
            </span>{" "}
            vs scratch
            {leak.raw && leak.target != null && (
              <> — scratch ≈ {fmtPct(leak.target)} {leak.raw.label}, you&apos;re at {fmtPct(leak.raw.value)}</>
            )}
            .
          </p>
          {/* Depth 3: the shots themselves. */}
          <ul className="divide-y divide-border/40">
            {shown.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="truncate text-muted-foreground">
                  {shotLine(leak, s)}
                  {s.decision === "Bad" && (
                    <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-chart-3">
                      bad decision
                    </span>
                  )}
                </span>
                <span className={cn("shrink-0 font-mono text-xs tabular-nums", sgColorClass(s.sg))}>
                  {fmtSg(s.sg)}
                </span>
              </li>
            ))}
          </ul>
          {extra > 0 && (
            <p className="text-xs text-muted-foreground">+ {extra} more shot{extra === 1 ? "" : "s"}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function LeakList({ leaks }: { leaks: Leak[] }) {
  // Prescribable losses, ranked; then early-read losses as supporting curiosity.
  const losses = leaks.filter((l) => l.sgPerRound < 0);
  const prescribed = losses.filter((l) => l.prescribable).slice(0, MAX_PRESCRIBED);
  const early = losses.filter((l) => !l.prescribable).slice(0, MAX_EARLY);

  if (prescribed.length === 0 && early.length === 0) {
    return (
      <p className="py-2 text-sm text-muted-foreground">
        No leaks yet — log a few rounds with start lies and distances.
      </p>
    );
  }

  return (
    <div>
      <div className="divide-y divide-border">
        {prescribed.map((l, i) => (
          <LeakRow key={l.id} leak={l} rank={i + 1} />
        ))}
      </div>
      {early.length > 0 && (
        <div className={cn(prescribed.length > 0 && "mt-1 border-t border-border pt-4")}>
          <p className="mb-2.5 text-[12.5px] text-muted-foreground">
            Early reads — not enough data to prescribe yet
          </p>
          <div className="flex flex-wrap gap-2">
            {early.map((l) => (
              <span
                key={l.id}
                className="inline-flex items-baseline gap-1.5 rounded-full bg-muted px-[11px] py-[5px] font-mono text-[12.5px] tabular-nums text-ink-700"
              >
                <b className="font-semibold text-foreground">{leakTitle(l)}</b>
                <span className="font-semibold text-destructive">{fmtSg(l.sgPerRound)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
