import { describe, it, expect } from "vitest";
import {
  SAMPLE_THRESHOLDS,
  tierFor,
  isPrescribable,
} from "@/lib/analytics/gates";

describe("sample gates (spec 2C)", () => {
  it("clubs need n>=15, buckets need n>=10", () => {
    expect(SAMPLE_THRESHOLDS).toEqual({ club: 15, bucket: 10 });
  });

  it("tierFor is 'stable' at/above threshold, 'early' below", () => {
    expect(tierFor("club", 14)).toBe("early");
    expect(tierFor("club", 15)).toBe("stable");
    expect(tierFor("bucket", 9)).toBe("early");
    expect(tierFor("bucket", 10)).toBe("stable");
  });

  it("isPrescribable gates recommendations on the threshold", () => {
    expect(isPrescribable("club", 7)).toBe(false); // the 5i-with-7-shots case
    expect(isPrescribable("club", 15)).toBe(true);
    expect(isPrescribable("bucket", 10)).toBe(true);
    expect(isPrescribable("bucket", 0)).toBe(false);
  });
});
