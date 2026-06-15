"use client";

/**
 * The expandable round-card chips: one per metric, framed as a delta vs your
 * own average (the question you have when a round ends — "did THIS move my
 * numbers?"). The signed number is the literal direction (more/fewer, over/
 * under); the COLOUR carries goodness, so "−2 putts" reads green and "+3 score"
 * reads red. Below the sample floor the deltas are absent and we show the raw
 * round value instead — never a guessed comparison.
 */

import { cn } from "@/lib/utils";
import type { RoundBreakdown, RoundMetric } from "@/lib/analytics/roundCard";

const MINUS = "−"; // typographic minus, matches the Distance GapChip

/** Per-kind "didn't really move" threshold (below this → neutral grey). */
const EPS: Record<RoundMetric["kind"], number> = {
  sg: 0.05,
  rate: 0.02,
  count: 0.4,
  score: 0.4,
};

function fmtValue(m: RoundMetric): string {
  switch (m.kind) {
    case "sg":
      return `${m.value >= 0 ? "+" : MINUS}${Math.abs(m.value).toFixed(2)}`;
    case "rate":
      return `${Math.round(m.value * 100)}%`;
    case "count":
      return String(m.value);
    case "score":
      return m.value === 0 ? "E" : m.value > 0 ? `+${m.value}` : `${MINUS}${Math.abs(m.value)}`;
  }
}

function fmtDelta(m: RoundMetric): string {
  const d = m.delta ?? 0;
  const sign = d > 0 ? "+" : d < 0 ? MINUS : "";
  const a = Math.abs(d);
  switch (m.kind) {
    case "sg":
      return `${sign}${a.toFixed(2)}`;
    case "rate":
      return `${sign}${Math.round(a * 100)}`;
    case "count":
    case "score":
      return `${sign}${Math.round(a * 10) / 10}`;
  }
}

/** good = moved in the helpful direction by more than the neutral threshold. */
function tone(m: RoundMetric): "good" | "bad" | "neutral" {
  if (m.delta == null || Math.abs(m.delta) < EPS[m.kind]) return "neutral";
  const better = m.lowerIsBetter ? m.delta < 0 : m.delta > 0;
  return better ? "good" : "bad";
}

function Chip({ m, eligible }: { m: RoundMetric; eligible: boolean }) {
  const showDelta = eligible && m.delta != null;
  const t = showDelta ? tone(m) : "neutral";
  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
      <div className="eyebrow text-[10px] text-muted-foreground">{m.label}</div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-mono text-sm font-semibold tabular-nums",
            t === "good" && "text-positive",
            t === "bad" && "text-destructive",
            t === "neutral" && "text-foreground",
          )}
        >
          {showDelta ? fmtDelta(m) : fmtValue(m)}
        </span>
        {showDelta && (
          <span className="font-mono text-[11px] tabular-nums text-ink-300">
            {fmtValue(m)}
          </span>
        )}
      </div>
    </div>
  );
}

export function RoundChips({ breakdown }: { breakdown: RoundBreakdown }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {breakdown.metrics.map((m) => (
          <Chip key={m.key} m={m} eligible={breakdown.eligible} />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        {breakdown.eligible
          ? "Bold figure = vs your average; faint figure = this round."
          : "Showing this round’s figures — need a few more rounds to compare."}
      </p>
    </div>
  );
}
