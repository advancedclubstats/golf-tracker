/**
 * Decision vs execution (spec 2E / dashboard answer #3). Of the strokes lost,
 * how much is a thinking mistake (fix now, free) vs a good play executed poorly
 * (fix by practice). Presentational; shared by the dashboard and the SG page.
 * Renders nothing when there is no loss to split.
 */

import { fmtSg } from "@/lib/format";
import type { DecisionExecutionSplit } from "@/lib/analytics/sg";

export function DecisionSplit({ split }: { split: DecisionExecutionSplit }) {
  if (split.totalLoss >= 0) return null;
  const decPct = Math.round((split.decisionPct ?? 0) * 100);
  const exePct = Math.round((split.executionPct ?? 0) * 100);

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        Of the {fmtSg(split.totalLoss)} strokes you lost,{" "}
        <span className="font-semibold text-foreground">{decPct}% were decisions</span>{" "}
        (fix by thinking, free) and{" "}
        <span className="font-semibold text-foreground">{exePct}% were execution</span>{" "}
        (fix by practice).
      </p>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-chart-3" style={{ width: `${decPct}%` }} />
        <div className="h-full bg-destructive" style={{ width: `${exePct}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-chart-3" />
            Decision (thinking)
          </span>
          <span className="font-mono font-semibold tabular-nums">
            {fmtSg(split.decisionLoss)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              · {split.decisionShots} shot{split.decisionShots === 1 ? "" : "s"}
            </span>
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
            Execution (practice)
          </span>
          <span className="font-mono font-semibold tabular-nums">
            {fmtSg(split.executionLoss)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              · {split.executionShots} shot{split.executionShots === 1 ? "" : "s"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
