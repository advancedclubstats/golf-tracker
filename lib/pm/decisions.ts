/**
 * PM-loop decision log — types + pure summary.
 *
 * Backs the owner-only `/pm` route, which mirrors `docs/pm-loop/dashboard.html`
 * inside the app. This module is pure (no fs, no Supabase): the page reads
 * `decisions.json` at request time and hands the parsed array here. Keeping the
 * math pure makes the cards / accuracy curve testable without a filesystem.
 *
 * `decisions.json` is the single source of truth (the standalone HTML reads the
 * same file); never duplicate the data here.
 */

export type DecisionKind = "shipped" | "killed" | "deferred";
export type PredictionKind = "ship" | "kill" | "defer";

/** One row of the decision log (shape of each `decisions.json` entry). */
export interface Decision {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  title: string;
  /** Who proposed it — "matt" (human) or "ai" (the model). */
  source: string;
  decision: DecisionKind;
  reason: string;
  /** Which job it served — "jtbd" / "portfolio" / "both". */
  job: string;
  /** The engine's locked guess before the call, or null for pre-engine rows. */
  prediction: PredictionKind | null;
  /** Whether that guess matched the actual call (null when no prediction). */
  predictedCorrect: boolean | null;
  undeferWhen: string | null;
  outcome: string | null;
}

/** One cumulative-accuracy point: share correct through the i-th prediction. */
export interface AccuracyPoint {
  date: string;
  /** Cumulative accuracy through this prediction, 0–100. */
  accPct: number;
}

export interface PmSummary {
  total: number;
  shipped: number;
  killed: number;
  deferred: number;
  /** Killed as a share of decided (ship + kill) calls, 0–100. */
  killRate: number;
  /** How many decisions carried an engine prediction. */
  predictionsLogged: number;
  /** Share of those predictions that were correct (0–100), or null if none. */
  accuracyPct: number | null;
  /** Cumulative accuracy in prediction order — the rising-line data. */
  curve: AccuracyPoint[];
  /** Most recent decision date in the log. */
  mostRecent: string;
  /** Feed, newest first (ties broken by id desc). */
  feed: Decision[];
}

const pct = (num: number, den: number): number =>
  den === 0 ? 0 : Math.round((num / den) * 100);

/** Summary metrics for the dashboard. Pure; mirrors the standalone HTML. */
export function summarizeDecisions(decisions: readonly Decision[]): PmSummary {
  const shipped = decisions.filter((d) => d.decision === "shipped").length;
  const killed = decisions.filter((d) => d.decision === "killed").length;
  const deferred = decisions.filter((d) => d.decision === "deferred").length;

  // Predictions in chronological order build the cumulative accuracy curve.
  const predicted = decisions
    .filter((d) => d.prediction != null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  let correct = 0;
  const curve: AccuracyPoint[] = predicted.map((d, i) => {
    if (d.predictedCorrect) correct++;
    return { date: d.date, accPct: pct(correct, i + 1) };
  });

  const feed = [...decisions].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );

  return {
    total: decisions.length,
    shipped,
    killed,
    deferred,
    killRate: pct(killed, shipped + killed),
    predictionsLogged: predicted.length,
    accuracyPct: predicted.length === 0 ? null : pct(correct, predicted.length),
    curve,
    mostRecent: decisions.reduce((a, d) => (d.date > a ? d.date : a), ""),
    feed,
  };
}
