/**
 * Dashboard view — presentational Server Component.
 *
 * Renders a computed `DashboardData` (from lib/analytics/dashboard). No data
 * fetching and no business logic here: the page fetches via lib/db, computes,
 * and passes the result in. Read-only, so no "use client" needed.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtVsPar, fmtVsParAvg, fmtPct, fmtNum, fmtSg, sgColorClass } from "@/lib/format";
// Note: prescriptions ("what to work on") now flow from Strokes Gained (spec 2D);
// the old green%/make%/quality heuristic card was removed and is rebuilt SG-driven.
import type { DashboardData } from "@/lib/analytics/dashboard";
import type { StrokesGained } from "@/lib/analytics/sg";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="eyebrow">{title}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border/40">{children}</CardContent>
    </Card>
  );
}

/** A label/value row. `mono` (default) sets stat values in the data face;
 *  pass `mono={false}` for descriptive sentence values. */
function Row({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right font-medium tabular-nums", mono && "font-mono")}>
        {value}
      </span>
    </div>
  );
}

export function Dashboard({ data, sg }: { data: DashboardData; sg: StrokesGained }) {
  const { snapshot, statLine, recentRounds, records } = data;

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
      <Section title="Snapshot">
        <Row label="Rounds Logged" value={snapshot.roundsLogged} />
        <Row label="Holes Logged" value={snapshot.holesLogged} />
        <Row label="Total vs Par" value={fmtVsPar(snapshot.totalVsPar)} />
        <Row label="Avg vs Par / Round" value={fmtVsParAvg(snapshot.avgVsParPerRound)} />
        <Row label="Avg vs Par / Hole" value={fmtVsParAvg(snapshot.avgVsParPerHole)} />
      </Section>

      <Section title="Stat Line">
        <Row label="Fairways Hit" value={fmtPct(statLine.fwPct)} />
        <Row label="Greens in Regulation" value={fmtPct(statLine.girPct)} />
        <Row label="Scrambling" value={fmtPct(statLine.scramblePct)} />
        <Row label="Avg Putts / Hole" value={fmtNum(statLine.avgPutts)} />
        <Row label="3-Putt %" value={fmtPct(statLine.threePuttPct)} />
      </Section>

      {/* Strokes gained by category — the real diagnosis (replaces the old
          par-relative "strokes lost"). Per round vs the scratch baseline. */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="eyebrow">
            <Link href="/stats/sg" className="transition-colors hover:text-foreground">
              Strokes Gained →
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/40">
          {sg.coveredShots > 0 ? (
            <>
              {sg.byCategory.map((c) => (
                <div
                  key={c.category}
                  className="flex items-center justify-between gap-4 py-2 text-sm"
                >
                  <span className="text-muted-foreground">{c.category}</span>
                  <span
                    className={cn(
                      "text-right font-mono font-medium tabular-nums",
                      sgColorClass(c.perRound),
                    )}
                  >
                    {c.shots > 0 ? fmtSg(c.perRound) : "—"}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 py-2 text-sm">
                <span className="font-medium">Per round vs scratch</span>
                <span
                  className={cn(
                    "text-right font-mono font-semibold tabular-nums",
                    sgColorClass(sg.perRound),
                  )}
                >
                  {fmtSg(sg.perRound)}
                </span>
              </div>
            </>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">
              Log a round with a start lie and distance to see strokes gained.
            </p>
          )}
        </CardContent>
      </Card>

      <Section title="Recent Rounds">
        {recentRounds.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">Date</th>
                  <th className="py-2 px-2 font-medium">Holes</th>
                  <th className="py-2 px-2 font-medium">Strokes</th>
                  <th className="py-2 pl-2 text-right font-medium">vs Par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {recentRounds.map((r) => (
                  <tr key={r.roundId}>
                    <td className="py-2 pr-2">{r.date ?? "—"}</td>
                    <td className="py-2 px-2">{r.holes}</td>
                    <td className="py-2 px-2">{r.strokes}</td>
                    <td className="py-2 pl-2 text-right font-medium">{fmtVsPar(r.vsPar)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">No rounds yet.</p>
        )}
      </Section>

      <Section title="Course Records">
        {records.bestRound && (
          <Row
            label="Best Round"
            mono={false}
            value={`${records.bestRound.holes} holes · ${records.bestRound.strokes} (${fmtVsPar(records.bestRound.vsPar)})`}
          />
        )}
        {records.worstRound && (
          <Row
            label="Worst Round"
            mono={false}
            value={`${records.worstRound.holes} holes · ${records.worstRound.strokes} (${fmtVsPar(records.worstRound.vsPar)})`}
          />
        )}
        {records.bestHole && (
          <Row
            label="Best Hole"
            mono={false}
            value={`Hole ${records.bestHole.hole} (par ${records.bestHole.par}) · ${fmtVsPar(records.bestHole.vsPar)} across ${records.bestHole.rounds} round${records.bestHole.rounds === 1 ? "" : "s"}`}
          />
        )}
        <Row label="Birdies" value={records.birdies} />
        <Row label="Eagles or better" value={records.eagles} />
      </Section>
    </div>
  );
}
