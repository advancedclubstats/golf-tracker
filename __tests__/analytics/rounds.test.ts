import { describe, it, expect } from "vitest";
import { computeRoundList } from "@/lib/analytics/rounds";
import type { ShotRow } from "@/lib/schemas/shot";

let seq = 0;
function shot(p: Partial<ShotRow>): ShotRow {
  return {
    id: `00000000-0000-0000-0000-${String(seq++).padStart(12, "0")}`,
    user_id: "1b3a0171-726e-4c64-a8e0-f97a717f2851",
    round_id: "r1",
    hole: 1,
    par: 4,
    shot_no: 1,
    club: "D",
    yardage: null,
    distance_unit: null,
    start_lie: null,
    situation_created: null,
    short_sided: null,
    execution: 3,
    result: null,
    miss_direction: null,
    putt_side: null,
    putt_length: null,
    mulligan: false,
    penalty: 0,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...p,
  };
}

const rounds = [
  { id: "r2", date: "2026-05-08", session_type: "Full18" as const },
  { id: "r1", date: "2026-05-01", session_type: "Practice9" as const },
  { id: "r3", date: "2026-04-20", session_type: "Full18" as const },
];

const shots: ShotRow[] = [
  // r1: one complete hole (par 4, score 5), plus a partial hole.
  shot({ round_id: "r1", hole: 1, par: 4, shot_no: 1, club: "D", result: "Fairway" }),
  shot({ round_id: "r1", hole: 1, par: 4, shot_no: 2, club: "8i", result: "Green" }),
  shot({ round_id: "r1", hole: 1, par: 4, shot_no: 3, club: "Putter", result: null }),
  shot({ round_id: "r1", hole: 1, par: 4, shot_no: 4, club: "Putter", result: null }),
  shot({ round_id: "r1", hole: 1, par: 4, shot_no: 5, club: "Putter", result: "Make" }),
  shot({ round_id: "r1", hole: 2, par: 3, shot_no: 1, club: "7i", result: "Green" }), // partial
  // r2: one complete hole (par 3, score 3).
  shot({ round_id: "r2", hole: 1, par: 3, shot_no: 1, club: "7i", result: "Green" }),
  shot({ round_id: "r2", hole: 1, par: 3, shot_no: 2, club: "Putter", result: "Make" }),
  // r3: no shots.
];

describe("computeRoundList", () => {
  const list = computeRoundList(shots, rounds);

  it("preserves the given round order (newest first)", () => {
    expect(list.map((r) => r.id)).toEqual(["r2", "r1", "r3"]);
  });

  it("rolls up complete-hole stats per round", () => {
    const r1 = list.find((r) => r.id === "r1")!;
    expect(r1).toMatchObject({
      sessionType: "Practice9",
      shotCount: 6, // 5 on hole 1 + 1 partial on hole 2
      completeHoles: 1, // only hole 1 is complete
      strokes: 5,
      par: 4,
      vsPar: 1,
    });
  });

  it("handles a complete par-3 round (a 2 is a birdie)", () => {
    const r2 = list.find((r) => r.id === "r2")!;
    expect(r2).toMatchObject({ shotCount: 2, completeHoles: 1, strokes: 2, par: 3, vsPar: -1 });
  });

  it("shows rounds with no shots as zeroed", () => {
    const r3 = list.find((r) => r.id === "r3")!;
    expect(r3).toMatchObject({ shotCount: 0, completeHoles: 0, strokes: 0, par: 0, vsPar: 0 });
  });
});
