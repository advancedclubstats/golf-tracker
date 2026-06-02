import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRound } from "@/lib/db/rounds";
import { getShotsByRound } from "@/lib/db/shots";
import { aggregateByRoundHole, enrichRoundHole } from "@/lib/analytics/core";
import { StatsNav } from "@/components/nav/StatsNav";
import { SESSION_TYPE_LABELS } from "@/lib/constants";
import { fmtVsPar } from "@/lib/format";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RoundDetailPage({ params }: Props) {
  const { id } = await params;
  const round = await getRound(id);
  if (!round) notFound();

  const shots = await getShotsByRound(id);
  // aggregateByRoundHole sorts each hole's shots; sort holes ascending for display.
  const holes = aggregateByRoundHole(shots).sort((a, b) => a.hole - b.hole);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 p-4">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{round.date}</h1>
          <p className="text-xs text-muted-foreground">
            {SESSION_TYPE_LABELS[round.session_type]}
          </p>
        </div>
        <Link
          href={`/rounds/${id}/log`}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Add shots →
        </Link>
      </header>
      <StatsNav current="rounds" />

      {round.notes && (
        <p className="mb-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          {round.notes}
        </p>
      )}

      {holes.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No shots logged yet.{" "}
          <Link href={`/rounds/${id}/log`} className="text-primary underline-offset-4 hover:underline">
            Start logging
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {holes.map((h) => {
            const enriched = h.complete ? enrichRoundHole(h) : null;
            return (
              <li
                key={`${h.hole}`}
                className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">
                    Hole {h.hole}{" "}
                    <span className="text-muted-foreground">· par {h.par}</span>
                  </span>
                  {enriched ? (
                    <span className="tabular-nums">
                      {enriched.strokes}{" "}
                      <span className="text-muted-foreground">
                        ({fmtVsPar(enriched.strokes - h.par)})
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">In progress</span>
                  )}
                </div>
                <ol className="flex flex-col gap-1">
                  {h.shots.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-baseline justify-between gap-3 text-muted-foreground"
                    >
                      <span>
                        <span className="tabular-nums text-foreground">{s.shot_no}.</span>{" "}
                        <span className="text-foreground">{s.club}</span>
                        {s.yardage != null ? ` · ${s.yardage}y` : ""}
                        {s.miss_direction ? ` · ${s.miss_direction}` : ""}
                        {s.penalty > 0 ? ` · +${s.penalty} pen` : ""}
                      </span>
                      <span className="shrink-0 text-right">
                        {s.result ?? "—"}
                        <span className="ml-2 text-xs">exec {s.execution}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
