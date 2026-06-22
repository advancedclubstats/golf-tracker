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

  it("a bunker finish carries forward as a single Bunker lie", () => {
    expect(nextStartLie({ result: "Bunker", club: "SW", yardage: 40 })).toBe("Bunker");
  });

  it("a previous putt means we're still on the green", () => {
    expect(nextStartLie({ result: null, club: "Putter", yardage: 5 })).toBe("Green");
  });

  it("penalty finishes have an unknown drop lie without a known start lie", () => {
    for (const result of ["OB", "Hazard", "Lost", "Unplayable"] as const) {
      expect(nextStartLie({ result, club: "D", yardage: null })).toBeNull();
    }
  });

  it("stroke-and-distance (OB / Lost) replays from the same lie", () => {
    // A re-tee after an OB drive stays on the tee.
    expect(
      nextStartLie({ result: "OB", club: "D", yardage: null, startLie: "Tee" }),
    ).toBe("Tee");
    // An approach replayed after a lost ball stays where it was played from.
    expect(
      nextStartLie({ result: "Lost", club: "7i", yardage: 160, startLie: "Fairway" }),
    ).toBe("Fairway");
  });

  it("Hazard / Unplayable still drop to an unknown lie even with a start lie", () => {
    for (const result of ["Hazard", "Unplayable"] as const) {
      expect(
        nextStartLie({ result, club: "D", yardage: null, startLie: "Tee" }),
      ).toBeNull();
    }
  });

  it("a holed or untagged shot has no next lie", () => {
    expect(nextStartLie({ result: "Make", club: "Putter", yardage: 1 })).toBeNull();
    expect(nextStartLie({ result: null, club: "7i", yardage: 150 })).toBeNull();
  });
});
