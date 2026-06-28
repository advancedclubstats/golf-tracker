import { describe, it, expect } from "vitest";
import { summarizeDecisions, type Decision } from "@/lib/pm/decisions";

let seq = 0;
function dec(p: Partial<Decision>): Decision {
  return {
    id: `DL-${String(++seq).padStart(3, "0")}`,
    date: "2026-06-01",
    title: "x",
    source: "matt",
    decision: "shipped",
    reason: "because",
    job: "jtbd",
    prediction: null,
    predictedCorrect: null,
    undeferWhen: null,
    outcome: null,
    ...p,
  };
}

describe("summarizeDecisions", () => {
  it("counts decisions and computes kill rate over decided (ship+kill) calls", () => {
    const s = summarizeDecisions([
      dec({ decision: "shipped" }),
      dec({ decision: "shipped" }),
      dec({ decision: "shipped" }),
      dec({ decision: "killed" }),
      dec({ decision: "deferred" }), // deferred excluded from kill rate
    ]);
    expect(s.total).toBe(5);
    expect(s.shipped).toBe(3);
    expect(s.killed).toBe(1);
    expect(s.deferred).toBe(1);
    expect(s.killRate).toBe(25); // 1 of 4 decided, not 1 of 5
  });

  it("reports accuracy and a cumulative curve in chronological order", () => {
    const s = summarizeDecisions([
      dec({ date: "2026-06-03", prediction: "ship", predictedCorrect: true }),
      dec({ date: "2026-06-01", prediction: "kill", predictedCorrect: false }),
      dec({ date: "2026-06-02", prediction: "defer", predictedCorrect: true }),
      dec({ prediction: null }), // pre-engine: ignored
    ]);
    expect(s.predictionsLogged).toBe(3);
    expect(s.accuracyPct).toBe(67); // 2 of 3
    // Cumulative, sorted by date: miss → 0%, hit → 50%, hit → 67%.
    expect(s.curve.map((c) => c.accPct)).toEqual([0, 50, 67]);
    expect(s.curve.map((c) => c.date)).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
    ]);
  });

  it("returns null accuracy and an empty curve when nothing is predicted", () => {
    const s = summarizeDecisions([dec({}), dec({})]);
    expect(s.accuracyPct).toBeNull();
    expect(s.curve).toEqual([]);
  });

  it("orders the feed newest first and tracks the most recent date", () => {
    const s = summarizeDecisions([
      dec({ id: "DL-100", date: "2026-06-01" }),
      dec({ id: "DL-200", date: "2026-06-09" }),
      dec({ id: "DL-150", date: "2026-06-05" }),
    ]);
    expect(s.feed.map((d) => d.date)).toEqual([
      "2026-06-09",
      "2026-06-05",
      "2026-06-01",
    ]);
    expect(s.mostRecent).toBe("2026-06-09");
  });
});
