/* ============================================================================
   distance-data.js  —  Distance Summary, redesigned data layer (mock)
   ----------------------------------------------------------------------------
   Mirrors the real shape of lib/analytics/distanceSummary.ts: every per-bucket
   figure + its Tour band-average benchmark already exists. The ONLY additions
   the redesign needs are arithmetic on those fields:

     gap   = your% − tour%            (signed, in points)
     sgRd  = strokes/round lost vs Tour for this bucket  (the SG currency)
     sev   = severity 0..3, driven by sgRd (OPPORTUNITY), not raw gap points.
             This is the whole thesis: a big % gap in a rare / low-value bucket
             (Approach 175+, −24 pts) outranks nothing; a smaller gap you face
             constantly (Putts 10–20 ft, −13 pts) is the real leak.

   n≥10 gate (lib/analytics/gates.ts): buckets below it never drive the headline
   and render a "thin" flag instead of a severity color.
   Tour values are band-averages → copy uses "≈ Tour", never false precision.
   ============================================================================ */
(function () {
  const GATE = 10; // shots/putts a bucket needs before it can be ranked or colored

  // sev from strokes/round lost (already gate-checked upstream)
  const sevOf = (sgRd) => {
    if (sgRd >= -0.04) return 0;        // even or ahead of Tour
    if (sgRd > -0.20) return 1;         // real but small
    if (sgRd > -0.45) return 2;         // worth attention
    return 3;                           // screaming
  };

  // helper to stamp gap + sev onto a benchmarked row
  const bench = (r) => {
    const gated = r.n >= GATE;
    return {
      ...r,
      gap: r.you - r.tour,
      sev: gated ? sevOf(r.sgRd ?? 0) : null,
      thin: !gated,
    };
  };

  const ALL_TIME = {
    rounds: 12,
    // ── PUTTING — make rate by distance ────────────────────────────────────
    makeRate: [
      { dist: "0–3 ft",  n: 141, makes: 139, you: 99, tour: 98, sgRd: +0.02 },
      { dist: "3–6 ft",  n: 30,  makes: 21,  you: 70, tour: 77, sgRd: -0.11 },
      { dist: "6–10 ft", n: 31,  makes: 8,   you: 26, tour: 50, sgRd: -0.58 },
      { dist: "10–20 ft",n: 56,  makes: 4,   you: 7,  tour: 20, sgRd: -0.93 },
      { dist: "20+ ft",  n: 70,  makes: 6,   you: 9,  tour: 8,  sgRd: +0.04 },
    ].map(bench),
    // ── PUTTING — performance by first-putt distance ───────────────────────
    firstPutt: [
      { dist: "0–3 ft",  faced: 20, avg: 1.05, you: 95, tour: 98, three: 0,  sgRd: -0.02 },
      { dist: "3–6 ft",  faced: 19, avg: 1.26, you: 74, tour: 77, three: 0,  sgRd: -0.04 },
      { dist: "6–10 ft", faced: 25, avg: 1.80, you: 20, tour: 50, three: 0,  sgRd: -0.55 },
      { dist: "10–20 ft",faced: 51, avg: 1.92, you: 8,  tour: 20, three: 0,  sgRd: -0.88 },
      { dist: "20+ ft",  faced: 63, avg: 2.06, you: 10, tour: 8,  three: 14, sgRd: -0.30 },
    ].map((r) => bench({ ...r, n: r.faced })),
    // ── PUTTING — miss patterns (diagnostic, no Tour benchmark) ────────────
    missPattern: [
      { dist: "0–3 ft",  n: 2,  high: 0,  low: 0,  short: 0,  long: 50 },
      { dist: "3–6 ft",  n: 9,  high: 44, low: 56, short: 11, long: 44 },
      { dist: "6–10 ft", n: 23, high: 43, low: 30, short: 9,  long: 22 },
      { dist: "10–20 ft",n: 52, high: 17, low: 33, short: 21, long: 15 },
      { dist: "20+ ft",  n: 64, high: 27, low: 31, short: 27, long: 25 },
    ].map((r) => ({ ...r, thin: r.n < GATE })),
    // ── AROUND THE GREEN (under 30 yds, no Tour benchmark here) ─────────────
    aroundGreen: [
      { dist: "0–10 yds",  n: 5,  qual: 3.6,  onGreen: 40, updown: 80 },
      { dist: "10–30 yds", n: 51, qual: 2.63, onGreen: 76, updown: 39 },
    ].map((r) => ({ ...r, thin: r.n < GATE })),
    // ── APPROACH SHOTS (30+ yds) ───────────────────────────────────────────
    approach: [
      { dist: "30–75 yds",  n: 58, qual: 2.86, you: 72, tour: 85, missL: 3,  sgRd: -0.34 },
      { dist: "75–125 yds", n: 54, qual: 2.56, you: 61, tour: 78, missL: 11, sgRd: -0.60 },
      { dist: "125–175 yds",n: 42, qual: 3.00, you: 48, tour: 66, missL: 2,  sgRd: -0.30 },
      { dist: "175+ yds",   n: 53, qual: 2.75, you: 26, tour: 50, missL: 25, sgRd: -0.22 },
    ].map(bench),
  };

  const LAST_5 = {
    rounds: 5,
    makeRate: [
      { dist: "0–3 ft",  n: 59, makes: 58, you: 98, tour: 98, sgRd: +0.01 },
      { dist: "3–6 ft",  n: 13, makes: 10, you: 77, tour: 77, sgRd: +0.00 },
      { dist: "6–10 ft", n: 13, makes: 4,  you: 31, tour: 50, sgRd: -0.52 },
      { dist: "10–20 ft",n: 23, makes: 2,  you: 9,  tour: 20, sgRd: -0.88 },
      { dist: "20+ ft",  n: 29, makes: 3,  you: 10, tour: 8,  sgRd: +0.05 },
    ].map(bench),
    firstPutt: [
      { dist: "0–3 ft",  faced: 9,  avg: 1.06, you: 94, tour: 98, three: 0,  sgRd: -0.03 },
      { dist: "3–6 ft",  faced: 8,  avg: 1.25, you: 75, tour: 77, three: 0,  sgRd: -0.02 },
      { dist: "6–10 ft", faced: 11, avg: 1.73, you: 27, tour: 50, three: 0,  sgRd: -0.50 },
      { dist: "10–20 ft",faced: 21, avg: 1.86, you: 10, tour: 20, three: 0,  sgRd: -0.84 },
      { dist: "20+ ft",  faced: 26, avg: 2.04, you: 12, tour: 8,  three: 12, sgRd: -0.26 },
    ].map((r) => bench({ ...r, n: r.faced })),
    missPattern: [
      { dist: "0–3 ft",  n: 1,  high: 0,  low: 0,  short: 0,  long: 100 },
      { dist: "3–6 ft",  n: 3,  high: 33, low: 67, short: 0,  long: 33 },
      { dist: "6–10 ft", n: 9,  high: 44, low: 33, short: 11, long: 22 },
      { dist: "10–20 ft",n: 21, high: 19, low: 33, short: 24, long: 14 },
      { dist: "20+ ft",  n: 26, high: 27, low: 31, short: 27, long: 23 },
    ].map((r) => ({ ...r, thin: r.n < GATE })),
    aroundGreen: [
      { dist: "0–10 yds",  n: 2,  qual: 3.5,  onGreen: 50, updown: 100 },
      { dist: "10–30 yds", n: 21, qual: 2.60, onGreen: 76, updown: 40 },
    ].map((r) => ({ ...r, thin: r.n < GATE })),
    approach: [
      { dist: "30–75 yds",  n: 24, qual: 2.80, you: 75, tour: 85, missL: 4,  sgRd: -0.28 },
      { dist: "75–125 yds", n: 23, qual: 2.50, you: 63, tour: 78, missL: 9,  sgRd: -0.55 },
      { dist: "125–175 yds",n: 18, qual: 2.90, you: 50, tour: 66, missL: 0,  sgRd: -0.28 },
      { dist: "175+ yds",   n: 22, qual: 2.70, you: 27, tour: 50, missL: 23, sgRd: -0.20 },
    ].map(bench),
  };

  /* ── HERO: ranked top-3 biggest gaps to Tour, gated to n≥GATE, weighted by
        opportunity (strokes/round). Built off the make-rate + approach buckets
        — the cuts that carry Tour benchmarks. Frequency note = faced/round.   */
  function buildHero(W) {
    const pool = [];
    W.makeRate.forEach((r) => { if (r.n >= GATE) pool.push({
      label: "Putts " + r.dist, group: "Putting", sgRd: r.sgRd,
      you: r.you, tour: r.tour, n: r.n, unit: "made", count: r.n, noun: "putts",
      perRound: r.n / W.rounds,
    }); });
    W.approach.forEach((r) => { if (r.n >= GATE) pool.push({
      label: "Approach " + r.dist, group: "Approach", sgRd: r.sgRd,
      you: r.you, tour: r.tour, n: r.n, unit: "greens", count: r.n, noun: "shots",
      perRound: r.n / W.rounds,
    }); });
    return pool
      .filter((p) => p.sgRd < -0.05)
      .sort((a, b) => a.sgRd - b.sgRd)
      .slice(0, 3);
  }

  ALL_TIME.hero = buildHero(ALL_TIME);
  LAST_5.hero = buildHero(LAST_5);

  window.DIST = { allTime: ALL_TIME, last5: LAST_5, GATE };
})();
