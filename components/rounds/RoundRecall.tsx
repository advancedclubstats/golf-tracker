/**
 * The recall header for /rounds/[id]: leads the page with the round's story
 * before the editable hole list below.
 *
 *   takeaway headline  →  RoundChips (deltas vs your average)  →  hole-by-hole ledger
 *
 * Server component (no interaction — Direction A, static rows). The ledger is
 * the dashboard's "Cost by hole" idiom scoped to one round: each row is
 * hole · par · what-happened tag · vs-par. It degrades honestly — conceded and
 * in-progress holes show "—" not a number, and a hole with an SG coverage gap
 * drops its loss tag rather than imply precision (`sgCovered`).
 *
 * Visual system only: CSS-variable tokens via Tailwind, no hardcoded color.
 */

import { cn } from "@/lib/utils";
import { RoundChips } from "@/components/rounds/RoundChips";
import { roundTakeaway, type RoundRecallHole } from "@/lib/analytics/roundRecall";
import type { RoundBreakdown } from "@/lib/analytics/roundCard";
import type { SgCategory } from "@/lib/analytics/sg";
import type { RecentFormMove } from "@/lib/analytics/recentForm";

/**
 * The one recent-form beat this round earned, priority-selected upstream: a
 * broken record outranks a recent-form move outranks nothing. At most one per
 * round — stacking celebrations breaks the Calm Brief identity.
 */
export type ExitBeat =
  | { kind: "record"; best: number; label: string }
  | { kind: "move"; move: RecentFormMove };

/** SG with a leading sign and a typographic minus, e.g. "−0.48" / "+0.30". */
function fmtSigned(n: number): string {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`;
}

/**
 * The single calm exit beat. Descriptive, never predictive; always names the
 * denominator ("last 5 rounds"), never a bare "lately".
 */
function ExitBeatLine({ beat }: { beat: ExitBeat }) {
  if (beat.kind === "record") {
    return (
      <p className="eyebrow mb-3 inline-flex items-center gap-1.5 rounded bg-highlight/25 px-2 py-1 text-[11px] text-foreground">
        <span className="text-[10px]">◆</span>
        New best · {beat.best} {beat.label.toLowerCase()}
      </p>
    );
  }
  const { move } = beat;
  const dir = move.delta > 0 ? "up from" : "down from";
  return (
    <p className="mb-3 text-[13px] leading-snug text-ink-300">
      <span className="font-semibold text-foreground">{move.category}</span>:{" "}
      {fmtSigned(move.recentMean)} over your last {move.windowN}, {dir}{" "}
      {fmtSigned(move.priorMean)} the {move.windowN} before.
    </p>
  );
}

/** How each SG category reads in the "the round turned on …" line. */
const DOMINO_PHRASE: Record<SgCategory, string> = {
  "Off the tee": "off the tee",
  Approach: "the approach",
  "Short game": "the short game",
  Putting: "the putt",
};

/** vs-par with a typographic minus, matching the RoundChips above. */
function fmtVsPar(n: number): string {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** vs-par text color: under = positive, over = destructive, even = neutral. */
function scoreClass(vsPar: number): string {
  if (vsPar < 0) return "text-positive";
  if (vsPar > 0) return "text-destructive";
  return "text-ink-300";
}

function HoleRow({ h }: { h: RoundRecallHole }) {
  const v = h.vsPar;
  const domino =
    h.rootCauseShotNo != null && h.rootCauseCategory != null
      ? { shot: h.rootCauseShotNo, phrase: DOMINO_PHRASE[h.rootCauseCategory] }
      : null;
  return (
    <div className="border-b border-border py-2 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="w-5 font-mono text-sm font-semibold tabular-nums">{h.hole}</span>
        <span className="w-12 text-[11px] text-muted-foreground">par {h.par}</span>

        <span className="flex flex-1 items-center gap-2">
          {v == null ? (
            <span className="eyebrow text-[10px] text-ink-300">
              {h.conceded ? "Picked up" : "In play"}
            </span>
          ) : v < 0 ? (
            <span className="eyebrow rounded bg-highlight/25 px-1.5 py-0.5 text-[10px] text-foreground">
              {v <= -2 ? "Eagle" : "Birdie"}
            </span>
          ) : v > 0 && h.sgCovered && h.worstCategory ? (
            <span className="eyebrow rounded bg-clay/10 px-1.5 py-0.5 text-[10px] text-clay">
              {h.worstCategory}
            </span>
          ) : null}

          {h.hasBadDecision && (
            <span
              className="text-clay text-[11px] leading-none"
              title="Includes a shot you flagged as a bad decision"
              aria-label="bad-decision shot"
            >
              ◆
            </span>
          )}
        </span>

        <span
          className={cn(
            "font-mono text-[15px] font-bold tabular-nums",
            v == null ? "text-ink-300" : scoreClass(v),
          )}
        >
          {v == null ? "—" : fmtVsPar(v)}
        </span>
      </div>

      {domino && (
        <p className="mt-1.5 pl-8 text-[11px] leading-snug text-ink-300">
          The hole turned on{" "}
          <span className="font-semibold text-clay">shot {domino.shot}</span> —{" "}
          {domino.phrase}.
        </p>
      )}
    </div>
  );
}

export function RoundRecall({
  recall,
  breakdown,
  exitBeat = null,
}: {
  recall: RoundRecallHole[];
  breakdown: RoundBreakdown;
  exitBeat?: ExitBeat | null;
}) {
  return (
    <section className="mb-8">
      {exitBeat && <ExitBeatLine beat={exitBeat} />}
      <h2 className="font-heading mb-3 text-xl font-bold leading-snug text-balance">
        {roundTakeaway(breakdown)}
      </h2>

      <div className="mb-6">
        <RoundChips breakdown={breakdown} />
      </div>

      <p className="eyebrow mb-1">The round, hole by hole</p>
      <div>
        {recall.map((h) => (
          <HoleRow key={h.hole} h={h} />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Tag = the link that cost the most on that hole · ◆ marks a bad-decision
        shot · on a blow-up hole, the line names the shot the hole turned on.
      </p>
    </section>
  );
}
