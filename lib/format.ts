/**
 * Display formatting helpers (presentation layer).
 *
 * The analytics layer returns raw numbers and `null` for "not applicable".
 * These turn them into display strings. Kept separate from `lib/analytics/` so
 * the analytics stay pure and the UI owns formatting.
 */

/** Vs-par as a signed integer: 0 → "E", 3 → "+3", -1 → "-1". */
export function fmtVsPar(n: number): string {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

/** Vs-par average, two decimals: 0 → "E", 0.5 → "+0.50", -1.25 → "-1.25". */
export function fmtVsParAvg(n: number): string {
  if (n === 0) return "E";
  const s = n.toFixed(2);
  return n > 0 ? `+${s}` : s; // negatives already carry their sign
}

/** Fraction → percent, or an em dash for `null`: 0.75 → "75%", null → "—". */
export function fmtPct(n: number | null): string {
  return n == null ? "—" : `${Math.round(n * 100)}%`;
}

/** A number, or an em dash for `null`. */
export function fmtNum(n: number | null): string {
  return n == null ? "—" : String(n);
}
