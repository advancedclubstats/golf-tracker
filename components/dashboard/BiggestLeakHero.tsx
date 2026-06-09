/**
 * The one "edge moment" on the dashboard (design system): a single, plain-English
 * call-out of the biggest prescribable leak — the most strokes recoverable per
 * round. SG-driven (replaces the old heuristic lime "What to Work On" card).
 *
 * Anti-noise rule 4: only a prescribable (well-sampled) leak can headline. If
 * nothing clears its gate yet, render nothing — the ranked list below still
 * shows the early reads.
 */

import { fmtSg, fmtPct } from "@/lib/format";
import { leakTitle } from "@/components/dashboard/leakTitle";
import type { Leak } from "@/lib/analytics/leaks";

export function BiggestLeakHero({ leaks }: { leaks: Leak[] }) {
  const top = leaks.find((l) => l.prescribable && l.sgPerRound < 0);
  if (!top) return null;

  return (
    <div className="rounded-2xl border-transparent bg-highlight p-4 text-highlight-foreground shadow-sm sm:col-span-2">
      <p className="eyebrow text-highlight-foreground/70">Biggest leak</p>
      <div className="mt-1 flex items-baseline justify-between gap-4">
        <span className="text-lg font-bold">{leakTitle(top)}</span>
        <span className="font-mono text-2xl font-extrabold tabular-nums">
          {fmtSg(top.sgPerRound)}
          <span className="ml-1 text-xs font-normal text-highlight-foreground/70">/round</span>
        </span>
      </div>
      {top.raw && (
        <p className="mt-1 text-sm text-highlight-foreground/80">
          {fmtPct(top.raw.value)} {top.raw.label}
          {top.target != null && <> vs scratch ≈ {fmtPct(top.target)}</>} · across {top.shots} shots
        </p>
      )}
    </div>
  );
}
