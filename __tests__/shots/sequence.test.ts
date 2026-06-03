import { describe, it, expect } from "vitest";
import { renumberContiguous } from "@/lib/shots/sequence";

describe("renumberContiguous", () => {
  it("closes a gap left by deleting a middle shot", () => {
    // Deleted shot 3 of [1,2,3,4,5] → remaining [1,2,4,5].
    expect(renumberContiguous([
      { id: "a", shot_no: 1 },
      { id: "b", shot_no: 2 },
      { id: "d", shot_no: 4 },
      { id: "e", shot_no: 5 },
    ])).toEqual([
      { id: "d", shot_no: 3 },
      { id: "e", shot_no: 4 },
    ]);
  });

  it("returns no updates when already contiguous (e.g. deleted the last shot)", () => {
    expect(renumberContiguous([
      { id: "a", shot_no: 1 },
      { id: "b", shot_no: 2 },
      { id: "c", shot_no: 3 },
    ])).toEqual([]);
  });

  it("collapses multiple gaps", () => {
    expect(renumberContiguous([
      { id: "a", shot_no: 1 },
      { id: "c", shot_no: 3 },
      { id: "e", shot_no: 5 },
    ])).toEqual([
      { id: "c", shot_no: 2 },
      { id: "e", shot_no: 3 },
    ]);
  });

  it("is order-independent on input", () => {
    // Three shots at 1, 4, 5 collapse to 1, 2, 3 regardless of input order.
    expect(renumberContiguous([
      { id: "e", shot_no: 5 },
      { id: "a", shot_no: 1 },
      { id: "d", shot_no: 4 },
    ])).toEqual([
      { id: "d", shot_no: 2 },
      { id: "e", shot_no: 3 },
    ]);
  });

  it("handles empty input", () => {
    expect(renumberContiguous([])).toEqual([]);
  });
});
