"use client";

/**
 * The one consistent gap treatment, used everywhere a Tour benchmark exists
 * (Distance redesign, decision #3). Your achievement reads as a calm solid fill;
 * the SHORTFALL to Tour is the striped, severity-coloured space — the gap is
 * literally the highlighted absence. Tour sits as a tick. Severity is driven by
 * strokes/round (opportunity), so a big % gap in a rare bucket stays calm while a
 * smaller gap you face constantly turns red.
 *
 * Shared by the ranked hero (on the dark card) and the in-table `vs Tour` cell.
 */

import { cn } from "@/lib/utils";
import type { GapInfo } from "@/lib/analytics/distanceSummary";

/** Severity → CSS colour var. 0 ahead/even · 1 low · 2 clay · 3 red. */
const SEV_VAR = ["--positive", "--muted-foreground", "--clay", "--destructive"] as const;
export function sevColorVar(sev: 0 | 1 | 2 | 3 | null): string {
  return `var(${SEV_VAR[sev ?? 1]})`;
}

/** you-vs-Tour mini-bar: solid fill = you, striped span = the gap, tick = Tour. */
export function GapBar({
  you,
  tour,
  sev,
  height = 8,
  onDark = false,
}: {
  /** 0..1 fractions. */
  you: number;
  tour: number;
  sev: 0 | 1 | 2 | 3 | null;
  height?: number;
  onDark?: boolean;
}) {
  const youPct = you * 100;
  const tourPct = tour * 100;
  const ahead = you >= tour;
  const lo = Math.min(youPct, tourPct);
  const hi = Math.max(youPct, tourPct);
  // Ahead shows the surplus in green; behind shows the shortfall in severity colour.
  const col = ahead ? (onDark ? "var(--fairway-300)" : "var(--positive)") : sevColorVar(sev);
  const stripe = `repeating-linear-gradient(-45deg, ${col}, ${col} 1.5px, transparent 1.5px, transparent 4px)`;

  return (
    <div
      className={cn(
        "relative min-w-[40px] flex-1 overflow-hidden rounded-full",
        onDark ? "bg-white/12" : "bg-muted",
      )}
      style={{ height }}
    >
      <span
        className={cn("absolute inset-y-0 left-0", onDark ? "bg-white/40" : "bg-foreground/30")}
        style={{ width: `${youPct}%` }}
      />
      <span
        className="absolute inset-y-0"
        style={{
          left: `${lo}%`,
          width: `${hi - lo}%`,
          backgroundImage: stripe,
          opacity: ahead ? 0.5 : 0.85,
        }}
      />
      <span
        className={cn("absolute inset-y-0 w-0.5", onDark ? "bg-white" : "bg-foreground")}
        style={{ left: `${tourPct}%` }}
      />
    </div>
  );
}

/**
 * Signed points gap vs Tour, severity-coloured. The sign reflects GOODNESS, not
 * the raw difference: `+` = better than Tour, `−` = worse — so a lower-is-better
 * metric (3-putt%) reads the same way as a higher-is-better one (make%).
 */
export function GapChip({ gap }: { gap: GapInfo }) {
  const diff = gap.you - gap.tour;
  const ahead = gap.lowerIsBetter ? diff <= 0 : diff >= 0;
  const pts = Math.round(Math.abs(diff) * 100);
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums tracking-tight",
        ahead
          ? "bg-positive/15 text-positive"
          : gap.sev === 3
            ? "bg-destructive text-white"
            : gap.sev === 2
              ? "bg-clay text-clay-foreground"
              : "bg-muted text-ink-700",
      )}
    >
      {ahead ? "+" : "−"}
      {pts}
    </span>
  );
}

/**
 * The in-table `vs Tour` cell: the signed severity chip alone (chip-only style).
 * Thin buckets (n<10) never earn a colour — they render a plain em dash.
 */
export function TableGapCell({ gap }: { gap?: GapInfo }) {
  if (!gap) return <span className="text-ink-300">—</span>;
  if (gap.thin) {
    return (
      <span className="font-mono text-ink-300" title={`n=${gap.n} · below the 10-shot floor`}>
        —
      </span>
    );
  }
  return <GapChip gap={gap} />;
}
