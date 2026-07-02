/**
 * The score splash that leads /rounds/[id] — the moment a round is finalized.
 *
 * The old detail page opened straight into the editable shot-by-shot list. This
 * gives the round a headline first: the total score, big, with the vs-par read
 * beneath it (green under / red over / neutral even), and an honest "thru N of
 * M" when the round isn't complete yet. The delta chips + hole ledger
 * (RoundRecall) and the collapsible shot list sit below.
 *
 * Presentational server component. Visual system only — CSS-variable tokens via
 * Tailwind, no hardcoded color.
 */

import { cn } from "@/lib/utils";
import { fmtVsPar } from "@/lib/format";

/** Plain-English suffix so the colored number reads unambiguously. */
function parWord(vsPar: number): string {
  if (vsPar === 0) return "even par";
  return vsPar > 0 ? "over par" : "under par";
}

export function RoundScoreHero({
  strokes,
  vsPar,
  holesComplete,
  holesTotal,
}: {
  /** Total strokes over complete holes. */
  strokes: number;
  /** strokes − par over complete holes. */
  vsPar: number;
  /** Number of finished holes. */
  holesComplete: number;
  /** Holes the round is meant to have (18 / 9). */
  holesTotal: number;
}) {
  const partial = holesComplete < holesTotal;
  const tone =
    vsPar < 0 ? "text-positive" : vsPar > 0 ? "text-destructive" : "text-foreground";

  return (
    <section className="mb-8 rounded-2xl bg-card p-6 text-center ring-1 ring-border">
      <p className="eyebrow text-[10px] text-muted-foreground">
        {partial ? `Thru ${holesComplete} of ${holesTotal}` : `${holesTotal} holes complete`}
      </p>
      <div className="font-heading mt-2 text-[72px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
        {strokes}
      </div>
      <p className="mt-3 flex items-baseline justify-center gap-2">
        <span className={cn("font-mono text-2xl font-bold tabular-nums", tone)}>
          {fmtVsPar(vsPar)}
        </span>
        <span className="text-sm font-medium text-muted-foreground">{parWord(vsPar)}</span>
      </p>
    </section>
  );
}
