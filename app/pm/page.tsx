/**
 * /pm — owner-only PM-loop decision log.
 *
 * Mirrors `docs/pm-loop/dashboard.html` inside the app, rendered in the app's
 * own design system (Calm Brief column, the three fonts, CSS-var tokens). It is
 * internal tooling, not a product feature: deliberately owner-gated (visitors
 * 404, never see it) and intentionally absent from `decisions.json` itself (that
 * log stays a clean record of Round Recall product calls).
 *
 * Reads `docs/pm-loop/decisions.json` — the single source of truth the standalone
 * HTML also reads. Imported as a module so the data is bundled into the build
 * (no runtime fs read / `process.cwd()` / output-file-tracing dependency, which
 * was fragile in the Vercel function). In production the file is immutable per
 * deploy anyway, so a build-time import is exactly as fresh as a request-time read.
 */

import { notFound } from "next/navigation";
import { isOwner } from "@/lib/auth/owner";
import {
  summarizeDecisions,
  type Decision,
  type DecisionKind,
} from "@/lib/pm/decisions";
import { AccuracyCurve } from "@/components/pm/AccuracyCurve";
import decisionsData from "@/docs/pm-loop/decisions.json";

export const dynamic = "force-dynamic";

/** Below this many predictions the curve is an honest early state, not a line. */
const CURVE_MIN_POINTS = 3;

/** The decision log, bundled from the repo's single source of truth. */
function loadDecisionLog(): Decision[] {
  if (!Array.isArray(decisionsData)) {
    throw new Error("decisions.json did not parse to an array");
  }
  return decisionsData as Decision[];
}

const BADGE: Record<DecisionKind, string> = {
  shipped: "bg-accent text-accent-foreground",
  killed: "bg-destructive/10 text-destructive",
  deferred: "bg-clay/10 text-clay",
};

function PredictionTag({ d }: { d: Decision }) {
  if (d.prediction == null) {
    return <span className="text-ink-300">no prediction (pre-engine)</span>;
  }
  const hit = d.predictedCorrect;
  return (
    <span className={hit ? "text-positive" : "text-destructive"}>
      model guessed {d.prediction} {hit ? "✓" : "✗"}
    </span>
  );
}

function Card({
  label,
  value,
  foot,
  accent = false,
}: {
  label: string;
  value: string | number;
  foot?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="eyebrow text-[10px] text-muted-foreground">{label}</p>
      <p
        className={`font-heading text-3xl font-semibold leading-none ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {foot && <p className="mt-1.5 text-[11px] text-muted-foreground">{foot}</p>}
    </div>
  );
}

export default async function PmDashboardPage() {
  // Owner-only: visitors must never see this internal tooling. 404 (not a
  // redirect) so the route's existence doesn't leak.
  if (!(await isOwner())) notFound();

  const s = summarizeDecisions(loadDecisionLog());

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-16">
      <p className="eyebrow mb-1">Round Recall · the PM loop</p>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Decision log
      </h1>
      <p className="mt-1 mb-7 text-sm text-muted-foreground">
        Every product call, who proposed it, and one line of why. The model
        proposes; the human decides. Live from{" "}
        <code className="font-mono text-[12px]">decisions.json</code>.
      </p>

      {/* Metric cards */}
      <div className="mb-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="decisions logged" value={s.total} />
        <Card label="kill rate" value={`${s.killRate}%`} foot="of ship/kill calls" />
        <Card label="shipped" value={s.shipped} foot={`${s.deferred} deferred`} />
        <Card
          label="model predicts you"
          value={s.accuracyPct == null ? "—" : `${s.accuracyPct}%`}
          foot={`${s.predictionsLogged} prediction${s.predictionsLogged === 1 ? "" : "s"} logged`}
          accent
        />
      </div>

      {/* Accuracy curve */}
      <h2 className="font-heading text-lg font-medium">
        Can the model predict your call yet?
      </h2>
      <p className="mt-1 mb-4 text-[13px] text-muted-foreground">
        Share of decisions where the engine&rsquo;s locked guess matched the
        actual call, accumulating by cycle. The rising line, once it exists, is
        the proof the taste is consistent.
      </p>
      <div className="mb-9 rounded-xl border border-border bg-card p-5">
        {s.predictionsLogged >= CURVE_MIN_POINTS ? (
          <AccuracyCurve points={s.curve} />
        ) : (
          <div className="flex items-start gap-3">
            <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-highlight" />
            <p className="text-[14px] leading-relaxed text-ink-700">
              {s.predictionsLogged === 0 ? (
                <>
                  No predictions logged yet. Every historical decision here was
                  made before the engine was running, so it has no guess to
                  score. From the next ideation cycle the engine locks a ship /
                  kill / defer prediction before it sees your call, and this line
                  starts to fill in — intentionally empty, not faked.
                </>
              ) : (
                <>
                  {s.predictionsLogged} prediction
                  {s.predictionsLogged === 1 ? "" : "s"} logged so far
                  {s.accuracyPct != null && <> ({s.accuracyPct}% correct)</>} —
                  too few for a trend line yet. The engine locks a ship / kill /
                  defer guess before each call; the curve appears once a few have
                  accumulated. Sparse on purpose, never faked.
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Decision feed */}
      <h2 className="font-heading text-lg font-medium">Decisions</h2>
      <p className="mt-1 mb-3 text-[13px] text-muted-foreground">
        {s.total} decisions · newest first
      </p>
      <div className="border-t border-border">
        {s.feed.map((d) => (
          <article
            key={d.id}
            className="flex items-start gap-3.5 border-b border-border py-4"
          >
            <span
              className={`eyebrow mt-0.5 shrink-0 rounded-md px-2 py-1 text-[10px] ${BADGE[d.decision]}`}
            >
              {d.decision}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium leading-snug">{d.title}</h3>
              <p className="mt-0.5 text-[14px] text-ink-700">{d.reason}</p>
              <p className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-[11px] text-muted-foreground">
                <span>
                  {d.id} · {d.date}
                </span>
                <span>proposed by {d.source}</span>
                <span>{d.job}</span>
                <PredictionTag d={d} />
              </p>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-6 font-mono text-[11px] text-muted-foreground">
        {s.total} decisions · most recent {s.mostRecent} · source of truth:
        decisions.json
      </p>
    </main>
  );
}
