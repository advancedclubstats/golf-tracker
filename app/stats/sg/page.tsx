import { getStrokesGained } from "@/lib/sg-server";
import { fmtSg, sgColorClass as sgColor } from "@/lib/format";
import { PageHeader } from "@/components/nav/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StrokesGainedPage() {
  const sg = await getStrokesGained();

  if (sg.coveredShots === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 p-4">
        <PageHeader title="Strokes Gained" current="sg" />
        <p className="py-8 text-center text-sm text-muted-foreground">
          No strokes-gained data yet. SG needs a start lie and distance on each
          shot — log a round with the new entry flow to see it.
        </p>
      </main>
    );
  }

  // Bar scale: widest category leak/gain per round.
  const maxAbs = Math.max(
    ...sg.byCategory.map((c) => Math.abs(c.perRound)),
    0.01,
  );
  const coveragePct = Math.round((100 * sg.coveredShots) / sg.totalShots);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Strokes Gained" current="sg" />

      {/* Headline: total per round vs the scratch baseline */}
      <Card size="sm" className="mb-4">
        <CardHeader>
          <CardTitle className="eyebrow">Per round vs scratch</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-4">
            <div
              className={cn(
                "font-mono text-5xl font-extrabold tabular-nums",
                sgColor(sg.perRound),
              )}
            >
              {fmtSg(sg.perRound)}
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div className="font-mono tabular-nums">{fmtSg(sg.total)} total</div>
              <div>
                {sg.rounds} round{sg.rounds === 1 ? "" : "s"} · {coveragePct}% of
                shots covered
              </div>
            </div>
          </div>
          {sg.worst && sg.worst.perRound < 0 && (
            <p className="mt-3 border-t border-border pt-3 text-sm">
              Biggest leak:{" "}
              <span className="font-semibold">{sg.worst.category}</span>, losing{" "}
              <span className="font-mono font-semibold text-destructive">
                {fmtSg(sg.worst.perRound)}
              </span>{" "}
              per round.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Category breakdown with bars */}
      <Card size="sm" className="mb-4">
        <CardHeader>
          <CardTitle className="eyebrow">By category</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {sg.byCategory.map((c) => {
            const pct = Math.min(100, (Math.abs(c.perRound) / maxAbs) * 100);
            const positive = c.perRound > 0;
            return (
              <div key={c.category} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{c.category}</span>
                  <span className="text-muted-foreground">
                    <span
                      className={cn(
                        "font-mono font-semibold tabular-nums",
                        sgColor(c.perRound),
                      )}
                    >
                      {c.shots > 0 ? fmtSg(c.perRound) : "—"}
                    </span>
                    <span className="ml-1 text-xs">/rd</span>
                  </span>
                </div>
                {/* Centered bar: gains right (green), losses left (red). */}
                <div className="relative h-2 rounded-full bg-muted">
                  <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                  <div
                    className={cn(
                      "absolute top-0 h-full rounded-full",
                      positive ? "bg-positive" : "bg-destructive",
                    )}
                    style={{
                      width: `${pct / 2}%`,
                      left: positive ? "50%" : `${50 - pct / 2}%`,
                    }}
                  />
                </div>
                <div className="text-right text-[11px] text-muted-foreground">
                  {c.shots} shot{c.shots === 1 ? "" : "s"} · {fmtSg(c.sg)} total
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Decision vs execution (spec 2E): of lost strokes, how much is a
          thinking mistake (fix now, free) vs a good play executed poorly. */}
      {sg.decisionSplit.totalLoss < 0 && (
        <Card size="sm" className="mb-4">
          <CardHeader>
            <CardTitle className="eyebrow">Decision vs execution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Of the {fmtSg(sg.decisionSplit.totalLoss)} strokes you lost,{" "}
              <span className="font-semibold text-foreground">
                {Math.round((sg.decisionSplit.decisionPct ?? 0) * 100)}% were
                decisions
              </span>{" "}
              (fix by thinking, free) and{" "}
              <span className="font-semibold text-foreground">
                {Math.round((sg.decisionSplit.executionPct ?? 0) * 100)}% were
                execution
              </span>{" "}
              (fix by practice).
            </p>
            {/* Split bar: decision (left) vs execution (right). */}
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-chart-3"
                style={{ width: `${(sg.decisionSplit.decisionPct ?? 0) * 100}%` }}
              />
              <div
                className="h-full bg-destructive"
                style={{ width: `${(sg.decisionSplit.executionPct ?? 0) * 100}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full bg-chart-3" />
                  Decision (thinking)
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {fmtSg(sg.decisionSplit.decisionLoss)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    · {sg.decisionSplit.decisionShots} shot
                    {sg.decisionSplit.decisionShots === 1 ? "" : "s"}
                  </span>
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                  Execution (practice)
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {fmtSg(sg.decisionSplit.executionLoss)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    · {sg.decisionSplit.executionShots} shot
                    {sg.decisionSplit.executionShots === 1 ? "" : "s"}
                  </span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Domino view — situation created (forward-captured shots only) */}
      {sg.situations.length > 0 && (
        <Card size="sm" className="mb-4">
          <CardHeader>
            <CardTitle className="eyebrow">By situation created</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/40">
            {sg.situations.map((s) => (
              <div
                key={s.situation}
                className="flex items-center justify-between gap-4 py-2 text-sm"
              >
                <span className="text-muted-foreground">{s.situation}</span>
                <span className="text-right font-medium tabular-nums">
                  <span className={cn("font-mono", sgColor(s.sg / s.shots))}>
                    {fmtSg(s.sg / s.shots)}
                  </span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    /shot · {s.shots}
                  </span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Strokes gained vs the scratch (0-handicap) baseline (Broadie). 0 = you
        played that spot like a scratch golfer; negative = below that standard.
        Coverage is below 100% where historical shots lack a start lie or
        distance; new rounds capture both.
      </p>
    </main>
  );
}
