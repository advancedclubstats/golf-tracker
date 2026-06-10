/**
 * Scoring shape (spec Part 3, dashboard answer #1): the distribution of hole
 * outcomes with target lines — not just average vs par. Leads with the DECADE
 * headline (birdies − doubles), then a segmented bar and a full-width per-band
 * ledger of rate vs the scratch target. Calm Brief: flat section, no card
 * chrome — hairline rows carry the structure. Presentational; takes a computed
 * ScoringShape.
 */

import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ScoringShape } from "@/lib/analytics/dashboard";

const BAND_COLOR: Record<string, string> = {
  eagle: "bg-positive",
  birdie: "bg-positive/70",
  par: "bg-muted-foreground/40",
  bogey: "bg-chart-3/75",
  double: "bg-destructive",
};

export function ScoringShapeSection({ shape }: { shape: ScoringShape }) {
  if (shape.holes === 0) return null;
  const net = shape.net;

  return (
    <section>
      <p className="eyebrow mb-4">Scoring shape</p>

      {/* Headline: birdies minus doubles. */}
      <div className="mb-3.5 flex items-baseline gap-[9px]">
        <span
          className={cn(
            "font-mono text-[32px] font-bold tracking-[-0.02em] tabular-nums",
            net > 0 ? "text-positive" : net < 0 ? "text-destructive" : "text-foreground",
          )}
        >
          {net > 0 ? "+" : ""}
          {Math.round(net * 100)}%
        </span>
        <span className="text-[13px] text-muted-foreground">birdies − doubles per hole</span>
      </div>

      {/* Segmented distribution bar. */}
      <div className="mb-3.5 flex h-2.5 w-full overflow-hidden rounded-full">
        {shape.bands.map((b) =>
          b.rate > 0 ? (
            <div
              key={b.key}
              className={cn("h-full", BAND_COLOR[b.key])}
              style={{ width: `${b.rate * 100}%` }}
              title={`${b.label}: ${fmtPct(b.rate)}`}
            />
          ) : null,
        )}
      </div>

      {/* Per-band ledger: your rate vs the scratch target, plus the gap. */}
      <div className="divide-y divide-border">
        {shape.bands.map((b) => {
          const gap = b.target != null ? b.rate - b.target : null;
          return (
            <div key={b.key} className="flex items-center justify-between py-[7px] text-sm">
              <span className="flex items-center gap-[9px] text-ink-700">
                <span className={cn("inline-block h-2 w-2 rounded-full", BAND_COLOR[b.key])} />
                {b.label}
              </span>
              <span className="whitespace-nowrap font-mono tabular-nums">
                {fmtPct(b.rate)}
                {b.target != null && (
                  <span className="ml-2 text-[11.5px] text-ink-300">/ {fmtPct(b.target)}</span>
                )}
                {gap != null && Math.abs(gap) >= 0.005 && (
                  <span
                    className={cn(
                      "ml-2 text-[11.5px] font-semibold",
                      // More birdies/eagles is good; fewer bogeys/doubles is good;
                      // par has no clearly-good direction → stay neutral.
                      b.key === "par"
                        ? "text-ink-300"
                        : (b.key === "birdie" || b.key === "eagle" ? gap > 0 : gap < 0)
                          ? "text-positive"
                          : "text-destructive",
                    )}
                  >
                    {gap > 0 ? "+" : ""}
                    {Math.round(gap * 100)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
