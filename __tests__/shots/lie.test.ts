import { describe, it, expect } from "vitest";
import { nextStartLie } from "@/lib/shots/lie";

describe("nextStartLie (carry-forward default)", () => {
  it("shot 1 starts on the tee", () => {
    expect(nextStartLie(null)).toBe("Tee");
  });

  it("carries the previous finish forward", () => {
    expect(nextStartLie({ result: "Fairway", club: "D", yardage: null })).toBe("Fairway");
    expect(nextStartLie({ result: "Rough", club: "7i", yardage: 160 })).toBe("Rough");
    expect(nextStartLie({ result: "Fringe", club: "LW", yardage: 30 })).toBe("Fringe");
    expect(nextStartLie({ result: "Green", club: "9i", yardage: 140 })).toBe("Green");
    expect(nextStartLie({ result: "Recovery", club: "PW", yardage: 90 })).toBe("Recovery");
  });

  it("a bunker finish defaults to greenside (override for fairway bunkers)", () => {
    expect(nextStartLie({ result: "Bunker", club: "SW", yardage: 40 })).toBe("Greenside bunker");
  });

  it("a previous putt means we're still on the green", () => {
    expect(nextStartLie({ result: null, club: "Putter", yardage: 5 })).toBe("Green");
  });

  it("penalty finishes have an unknown drop lie", () => {
    for (const result of ["OB", "Hazard", "Lost", "Unplayable"] as const) {
      expect(nextStartLie({ result, club: "D", yardage: null })).toBeNull();
    }
  });

  it("a holed or untagged shot has no next lie", () => {
    expect(nextStartLie({ result: "Make", club: "Putter", yardage: 1 })).toBeNull();
    expect(nextStartLie({ result: null, club: "7i", yardage: 150 })).toBeNull();
  });
});
