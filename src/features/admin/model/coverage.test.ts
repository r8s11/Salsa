import { describe, expect, it } from "vitest";
import { parseCoverage } from "./coverage";

const snapshot = {
  as_of: "2026-10-28T16:00:00Z", lookback_days: 28, horizon_days: 14, minimum_occurrences: 2,
  tracked: 3, listed: 2,
  metros: [{ slug: "boston", name: "Boston", tracked: 3, listed: 2, gaps: [] }],
};

describe("coverage data integrity", () => {
  it("does not turn inconsistent aggregate counts into a plausible score", () => {
    expect(() => parseCoverage({ ...snapshot, tracked: 4 })).toThrow("Unable to load recurring coverage");
    expect(() => parseCoverage({ ...snapshot, listed: 1 })).toThrow("Unable to load recurring coverage");
  });

  it("rejects a gap list that exceeds the actual number of missing nights", () => {
    const gap = { key: "night:a", title: "Night A", place: null, series_slug: null, last_at: "2026-10-21T23:00:00Z", recent_occurrences: 2 };
    expect(() => parseCoverage({
      ...snapshot,
      metros: [{ ...snapshot.metros[0], gaps: [gap, { ...gap, key: "night:b" }] }],
    })).toThrow("Unable to load recurring coverage");
  });
});
