/**
 * Dashboard view — presentational Server Component.
 *
 * Calm Brief (design Direction D): a flat, editorial, single-column layout.
 * No card chrome — typographic scale and hairline rules carry the hierarchy;
 * lime appears only on the hero (and the header's New Round pill). Section
 * rhythm is a consistent 36px.
 *
 * Renders a computed `DashboardData` (from lib/analytics/dashboard). No data
 * fetching and no business logic here: the page fetches via lib/db, computes,
 * and passes the result in. Read-only, so no "use client" needed.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { fmtVsPar, fmtVsParAvg, fmtPct, fmtNum, fmtSg, sgColorClass } from "@/lib/format";
import type { DashboardData } from "@/lib/analytics/dashboard";
import type { StrokesGained } from "@/lib/analytics/sg";
import type { Leak } from "@/lib/analytics/leaks";
import type { Momentum } from "@/lib/analytics/momentum";
import type { RecentForm } from "@/lib/analytics/recentForm";
import type { Streaks } from "@/lib/analytics/streaks";
import { LeakList } from "@/components/dashboard/LeakList";
import { StreaksSection } from "@/components/dashboard/StreaksSection";
import { BiggestLeakHero } from "@/components/dashboard/BiggestLeakHero";
import { ScoringShapeSection } from "@/components/dashboard/ScoringShapeSection";
import { MomentumSection } from "@/components/dashboard/MomentumSection";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="eyebrow mb-4">{title}</p>
      {children}
    </section>
  );
}

/** A hairline key/value row (strokes-lost / course-records weight). */
function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3.5 py-[9px] text-[14.5px]">
      <span className="whitespace-nowrap text-ink-700">{label}</span>
      <span className="text-right font-mono font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** The tighter two-up ledger row (Snapshot / Stat line). */
function DuoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[7.5px]">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span className="text-right font-mono text-[13px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function Dashboard({
  data,
  sg,
  leaks,
  momentum,
  recentForm,
  streaks,
}: {
  data: DashboardData;
  sg: StrokesGained;
  leaks: Leak[];
  momentum: Momentum;
  recentForm: RecentForm;
  streaks: Streaks;
}) {
  const { snapshot, statLine, scoringShape, recentRounds, records } = data;
  // Spec Part 3 item 2: SG categories ranked by recoverable/round (worst first).
  const rankedCategories = [...sg.byCategory].sort((a, b) => a.perRound - b.perRound);

  return (
    <div className="flex flex-col gap-9">
      {/* The edge moment: the single biggest prescribable leak. */}
      <BiggestLeakHero leaks={leaks} recentForm={recentForm} />

      {/* Dashboard answer order (spec Part 3). 1 — Scoring shape. */}
      <ScoringShapeSection shape={scoringShape} />

      {/* 2 — Where strokes are lost: the per-round total as the big (but
          hero-subordinate) number, then SG categories ranked vs scratch.
          Tap through to the SG page for the full breakdown. */}
      <section>
        <p className="eyebrow mb-4">
          <Link href="/stats/sg" className="transition-colors hover:text-foreground">
            Where strokes are lost
          </Link>
        </p>
        {sg.coveredShots > 0 ? (
          <>
            <div
              className={cn(
                "font-mono text-[40px] font-bold leading-[0.95] tracking-[-0.03em] tabular-nums",
                sgColorClass(sg.perRound),
              )}
            >
              {fmtSg(sg.perRound)}
            </div>
            <div className="mb-3.5 mt-1.5 text-[13px] text-muted-foreground">
              per round vs scratch
            </div>
            <div>
              {rankedCategories.map((c) => (
                <div
                  key={c.category}
                  className="flex items-baseline justify-between gap-3.5 border-t border-border py-2.5"
                >
                  <span className="whitespace-nowrap text-[15px] text-ink-700">{c.category}</span>
                  <span
                    className={cn(
                      "font-mono text-base font-semibold tabular-nums",
                      sgColorClass(c.perRound),
                    )}
                  >
                    {c.shots > 0 ? `${fmtSg(c.perRound)}/rd` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            Log a round with a start lie and distance to see strokes gained.
          </p>
        )}
      </section>

      {/* Momentum (Ask 1): the *motion* — which categories are gaining/slipping —
          sits between the static "where lost" picture and the prescription. */}
      <MomentumSection momentum={momentum} />

      {/* 3 — Specifics, gated by sample: the ranked leak list, each row drillable
          to its shots; under-sampled cuts show as early-read chips, never
          prescribed. */}
      <Section title="What to work on">
        <LeakList leaks={leaks} />
      </Section>

      {/* Quieter reference: two-up ledger. */}
      <section className="grid grid-cols-2 gap-x-[30px]">
        <div>
          <p className="eyebrow mb-4">Snapshot</p>
          <div className="divide-y divide-border">
            <DuoRow label="Rounds Logged" value={snapshot.roundsLogged} />
            <DuoRow label="Holes Logged" value={snapshot.holesLogged} />
            <DuoRow label="Total vs Par" value={fmtVsPar(snapshot.totalVsPar)} />
            <DuoRow label="Avg vs Par / Round" value={fmtVsParAvg(snapshot.avgVsParPerRound)} />
            <DuoRow label="Avg vs Par / Hole" value={fmtVsParAvg(snapshot.avgVsParPerHole)} />
          </div>
        </div>
        <div>
          <p className="eyebrow mb-4">Stat line</p>
          <div className="divide-y divide-border">
            <DuoRow label="Fairways Hit" value={fmtPct(statLine.fwPct)} />
            <DuoRow label="Greens in Regulation" value={fmtPct(statLine.girPct)} />
            <DuoRow label="Scrambling" value={fmtPct(statLine.scramblePct)} />
            <DuoRow label="Avg Putts / Hole" value={fmtNum(statLine.avgPutts)} />
            <DuoRow label="3-Putt %" value={fmtPct(statLine.threePuttPct)} />
          </div>
        </div>
      </section>

      <Section title="Recent rounds">
        {recentRounds.length > 0 ? (
          <table className="w-full font-mono text-[13px] tabular-nums">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.05em] text-ink-300">
                <th className="pb-2 pr-2 font-semibold">Date</th>
                <th className="pb-2 pr-2 font-semibold">Holes</th>
                <th className="pb-2 pr-2 font-semibold">Strokes</th>
                <th className="pb-2 text-right font-semibold">vs Par</th>
              </tr>
            </thead>
            <tbody>
              {recentRounds.map((r) => (
                <tr key={r.roundId} className="border-t border-border">
                  <td className="py-[7px] pr-2 text-ink-700">{r.date ?? "—"}</td>
                  <td className="py-[7px] pr-2 text-ink-700">{r.holes}</td>
                  <td className="py-[7px] pr-2 text-ink-700">{r.strokes}</td>
                  <td className="py-[7px] text-right text-ink-700">{fmtVsPar(r.vsPar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">No rounds yet.</p>
        )}
      </Section>

      {/* Celebratory counterweight to the SG spine — sits with the records. */}
      <StreaksSection streaks={streaks} />

      <Section title="Course records">
        <div className="divide-y divide-border">
          {records.bestRound && (
            <Row
              label="Best Round"
              value={`${records.bestRound.holes} holes · ${records.bestRound.strokes} (${fmtVsPar(records.bestRound.vsPar)})`}
            />
          )}
          {records.worstRound && (
            <Row
              label="Worst Round"
              value={`${records.worstRound.holes} holes · ${records.worstRound.strokes} (${fmtVsPar(records.worstRound.vsPar)})`}
            />
          )}
          {records.bestHole && (
            <Row
              label="Best Hole"
              value={`Hole ${records.bestHole.hole} (par ${records.bestHole.par}) · ${fmtVsPar(records.bestHole.vsPar)} across ${records.bestHole.rounds} round${records.bestHole.rounds === 1 ? "" : "s"}`}
            />
          )}
          {records.worstHole && (
            <Row
              label="Worst Hole"
              value={`Hole ${records.worstHole.hole} (par ${records.worstHole.par}) · ${fmtVsPar(records.worstHole.vsPar)} across ${records.worstHole.rounds} round${records.worstHole.rounds === 1 ? "" : "s"}`}
            />
          )}
          <Row label="Birdies" value={records.birdies} />
          <Row label="Eagles or better" value={records.eagles} />
        </div>
      </Section>
    </div>
  );
}
