/**
 * Dashboard "Momentum" section (Ask 1, shipped direction B — sparkline buckets).
 *
 * The *motion* paired with the static "Where strokes are lost" picture: which SG
 * categories are gaining vs slipping over the recent N rounds vs the prior N,
 * with a tag that crosses the trend with the category's all-time standing
 * (working / weapon / accelerating / new slip). Honesty rule: a category only
 * appears once it clears the 2N-round floor AND moved meaningfully; below the
 * floor we show the honest "not enough rounds yet" state, never a guess.
 *
 * Presentational; takes a computed `Momentum`. See `design_handoff_momentum`.
 */

import { fmtSg } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/dashboard/Sparkline";
import type { Momentum, MomentumEntry, MomentumTag } from "@/lib/analytics/momentum";

const TAG_CLASS: Record<MomentumTag, string> = {
  work: "bg-[#DDF3E5] text-positive",
  weapon: "bg-highlight text-fairway-900",
  accel: "bg-[#FBE0DD] text-destructive",
  new: "bg-[#FBE8DA] text-[#B8511F]",
};

function tagCopy(e: MomentumEntry): string {
  switch (e.tag) {
    case "work":
      return `#${e.leakRank} leak · working`;
    case "weapon":
      return "weapon";
    case "accel":
      return `#${e.leakRank} leak · accelerating`;
    case "new":
      return "new slip";
  }
}

function Row({ entry, windowN }: { entry: MomentumEntry; windowN: number }) {
  const gaining = entry.bucket === "gaining";
  const color = gaining ? "text-positive" : "text-destructive";
  return (
    <div className="border-t border-border py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="whitespace-nowrap text-[16px] font-bold text-foreground">
          {entry.category}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-[3px] font-mono text-[10px] font-semibold uppercase tracking-[0.03em]",
            TAG_CLASS[entry.tag],
          )}
        >
          {tagCopy(entry)}
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-4">
        <Sparkline points={entry.points} className={color} />
        <div className="text-right">
          <div className={cn("font-mono text-[20px] font-bold tracking-[-0.02em] tabular-nums", color)}>
            {fmtSg(entry.delta)}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            /rd · last {windowN} rounds
          </div>
        </div>
      </div>
    </div>
  );
}

export function MomentumSection({ momentum }: { momentum: Momentum }) {
  const { windowN, floor, gaining, slipping, bestSample, populated } = momentum;
  const belowFloor = bestSample < floor;

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="eyebrow">Momentum</p>
        <p className="eyebrow text-ink-300">vs prior {windowN} rounds</p>
      </div>

      {belowFloor ? (
        // Honest early state — not enough rounds for a split.
        <div>
          <p className="text-[16px] font-bold">Not enough rounds yet</p>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
            Momentum compares your last {windowN} rounds with the {windowN} before —
            it needs about <b className="text-foreground">{floor} rounds</b> per
            category. You have <b className="text-foreground">{bestSample}</b>.
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (bestSample / floor) * 100)}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[11px] text-ink-300">
            {bestSample} / {floor} rounds · we&apos;ll never guess a trend from too little data.
          </p>
        </div>
      ) : !populated ? (
        // Past the floor but nothing moved meaningfully — steady, not empty.
        <p className="text-[13.5px] leading-[1.5] text-muted-foreground">
          Steady this stretch — no category moved meaningfully (±0.15 / rd) across your
          last {windowN} rounds vs the {windowN} before.
        </p>
      ) : (
        <div className="flex flex-col gap-[22px]">
          {gaining.length > 0 && (
            <div>
              <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-positive">
                ▲ Gaining
              </p>
              {gaining.map((e) => (
                <Row key={e.category} entry={e} windowN={windowN} />
              ))}
            </div>
          )}
          {slipping.length > 0 && (
            <div>
              <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-destructive">
                ▼ Slipping
              </p>
              {slipping.map((e) => (
                <Row key={e.category} entry={e} windowN={windowN} />
              ))}
            </div>
          )}
        </div>
      )}

      {populated && (
        <p className="mt-3.5 text-[13px] leading-[1.45] text-muted-foreground">
          Sparkline = your last {floor} rounds in that category; the dotted line is
          scratch. Only categories past the {floor}-round floor that moved meaningfully
          appear — momentum lives only here.
        </p>
      )}
    </section>
  );
}
