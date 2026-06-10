/**
 * The one "edge moment" on the dashboard (design system): a single, plain-English
 * call-out of the biggest prescribable leak — the most strokes recoverable per
 * round. SG-driven. Calm Brief (Direction D): the ONE filled surface on the
 * screen, a stacked lime block whose 38px number is the biggest type moment.
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
    <div className="rounded-[16px] bg-highlight px-5 pb-[18px] pt-4 text-highlight-foreground">
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
  );
}
