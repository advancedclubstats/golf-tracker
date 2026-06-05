import { getAllShots } from "@/lib/db/shots";
import { getAllRounds } from "@/lib/db/rounds";
import { getAllCourseTees, getAllTeeYardages } from "@/lib/db/courses";
import { computeStrokesGained, fillTeeDistances } from "@/lib/analytics/sg";
import { PageHeader } from "@/components/nav/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** round_id → hole → representative tee yardage, for defaulting tee-shot
 *  distances (average across a course's tees; tee precision isn't needed). */
function buildTeeYardages(
  rounds: { id: string; course_id: string | null }[],
  tees: { id: string; course_id: string }[],
  yardages: { tee_id: string; hole_number: number; yardage: number }[],
): Record<string, Record<number, number>> {
  const teeCourse = new Map(tees.map((t) => [t.id, t.course_id]));
  const byCourseHole: Record<string, Record<number, number[]>> = {};
  for (const y of yardages) {
    const course = teeCourse.get(y.tee_id);
    if (!course) continue;
    ((byCourseHole[course] ??= {})[y.hole_number] ??= []).push(y.yardage);
  }
  const repByCourse: Record<string, Record<number, number>> = {};
  for (const [course, holes] of Object.entries(byCourseHole)) {
    repByCourse[course] = {};
    for (const [hole, arr] of Object.entries(holes)) {
      repByCourse[course][Number(hole)] = Math.round(
        arr.reduce((a, b) => a + b, 0) / arr.length,
      );
    }
  }
  const out: Record<string, Record<number, number>> = {};
  for (const r of rounds) {
    if (r.course_id && repByCourse[r.course_id]) out[r.id] = repByCourse[r.course_id];
  }
  return out;
}

/** Signed, 2-dp strokes-gained string. */
function fmtSg(n: number): string {
  const r = Math.round(n * 100) / 100;
  return `${r >= 0 ? "+" : ""}${r.toFixed(2)}`;
}

function sgColor(n: number): string {
  return n > 0.001 ? "text-positive" : n < -0.001 ? "text-destructive" : "text-foreground";
}

export default async function StrokesGainedPage() {
  const [shots, rounds, tees, yardages] = await Promise.all([
    getAllShots(),
    getAllRounds(),
    getAllCourseTees(),
    getAllTeeYardages(),
  ]);
  // Default skipped tee-shot distances from the course so off-the-tee SG works.
  const enriched = fillTeeDistances(
    shots,
    buildTeeYardages(rounds, tees, yardages),
  );
  const sg = computeStrokesGained(enriched);

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
          <CardTitle className="eyebrow">Per round vs tour</CardTitle>
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
        Strokes gained vs the PGA Tour benchmark (Broadie). Positive = better than
        tour average from that spot; a scratch player reads negative, and the
        category ranking is the actionable part. Coverage is below 100% where
        historical shots lack a start lie or distance; new rounds capture both.
      </p>
    </main>
  );
}
