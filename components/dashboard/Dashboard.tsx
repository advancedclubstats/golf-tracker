/**
 * Dashboard view — presentational Server Component.
 *
 * Renders a computed `DashboardData` (from lib/analytics/dashboard). No data
 * fetching and no business logic here: the page fetches via lib/db, computes,
 * and passes the result in. Read-only, so no "use client" needed.
 */

import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtVsPar, fmtVsParAvg, fmtPct, fmtNum } from "@/lib/format";
import type {
  DashboardData,
  MulliganCategory,
} from "@/lib/analytics/dashboard";

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

const MULLIGAN_LABELS: Record<MulliganCategory, string> = {
  tee: "Tee / Long Game",
  approach: "Approach",
  shortGame: "Short Game",
  putt: "Putts",
};

export function Dashboard({ data }: { data: DashboardData }) {
  const { snapshot, statLine, strokesLost, whatToWorkOn, recentRounds, records, mulligans } =
    data;

  const workItems: { area: string; detail: string }[] = [];
  if (whatToWorkOn.worstHole) {
    const h = whatToWorkOn.worstHole;
    workItems.push({
      area: "Worst Hole",
      detail: `Hole ${h.hole} (par ${h.par}) · ${fmtVsPar(h.vsPar)} across ${h.rounds} round${h.rounds === 1 ? "" : "s"}`,
    });
  }
  if (whatToWorkOn.worstApproach) {
    const a = whatToWorkOn.worstApproach;
    workItems.push({
      area: "Worst Approach",
      detail: `${a.label} · ${fmtPct(a.greenHitPct)} greens (${a.shots} shots)`,
    });
  }
  if (whatToWorkOn.worstPutt) {
    const p = whatToWorkOn.worstPutt;
    workItems.push({
      area: "Worst Putt Distance",
      detail: `${p.label} · ${fmtPct(p.makePct)} made (${p.putts} putts)`,
    });
  }
  if (whatToWorkOn.worstClub) {
    const c = whatToWorkOn.worstClub;
    workItems.push({
      area: "Worst Club",
      detail: `${c.club} · ${c.avgQuality} avg quality (${c.shots} shots)`,
    });
  }

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

      <Section title="Strokes Lost">
        {strokesLost.total > 0 ? (
          <>
            <Row
              label="Tee / Long Game"
              value={`${strokesLost.tee} · ${fmtPct(strokesLost.teePct)}`}
            />
            <Row
              label="Approach / Short Game"
              value={`${strokesLost.approach} · ${fmtPct(strokesLost.approachPct)}`}
            />
            <Row
              label="Putting"
              value={`${strokesLost.putting} · ${fmtPct(strokesLost.puttingPct)}`}
            />
            <Row label="Total" value={strokesLost.total} />
          </>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            At or under par across all logged holes — nothing lost yet.
          </p>
        )}
      </Section>

      {/* The one lime "edge" moment per screen — the insight that earns it. */}
      <Card size="sm" className="border-transparent bg-highlight text-highlight-foreground shadow-sm">
        <CardHeader>
          <CardTitle className="eyebrow text-highlight-foreground/70">
            What to Work On
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-highlight-foreground/15">
          {workItems.length > 0 ? (
            workItems.map((w) => (
              <div
                key={w.area}
                className="flex items-center justify-between gap-4 py-2 text-sm"
              >
                <span className="font-medium">{w.area}</span>
                <span className="text-right text-highlight-foreground/80">
                  {w.detail}
                </span>
              </div>
            ))
          ) : (
            <p className="py-2 text-sm text-highlight-foreground/70">
              Not enough data yet — log a few more rounds.
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

      <Section title="Shots You'd Take Back">
        {mulligans.total > 0 ? (
          <>
            <Row label="Total" value={mulligans.total} />
            <Row label="Per Round" value={fmtNum(mulligans.perRound)} />
            {(Object.keys(MULLIGAN_LABELS) as MulliganCategory[]).map((cat) => (
              <Row key={cat} label={MULLIGAN_LABELS[cat]} value={mulligans.byCategory[cat]} />
            ))}
          </>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            No mulligans flagged.
          </p>
        )}
      </Section>
    </div>
  );
}
