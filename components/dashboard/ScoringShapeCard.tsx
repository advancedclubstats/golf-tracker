/**
 * Scoring shape (spec Part 3, dashboard answer #1): the distribution of hole
 * outcomes with target lines — not just average vs par. Leads with the DECADE
 * headline (birdies − doubles), then a segmented bar and per-band rate vs the
 * scratch target. The tails (birdie / double+) drive the handicap, so they read
 * first. Presentational; takes a computed ScoringShape.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ScoringShape } from "@/lib/analytics/dashboard";

const BAND_COLOR: Record<string, string> = {
  eagle: "bg-positive",
  birdie: "bg-positive/70",
  par: "bg-muted-foreground/40",
  bogey: "bg-chart-3/70",
  double: "bg-destructive",
};

export function ScoringShapeCard({ shape }: { shape: ScoringShape }) {
  if (shape.holes === 0) return null;
  const net = shape.net;

  return (
    <Card size="sm" className="sm:col-span-2">
      <CardHeader>
        <CardTitle className="eyebrow">Scoring shape</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Headline: birdies minus doubles. */}
        <div className="mb-3 flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono text-3xl font-extrabold tabular-nums",
              net > 0 ? "text-positive" : net < 0 ? "text-destructive" : "text-foreground",
            )}
          >
            {net > 0 ? "+" : ""}
            {Math.round(net * 100)}%
          </span>
          <span className="text-sm text-muted-foreground">
            birdies − doubles per hole
          </span>
        </div>

        {/* Segmented distribution bar. */}
        <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full">
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

        {/* Per-band: your rate vs the scratch target. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
          {shape.bands.map((b) => {
            const gap = b.target != null ? b.rate - b.target : null;
            return (
              <div key={b.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className={cn("inline-block h-2 w-2 rounded-full", BAND_COLOR[b.key])} />
                  {b.label}
                </span>
                <span className="font-mono tabular-nums">
                  {fmtPct(b.rate)}
                  {b.target != null && (
                    <span className="ml-1 text-[11px] text-muted-foreground">
                      / {fmtPct(b.target)}
                    </span>
                  )}
                  {gap != null && Math.abs(gap) >= 0.005 && (
                    <span
                      className={cn(
                        "ml-1 text-[11px]",
                        // More birdies/eagles is good; fewer bogeys/doubles is good;
                        // par has no clearly-good direction → stay neutral.
                        b.key === "par"
                          ? "text-muted-foreground"
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
      </CardContent>
    </Card>
  );
}
