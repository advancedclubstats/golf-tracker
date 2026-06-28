import { redirect, notFound } from "next/navigation";
import { isOwner } from "@/lib/auth/owner";
import { getPracticeGame } from "@/lib/practice/games";
import { PracticeEntryFlow } from "@/components/practice/PracticeEntryFlow";

export const dynamic = "force-dynamic";

/**
 * Log a practice-game session. Owner-only (like all writes — DL-022): a visitor
 * is bounced back to the read-only leaderboard. Focused flow (the bottom nav
 * hides here, like /rounds/new), so it carries its own escape.
 */
export default async function NewPracticeSessionPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const game = getPracticeGame(gameId);
  if (!game) notFound();

  if (!(await isOwner())) redirect("/practice");

  return (
    <PracticeEntryFlow
      game={{
        id: game.id,
        name: game.name,
        parPerBall: game.parPerBall,
        stations: game.stations.map((s) => ({ yards: s.yards, lie: s.lie, balls: s.balls })),
        leaderboardMetric: game.leaderboardMetric,
        blurb: game.blurb,
      }}
    />
  );
}
