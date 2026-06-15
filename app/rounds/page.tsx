import { getAllShots } from "@/lib/db/shots";
import { getAllRounds } from "@/lib/db/rounds";
import { computeRoundList } from "@/lib/analytics/rounds";
import { computeRoundBreakdowns } from "@/lib/analytics/roundCard";
import { getEnrichedShots } from "@/lib/sg-server";
import { isOwner } from "@/lib/auth/owner";
import { PageHeader } from "@/components/nav/PageHeader";
import { RoundsList, type RoundListRow } from "@/components/rounds/RoundsList";
import { SESSION_TYPE_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function RoundsPage() {
  const [rawShots, rounds, owner] = await Promise.all([
    getAllShots(),
    getAllRounds(),
    isOwner(),
  ]);
  // Tee-distance-filled shots so round-level SG is computable (shared seam).
  const { shots } = await getEnrichedShots({ shots: rawShots, rounds });
  const list = computeRoundList(shots, rounds);
  const breakdowns = computeRoundBreakdowns(shots);

  const subLabel = (r: (typeof list)[number]) =>
    `${SESSION_TYPE_LABELS[r.sessionType]}${
      r.completeHoles > 0
        ? ` · ${r.completeHoles} hole${r.completeHoles === 1 ? "" : "s"}`
        : r.shotCount > 0
          ? ` · ${r.shotCount} shot${r.shotCount === 1 ? "" : "s"} logged`
          : " · no shots yet"
    }`;

  const items: RoundListRow[] = list.map((r) => ({
    id: r.id,
    date: r.date,
    subLabel: subLabel(r),
    complete: r.completeHoles > 0,
    strokes: r.strokes,
    vsPar: r.vsPar,
    breakdown: breakdowns.get(r.id) ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Rounds" current="rounds" />

      {list.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No rounds yet. Start one with “New Round”.
        </p>
      ) : (
        <RoundsList rounds={items} owner={owner} />
      )}
    </main>
  );
}
