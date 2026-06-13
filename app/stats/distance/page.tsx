import { getAllShots } from "@/lib/db/shots";
import { getAllRounds } from "@/lib/db/rounds";
import { computeDistanceSummary } from "@/lib/analytics/distanceSummary";
import { DistanceTables } from "@/components/stats/DistanceTables";
import { PageHeader } from "@/components/nav/PageHeader";

export const dynamic = "force-dynamic";

const RECENT_ROUNDS = 5;

export default async function DistanceSummaryPage() {
  const [shots, rounds] = await Promise.all([getAllShots(), getAllRounds()]);

  // Recent window = shots from the last N rounds by date (Ask 2 global filter).
  const recentRoundIds = new Set(
    [...rounds]
      .sort(
        (a, b) =>
          (new Date(b.date ?? 0).getTime() || 0) - (new Date(a.date ?? 0).getTime() || 0),
      )
      .slice(0, RECENT_ROUNDS)
      .map((r) => r.id),
  );
  const recentShots = shots.filter((s) => recentRoundIds.has(s.round_id));

  const all = computeDistanceSummary(shots);
  const recent = computeDistanceSummary(recentShots);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Distance Summary" current="distance" />
      <DistanceTables all={all} recent={recent} recentRounds={RECENT_ROUNDS} />
    </main>
  );
}
