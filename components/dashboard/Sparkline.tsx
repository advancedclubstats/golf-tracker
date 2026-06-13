/**
 * Tiny inline-SVG sparkline (momentum rows + the Holes table later).
 *
 * Algorithm from the design handoff (`design_handoff_momentum` §Sparkline):
 * include 0 (scratch) in the domain so the dotted baseline is always in range;
 * a soft gradient fill under the polyline; a filled "now" dot at the last point.
 * Color is `currentColor` — set the direction via a text-color class on the
 * parent (text-positive when gaining, text-destructive when slipping).
 */

import { useId } from "react";

export function Sparkline({
  points,
  width = 92,
  height = 30,
  className,
}: {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const gradId = useId();
  const pad = 3;
  if (points.length < 2) {
    return <svg width={width} height={height} aria-hidden className={className} />;
  }

  const min = Math.min(...points, 0);
  const max = Math.max(...points, 0);
  const range = max - min || 1;
  const step = (width - 2 * pad) / (points.length - 1);
  const px = (i: number) => pad + i * step;
  const py = (p: number) => pad + (height - 2 * pad) * (1 - (p - min) / range);

  const coords = points.map((p, i) => `${px(i).toFixed(1)},${py(p).toFixed(1)}`);
  const line = coords.join(" ");
  const last = points.length - 1;
  const area = `${px(0).toFixed(1)},${height} ${line} ${px(last).toFixed(1)},${height}`;
  const zeroY = py(0).toFixed(1);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* dotted zero / scratch baseline */}
      <line
        x1={pad}
        y1={zeroY}
        x2={width - pad}
        y2={zeroY}
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={px(last)} cy={py(points[last])} r="2.8" fill="currentColor" />
    </svg>
  );
}
