import { TrophyIcon, SparklesIcon } from "lucide-react";
import type { PracticeGame } from "@/lib/practice/games";
import { gamePar } from "@/lib/practice/games";
import type { RankedEntry } from "@/lib/practice/scoring";
import { fmtVsPar, fmtSg, sgColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "2026-06-28" → "Jun 28". Date-only string; parse in UTC to avoid TZ drift. */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Personal leaderboard for one practice game (DL-022). Ranks YOUR own sessions
 * — the number to beat — never other players (explicit anti-goal). The best
 * session leads as a hero; every session lists below with its earned markers
 * (new personal record, clean sweep — DL-023).
 *
 * SG is shown beside the headline strokes-to-par as the honest read, but its
 * magnitude is provisional (the wedge baseline cells are marked VERIFY), so the
 * ranking is by strokes, not SG.
 */
export function PracticeLeaderboard({
  game,
  entries,
}: {
  game: PracticeGame;
  entries: RankedEntry[];
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <p className="text-sm font-medium text-foreground">No sessions logged yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Play {game.name} and log your card to set the number to beat.
        </p>
      </div>
    );
  }

  const best = entries[0];

  return (
    <div className="space-y-4">
      {/* Number to beat */}
      <div className="rounded-2xl border border-border bg-fairway-900 p-5 text-[#EAF1EC] shadow-sm">
        <div className="flex items-center gap-2">
          <TrophyIcon className="size-4 text-highlight" strokeWidth={2.25} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#EAF1EC]/70">
            Your number to beat
          </span>
        </div>
        <div className="mt-2 flex items-end gap-4">
          <span className="font-heading text-5xl font-bold leading-none tracking-[-0.02em]">
            {fmtVsPar(best.score.scoreToPar)}
          </span>
          <div className="flex flex-col pb-1 text-sm text-[#EAF1EC]/80">
            <span>
              {best.score.strokes} strokes · par {gamePar(game)}
            </span>
            {best.score.sg != null && (
              <span>
                {fmtSg(best.score.sg)} SG vs scratch · {fmtDate(best.playedOn)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* All sessions */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <span className="w-6">#</span>
          <span className="w-16">Date</span>
          <span className="flex-1">Markers</span>
          <span className="w-12 text-right">SG</span>
          <span className="w-14 text-right">Score</span>
        </div>
        <ul>
          {entries.map((e) => (
            <li
              key={e.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm",
                e.isCurrentBest && "bg-highlight/10",
              )}
            >
              <span className="w-6 font-mono text-muted-foreground">{e.rank}</span>
              <span className="w-16 text-foreground">{fmtDate(e.playedOn)}</span>
              <span className="flex flex-1 items-center gap-1.5">
                {e.setRecord && (
                  <Medallion
                    icon={TrophyIcon}
                    label="New personal record"
                    className="bg-highlight text-highlight-foreground"
                  />
                )}
                {e.cleanSweep && (
                  <Medallion
                    icon={SparklesIcon}
                    label="Clean sweep"
                    className="bg-primary text-primary-foreground"
                  />
                )}
              </span>
              <span
                className={cn(
                  "w-12 text-right tabular-nums",
                  e.score.sg != null ? sgColorClass(e.score.sg) : "text-muted-foreground",
                )}
              >
                {e.score.sg != null ? fmtSg(e.score.sg) : "—"}
              </span>
              <span className="w-14 text-right font-semibold tabular-nums text-foreground">
                {fmtVsPar(e.score.scoreToPar)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({e.score.strokes})
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Legend — what the row medallions mean (icons alone would be cryptic). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Medallion icon={TrophyIcon} size={18} className="bg-highlight text-highlight-foreground" />
          Personal record
        </span>
        <span className="flex items-center gap-1.5">
          <Medallion icon={SparklesIcon} size={18} className="bg-primary text-primary-foreground" />
          Clean sweep
        </span>
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        Ranked by total strokes; SG breaks ties. SG uses the same scratch baseline as your
        rounds — the wedge cells are still being verified, so trust the ranking over the exact
        SG number for now.
      </p>
    </div>
  );
}

/**
 * A hexagonal achievement medallion — a glyph-only badge so leaderboard rows
 * read as badges, not copy (the legend below the table carries the meaning).
 * `label` set = a meaningful image for assistive tech; omitted = decorative
 * (legend swatch) and hidden from it.
 */
function Medallion({
  icon: Icon,
  className,
  label,
  size = 24,
}: {
  icon: typeof TrophyIcon;
  className?: string;
  label?: string;
  size?: number;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label}
      style={{ width: size, height: size }}
      className={cn(
        "flex shrink-0 items-center justify-center [clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]",
        className,
      )}
    >
      <Icon style={{ width: size * 0.56, height: size * 0.56 }} strokeWidth={2} />
    </span>
  );
}
