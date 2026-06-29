/**
 * Dashboard "Clean streaks" section — the Tiger 5 tracker, positively framed.
 *
 * For each classic mistake category, how long the player has gone *without* it:
 * a current run and the personal best. Reuses the Calm Brief vocabulary
 * (hairline rows, mono tabular numbers, lime reserved for the one celebratory
 * moment) rather than the IG dark grid. Each row counts its own opportunity and
 * names it (par 5s / approaches / up & downs), so the rare-event streaks aren't
 * inflated by raw hole counts. A live record (current === best) gets the lime
 * accent + a "RECORD" chip; categories with no opportunities yet render an
 * em-dash, the same honesty treatment as Momentum.
 *
 * Presentational; takes a computed `Streaks`.
 */

import { cn } from "@/lib/utils";
import type { Streak, Streaks } from "@/lib/analytics/streaks";

function StreakRow({ s }: { s: Streak }) {
  const seen = s.opportunities > 0;
  const record = s.isRecord && s.current > 0;
  const pct = s.best > 0 ? Math.min(100, (s.current / s.best) * 100) : 0;
  // DL-025 step-0 cheap test: surface the forward gap to the personal best.
  const toGo = s.best - s.current;

  return (
    <div className="border-t border-border py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] text-ink-700">{s.label}</span>
        <div className="flex items-baseline gap-1.5">
          {seen ? (
            <span
              className={cn(
                "font-mono text-[22px] font-bold leading-none tabular-nums",
                record ? "text-fairway-700" : "text-foreground",
              )}
            >
              {s.current}
            </span>
          ) : (
            <span className="font-mono text-[22px] font-bold leading-none text-ink-300">
              —
            </span>
          )}
          <span className="text-[12px] text-muted-foreground">{s.unit}</span>
        </div>
      </div>

      {seen && (
        <div className="mt-2 flex items-center gap-2.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", record ? "bg-highlight" : "bg-fairway-300")}
              style={{ width: `${pct}%` }}
            />
          </div>
          {record ? (
            <span className="rounded-full bg-highlight px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-fairway-900">
              Record
            </span>
          ) : (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              best {s.best}
            </span>
          )}
        </div>
      )}

      {seen && !record && toGo > 0 && (
        <p className="mt-1 text-[12px] text-ink-700">
          <span className="font-mono font-semibold tabular-nums">{toGo}</span> to go to
          your record
        </p>
      )}
    </div>
  );
}

export function StreaksSection({ streaks }: { streaks: Streaks }) {
  return (
    <section>
      <p className="eyebrow mb-1">Clean streaks</p>
      <p className="mb-3 text-[12px] text-muted-foreground">
        Opportunities since your last mistake in each category.
      </p>
      <div>
        {streaks.metrics.map((s) => (
          <StreakRow key={s.key} s={s} />
        ))}
      </div>
    </section>
  );
}
