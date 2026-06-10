/* Shared dashboard data — single source of truth for all three directions.
   Numbers lifted verbatim from the production dashboard screenshot. */
window.DASH = {
  hero: { title: "Putts 10–20 ft", sg: "−0.90", sub: "6% made vs scratch ≈ 22% · across 48 shots" },

  scoringNet: "+14%",
  bands: [
    { key: "eagle",  label: "Eagle+",  rate: 2,  target: 1,  delta: "+1", good: true },
    { key: "birdie", label: "Birdie",  rate: 17, target: 13, delta: "+4", good: true },
    { key: "par",    label: "Par",     rate: 58, target: 58, delta: null, good: null },
    { key: "bogey",  label: "Bogey",   rate: 18, target: 24, delta: "−6", good: true },
    { key: "double", label: "Double+", rate: 5,  target: 4,  delta: "+1", good: false },
  ],

  strokesLost: [
    { label: "Putting",     v: "−1.32", neg: true },
    { label: "Approach",    v: "−0.52", neg: true },
    { label: "Short game",  v: "+0.03", neg: false },
    { label: "Off the tee", v: "+0.83", neg: false },
  ],
  strokesLostTotal: "−0.99",

  decision: {
    totalLost: "−73.93",
    execPct: 100,
    decision: { v: "+0.00", shots: 0 },
    execution: { v: "−73.93", shots: 250 },
  },

  leaks: [
    { rank: 1, title: "Putts 10–20 ft",      sg: "−0.90", sub: "6% made · scratch ≈ 22%", shots: 48 },
    { rank: 2, title: "Approach 75–125 yds", sg: "−0.52", sub: "68% greens · scratch ≈ 70%", shots: 40 },
    { rank: 3, title: "Putts 6–10 ft",       sg: "−0.48", sub: "28% made · scratch ≈ 50%", shots: 25 },
    { rank: 4, title: "SW",                  sg: "−0.19", sub: null, shots: 20 },
    { rank: 5, title: "Approach 175+ yds",   sg: "−0.15", sub: "38% greens · scratch ≈ 42%", shots: 32 },
  ],
  earlyReads: [
    { title: "6i", sg: "−0.20", shots: 9 },
    { title: "8i", sg: "−0.13", shots: 7 },
    { title: "7i", sg: "−0.10", shots: 12 },
    { title: "5i", sg: "−0.08", shots: 2 },
    { title: "GW", sg: "−0.08", shots: 12 },
  ],

  snapshot: [
    { label: "Rounds Logged", value: "11" },
    { label: "Holes Logged", value: "169" },
    { label: "Total vs Par", value: "+15" },
    { label: "Avg vs Par / Round", value: "+1.36" },
    { label: "Avg vs Par / Hole", value: "+0.09" },
  ],
  statLine: [
    { label: "Fairways Hit", value: "38%" },
    { label: "Greens in Regulation", value: "69%" },
    { label: "Scrambling", value: "37%" },
    { label: "Avg Putts / Hole", value: "1.72" },
    { label: "3-Putt %", value: "4%" },
  ],
  recentRounds: [
    { date: "2026-06-08", holes: 9,  strokes: 34, vsPar: "−2" },
    { date: "2026-06-07", holes: 18, strokes: 80, vsPar: "+9" },
    { date: "2026-06-06", holes: 18, strokes: 77, vsPar: "+6" },
    { date: "2026-06-04", holes: 18, strokes: 70, vsPar: "−1" },
    { date: "2026-06-03", holes: 9,  strokes: 39, vsPar: "+2" },
  ],
  records: [
    { label: "Best Round", value: "16 holes · 61 (-3)" },
    { label: "Worst Round", value: "18 holes · 80 (+9)" },
    { label: "Best Hole", value: "Hole 2 (par 5) · -6 across 10 rounds" },
    { label: "Birdies", value: "29" },
    { label: "Eagles or better", value: "3" },
  ],

  // band fill colors (token-driven)
  bandColor: {
    eagle: "var(--fairway-600)",
    birdie: "color-mix(in oklab, var(--fairway-600) 70%, transparent)",
    par: "color-mix(in oklab, var(--ink-500) 40%, transparent)",
    bogey: "color-mix(in oklab, var(--clay-500) 75%, transparent)",
    double: "var(--negative)",
  },
};
