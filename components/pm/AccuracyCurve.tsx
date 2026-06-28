/**
 * Cumulative prediction-accuracy curve for the PM-loop dashboard.
 *
 * A small, dependency-free inline SVG (no Chart.js): the rising line is the
 * engine's running hit-rate at predicting Matt's call; the dashed line is the
 * 50% coin-flip baseline. Server-safe (no hooks). Colors come from the app's
 * CSS variables — no hardcoded hex. Only rendered once enough predictions exist
 * to be a trend (the page shows an honest early state below that).
 */

import type { AccuracyPoint } from "@/lib/pm/decisions";

const VB_W = 720;
const VB_H = 200;
const M = { top: 12, right: 12, bottom: 24, left: 34 };
const PLOT_W = VB_W - M.left - M.right;
const PLOT_H = VB_H - M.top - M.bottom;

/** % (0–100) → y pixel. */
const yFor = (p: number) => M.top + PLOT_H * (1 - p / 100);
/** index → x pixel (single point sits centered). */
const xFor = (i: number, n: number) =>
  n <= 1 ? M.left + PLOT_W / 2 : M.left + (PLOT_W * i) / (n - 1);

export function AccuracyCurve({ points }: { points: AccuracyPoint[] }) {
  const n = points.length;
  const coords = points.map((p, i) => ({ x: xFor(i, n), y: yFor(p.accPct) }));
  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      role="img"
      aria-label="Cumulative prediction accuracy over time"
      className="block"
    >
      {/* y gridlines + labels at 0 / 50 / 100% */}
      {[0, 50, 100].map((t) => (
        <g key={t}>
          <line
            x1={M.left}
            x2={VB_W - M.right}
            y1={yFor(t)}
            y2={yFor(t)}
            stroke="var(--border)"
            strokeWidth="1"
          />
          <text
            x={M.left - 6}
            y={yFor(t) + 3}
            textAnchor="end"
            fontSize="10"
            fill="var(--muted-foreground)"
          >
            {t}%
          </text>
        </g>
      ))}

      {/* 50% coin-flip baseline */}
      <line
        x1={M.left}
        x2={VB_W - M.right}
        y1={yFor(50)}
        y2={yFor(50)}
        stroke="var(--clay)"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />

      {/* the accuracy line + points */}
      <polyline
        points={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3.5" fill="var(--primary)" />
      ))}

      {/* first / last date ticks */}
      {n > 0 && (
        <>
          <text
            x={M.left}
            y={VB_H - 6}
            textAnchor="start"
            fontSize="10"
            fill="var(--muted-foreground)"
          >
            {points[0].date}
          </text>
          {n > 1 && (
            <text
              x={VB_W - M.right}
              y={VB_H - 6}
              textAnchor="end"
              fontSize="10"
              fill="var(--muted-foreground)"
            >
              {points[n - 1].date}
            </text>
          )}
        </>
      )}
    </svg>
  );
}
