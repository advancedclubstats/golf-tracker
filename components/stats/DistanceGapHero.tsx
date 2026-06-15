"use client";

/**
 * "Biggest gaps to Tour" — the ranked top-3 leaderboard that gives the Distance
 * page a point of view. It answers "where am I furthest from elite, and does it
 * matter?" in strokes/round, weighted by how often the shot is faced, gated to
 * n≥10 — before the player reads a single table. The one dark fairway card on
 * the page marks the headline moment (Calm Brief: one moment per screen).
 */

import { cn } from "@/lib/utils";
import { fmtSg } from "@/lib/format";
import { GapBar, sevColorVar } from "@/components/stats/GapCell";
import type { HeroGap } from "@/lib/analytics/distanceSummary";

export function DistanceGapHero({ hero, winLabel }: { hero: HeroGap[]; winLabel: string }) {
  // Nothing clears the n≥10 gate, or the player is at/ahead of Tour everywhere.
  if (hero.length === 0) return null;

  const total = hero.reduce((s, g) => s + g.sgRd, 0);
  const totalStr = `${total >= 0 ? "+" : "−"}${Math.abs(total).toFixed(1)}`;

  return (
    <section className="mb-8 overflow-hidden rounded-3xl bg-fairway-900 p-6 text-[#EAF1EC] shadow-lg">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow text-[#CDF23E]/90">Biggest gaps to Tour</p>
        <span className="font-mono text-[11px] tracking-wide text-[#EAF1EC]/55">{winLabel}</span>
      </div>

      <div className="mt-3.5">
        <span className="inline-flex items-baseline gap-3 font-mono text-[52px] font-bold leading-none tracking-[-0.04em]">
          {totalStr}
          <span className="font-sans text-sm font-medium text-[#EAF1EC]/60">strokes / round</span>
        </span>
        <p className="mt-2.5 max-w-[38ch] text-[13.5px] leading-relaxed text-[#EAF1EC]/65">
          live in your three widest gaps to elite play — ranked by{" "}
          <strong className="font-bold text-white">strokes</strong>, not by raw percentage.
        </p>
      </div>

      <ol className="mt-4 list-none">
        {hero.map((g, i) => {
          const per =
            g.perRound >= 1
              ? `~${g.perRound.toFixed(1)} a round`
              : `~${Math.round(g.perRound * 18)} a round*`;
          return (
            <li
              key={g.label}
              className={cn("py-[15px]", i > 0 && "border-t border-white/15")}
            >
              <div className="flex items-baseline gap-[11px]">
                <span className="w-3.5 shrink-0 font-mono text-[13px] font-semibold text-[#EAF1EC]/45">
                  {i + 1}
                </span>
                <span className="flex-1 text-base font-bold tracking-[-0.01em] text-white">
                  {g.label}
                </span>
                <span
                  className="whitespace-nowrap font-mono text-lg font-bold tracking-[-0.02em]"
                  style={{ color: sevColorVar(g.sev) }}
                >
                  {fmtSg(g.sgRd)}
                  <span className="ml-0.5 text-[10px] font-medium opacity-70">/rd</span>
                </span>
              </div>
              <div className="my-2.5 pl-[25px]">
                <GapBar you={g.you} tour={g.tour} sev={g.sev} height={10} onDark />
              </div>
              <p className="pl-[25px] font-mono text-xs leading-snug tabular-nums text-[#EAF1EC]/60">
                {Math.round(g.you * 100)}% vs Tour ≈ {Math.round(g.tour * 100)}% · {g.n} {g.noun} ·{" "}
                {per}
              </p>
            </li>
          );
        })}
      </ol>

      <p className="mt-3.5 text-[11px] leading-relaxed text-[#EAF1EC]/45">
        Weighted by how often you face the shot · gated to buckets with ≥10 attempts · Tour values
        are band averages.
      </p>
    </section>
  );
}
