import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRound } from "@/lib/db/rounds";
import { getShotsByRound } from "@/lib/db/shots";
import { getClubNames } from "@/lib/db/clubs";
import { aggregateByRoundHole, enrichRoundHole } from "@/lib/analytics/core";
import { isOwner } from "@/lib/auth/owner";
import { isSandbox } from "@/lib/auth/scope";
import { EditableHoleList, type HoleView } from "@/components/rounds/EditableHoleList";
import { SESSION_TYPE_LABELS } from "@/lib/constants";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RoundDetailPage({ params }: Props) {
  const { id } = await params;
  const round = await getRound(id);
  if (!round) notFound();

  const [shots, clubs, owner, sandbox] = await Promise.all([
    getShotsByRound(id),
    getClubNames(),
    isOwner(),
    isSandbox(),
  ]);
  // Reads are scoped to the caller, so a round we could load is always ours to
  // edit — the owner on real data, a visitor on their sandbox copy.
  const canWrite = owner || sandbox;
  // aggregateByRoundHole sorts each hole's shots; sort holes ascending for display.
  const holes: HoleView[] = aggregateByRoundHole(shots)
    .sort((a, b) => a.hole - b.hole)
    .map((h) => ({
      hole: h.hole,
      par: h.par,
      complete: h.complete,
      conceded: h.conceded,
      strokes: h.complete ? enrichRoundHole(h).strokes : null,
      shots: h.shots,
    }));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Home"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border-[1.5px] border-input bg-card text-foreground shadow-sm transition-colors hover:border-ink-300"
          >
            <HomeIcon className="size-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{round.date}</h1>
            <p className="text-xs text-muted-foreground">
              {SESSION_TYPE_LABELS[round.session_type]}
            </p>
          </div>
        </div>
        {canWrite && (
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/rounds/${id}/log`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Add shots →
            </Link>
          </div>
        )}
      </header>

      {round.notes && (
        <p className="mb-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          {round.notes}
        </p>
      )}

      {holes.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No shots logged yet.
          {canWrite && (
            <>
              {" "}
              <Link href={`/rounds/${id}/log`} className="text-primary underline-offset-4 hover:underline">
                Start logging
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <>
          {canWrite && (
            <p className="mb-2 text-xs text-muted-foreground">Tap a shot to edit or delete it.</p>
          )}
          <EditableHoleList roundId={id} clubs={clubs} holes={holes} owner={canWrite} />
        </>
      )}
    </main>
  );
}
