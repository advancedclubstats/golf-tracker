import Link from "next/link";
import { PlayIcon } from "lucide-react";
import { isOwner } from "@/lib/auth/owner";
import { getPracticeSessions } from "@/lib/db/practice";
import { PRACTICE_GAMES, getPracticeGame, gamePar, totalBalls } from "@/lib/practice/games";
import { buildLeaderboard } from "@/lib/practice/scoring";
import { PageHeader } from "@/components/nav/PageHeader";
import { PracticeLeaderboard } from "@/components/practice/PracticeLeaderboard";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Practice hub: pick a game (registry-driven) and read your personal
 * leaderboard for it — your best highlighted as the number to beat. Public,
 * read-only; the Start CTA shows for the owner only (practice writes are
 * owner-gated, unlike rounds' sandbox writes).
 */
export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const { game: gameParam } = await searchParams;
  const game = getPracticeGame(gameParam ?? "") ?? PRACTICE_GAMES[0];
  const [sessions, owner] = await Promise.all([getPracticeSessions(game.id), isOwner()]);
  const ranked = buildLeaderboard(game, sessions);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Practice" />

      {/* Game selector — iterates the registry, so one game or ten share this. */}
      {PRACTICE_GAMES.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {PRACTICE_GAMES.map((g) => (
            <Link
              key={g.id}
              href={`/practice?game=${g.id}`}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                g.id === game.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-ink-300",
              )}
            >
              {g.name}
            </Link>
          ))}
        </div>
      )}

      {/* Game header card */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-xl font-bold tracking-[-0.01em]">{game.name}</h2>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">{game.blurb}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {totalBalls(game)} balls · par {gamePar(game)} ·{" "}
              {game.stations.map((s) => `${s.yards}y`).join(" / ")}
            </p>
          </div>
          {owner && (
            <Link
              href={`/practice/${game.id}/new`}
              className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95"
            >
              <PlayIcon className="size-4" strokeWidth={2.25} />
              Start
            </Link>
          )}
        </div>
      </div>

      <PracticeLeaderboard game={game} entries={ranked} />
    </main>
  );
}
