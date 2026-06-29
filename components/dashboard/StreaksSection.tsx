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
import type { Chase, Streak, Streaks } from "@/lib/analytics/streaks";

/**
 * The forward chase: the one streak closest to beating its record, framed as a
 * target rather than a rear-view count. Deeper fairway-green than the demoted
 * rows below (lime stays reserved for the record-broken beat), so it reads as
 * the live goal without shouting.
 */
function ChaseHero({ c }: { c: Chase }) {
  const pct = c.personalBest > 0 ? Math.min(100, (c.currentRun / c.personalBest) * 100) : 0;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4">
      <p className="eyebrow mb-2">The chase</p>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] text-ink-700">{c.label}</span>
        <div className="flex items-baseline gap-0.5">
          <span className="font-mono text-[26px] font-bold leading-none tabular-nums text-foreground">
            {c.currentRun}
          </span>
          <span className="font-mono text-[15px] leading-none tabular-nums text-muted-foreground">
            /{c.personalBest}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-[12px] font-semibold tabular-nums text-primary">
          {c.toGo} to go
        </span>
      </div>
    </div>
  );
}

function StreakRow({ s }: { s: Streak }) {
  const seen = s.opportunities > 0;
  const record = s.isRecord && s.current > 0;
  const pct = s.best > 0 ? Math.min(100, (s.current / s.best) * 100) : 0;

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
    </div>
  );
}

export function StreaksSection({ streaks }: { streaks: Streaks }) {
  const { chase, metrics } = streaks;
  // The chase is promoted to the hero; don't repeat it in the rows below.
  const rest = chase ? metrics.filter((m) => m.key !== chase.key) : metrics;

  return (
    <section>
      <p className="eyebrow mb-1">Clean streaks</p>
      <p className="mb-3 text-[12px] text-muted-foreground">
        Opportunities since your last mistake in each category.
      </p>
      {chase && <ChaseHero c={chase} />}
      <div>
        {rest.map((s) => (
          <StreakRow key={s.key} s={s} />
        ))}
      </div>
    </section>
  );
}
