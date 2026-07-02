/**
 * The one "edge moment" on the dashboard (design system): a single, plain-English
 * call-out of the biggest prescribable leak — the most strokes recoverable per
 * round. SG-driven. Calm Brief (Direction D): the ONE filled surface on the
 * screen, a stacked lime block whose 38px number is the biggest type moment.
 *
 * Anti-noise rule 4: only a prescribable (well-sampled) leak can headline. If
 * nothing clears its gate yet, render nothing — the ranked list below still
 * shows the early reads.
 *
 * Below the lime leak, a split-off paper strip carries recent form for the
 * leak's *parent* SG category: how many strokes/round you've picked up (or lost)
 * over your last N rounds. It's deliberately its own zone, not more copy on the
 * yellow, so the two signals don't blur. Only shows above the recent-form floor.
 */

import { TrendingUpIcon, TrendingDownIcon } from "lucide-react";
import { fmtSg, fmtPct } from "@/lib/format";
import { leakTitle } from "@/components/dashboard/leakTitle";
import type { Leak } from "@/lib/analytics/leaks";
import { MOVE_THRESHOLD, type RecentForm } from "@/lib/analytics/recentForm";

export function BiggestLeakHero({
  leaks,
  recentForm,
}: {
  leaks: Leak[];
  recentForm?: RecentForm;
}) {
  const top = leaks.find((l) => l.prescribable && l.sgPerRound < 0);
  if (!top) return null;

  // Recent form for the leak's parent category, framed as strokes/round gained
  // or lost over the window (not a prior→now hop). Only above the 2N floor.
  const form = top.category && recentForm ? recentForm.byCategory[top.category] : null;
  const trend =
    form && form.delta != null && top.category
      ? { delta: form.delta, category: top.category, windowN: recentForm!.windowN }
      : null;

  return (
    <div className="overflow-hidden rounded-[16px] border border-border">
      <div className="bg-highlight px-5 pb-[18px] pt-4 text-highlight-foreground">
        <p className="eyebrow text-highlight-foreground/55">Biggest leak</p>
        <div className="mt-[5px] mb-0.5 whitespace-nowrap font-heading text-2xl font-bold tracking-[-0.02em]">
          {leakTitle(top)}
        </div>
        <div className="mt-[7px] font-mono text-[38px] font-bold leading-none tracking-[-0.03em] tabular-nums">
          {fmtSg(top.sgPerRound)}
          <span className="ml-1.5 text-sm font-medium tracking-normal opacity-[0.62]">/ round</span>
        </div>
        {top.raw && (
          <p className="mt-2.5 text-[13.5px] text-highlight-foreground/[0.78]">
            {fmtPct(top.raw.value)} {top.raw.label}
            {top.target != null && <> vs scratch ≈ {fmtPct(top.target)}</>} · across {top.shots} shots
          </p>
        )}
      </div>

      {trend && <RecentFormStrip {...trend} />}
    </div>
  );
}

function RecentFormStrip({
  delta,
  category,
  windowN,
}: {
  delta: number;
  category: string;
  windowN: number;
}) {
  const denom = `over your last ${windowN} rounds`;

  if (Math.abs(delta) < MOVE_THRESHOLD) {
    return (
      <div className="border-t border-border bg-card px-5 py-3 text-[13px] text-ink-300">
        <span className="font-semibold text-ink-700">{category}</span> holding steady {denom}
      </div>
    );
  }

  const up = delta > 0;
  const tone = up ? "text-positive" : "text-clay";
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  return (
    <div className="flex items-center gap-2 border-t border-border bg-card px-5 py-3 text-[13px] text-ink-700">
      <Icon className={`size-4 shrink-0 ${tone}`} aria-hidden />
      <p>
        <span className="font-semibold">{category}</span>:{" "}
        <span className={`font-semibold ${tone}`}>
          {up ? "picked up" : "lost"} {Math.abs(delta).toFixed(2)} / round
        </span>{" "}
        {denom}
      </p>
    </div>
  );
}
