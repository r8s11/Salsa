import { describe, expect, it } from "vitest";
import {
  dateRangeFor,
  granularityForRange,
  formatDelta,
  deltaTrend,
  deltaLabel,
  parseMetrics,
  parseSeries,
} from "./analyticsQuery";

describe("dateRangeFor", () => {
  const now = new Date("2026-08-14T12:00:00Z");

  it("returns 7-day range for '7d'", () => {
    const { from, to } = dateRangeFor("7d", now);
    // 7 days inclusive: from is 6 days before to
    const expectedFrom = new Date(now);
    expectedFrom.setDate(expectedFrom.getDate() - 6);
    expectedFrom.setHours(0, 0, 0, 0);
    expect(from.getTime()).toBeCloseTo(expectedFrom.getTime(), -3);
    expect(to.getDate()).toBe(now.getDate());
  });

  it("returns 30-day range for '30d'", () => {
    const { from } = dateRangeFor("30d", now);
    // from should be 29 days before the end of the 30-day window
    const expectedFrom = new Date(now);
    expectedFrom.setDate(expectedFrom.getDate() - 29);
    expectedFrom.setHours(0, 0, 0, 0);
    expect(from.getTime()).toBeCloseTo(expectedFrom.getTime(), -3);
  });

  it("returns 90-day range for '90d'", () => {
    const { from } = dateRangeFor("90d", now);
    const expectedFrom = new Date(now);
    expectedFrom.setDate(expectedFrom.getDate() - 89);
    expectedFrom.setHours(0, 0, 0, 0);
    expect(from.getTime()).toBeCloseTo(expectedFrom.getTime(), -3);
  });

  it("returns YTD range for 'ytd'", () => {
    const { from, to } = dateRangeFor("ytd", now);
    expect(from.getMonth()).toBe(0); // January
    expect(from.getDate()).toBe(1);
    expect(to.getMonth()).toBe(7); // August
    expect(to.getDate()).toBe(14);
  });
});

describe("granularityForRange", () => {
  it("returns daily for 7d", () => {
    expect(granularityForRange("7d")).toBe("daily");
  });

  it("returns weekly for 30d", () => {
    expect(granularityForRange("30d")).toBe("weekly");
  });

  it("returns weekly for 90d", () => {
    expect(granularityForRange("90d")).toBe("weekly");
  });

  it("returns monthly for ytd", () => {
    expect(granularityForRange("ytd")).toBe("monthly");
  });
});

describe("formatDelta", () => {
  it("formats positive delta with + sign", () => {
    expect(formatDelta(5)).toBe("+5");
  });

  it("formats negative delta with - sign", () => {
    expect(formatDelta(-3)).toBe("-3");
  });

  it("formats zero as 'no change'", () => {
    expect(formatDelta(0)).toBe("no change");
  });
});

describe("deltaTrend", () => {
  it("returns 'up' for positive", () => {
    expect(deltaTrend(5)).toBe("up");
  });

  it("returns 'down' for negative", () => {
    expect(deltaTrend(-3)).toBe("down");
  });

  it("returns 'flat' for zero", () => {
    expect(deltaTrend(0)).toBe("flat");
  });
});

describe("deltaLabel", () => {
  it("returns 'Increased' for positive", () => {
    expect(deltaLabel(5)).toBe("Increased");
  });

  it("returns 'Decreased' for negative", () => {
    expect(deltaLabel(-3)).toBe("Decreased");
  });

  it("returns 'No change' for zero", () => {
    expect(deltaLabel(0)).toBe("No change");
  });
});

describe("parseMetrics", () => {
  it("parses RPC response into typed metrics", () => {
    const raw = {
      published_events: 86,
      published_events_prev: 80,
      published_events_delta: 6,
      new_users: 42,
      new_users_prev: 38,
      new_users_delta: 4,
      rsvps: 318,
      rsvps_prev: 300,
      rsvps_delta: 18,
      submissions: 29,
      submissions_prev: 25,
      submissions_delta: 4,
    };

    const result = parseMetrics(raw);
    expect(result.published_events.current).toBe(86);
    expect(result.published_events.previous).toBe(80);
    expect(result.published_events.delta).toBe(6);
    expect(result.new_users.current).toBe(42);
    expect(result.submissions.delta).toBe(4);
  });

  it("returns empty metrics for null input", () => {
    const result = parseMetrics(null);
    expect(result.published_events.current).toBe(0);
    expect(result.new_users.current).toBe(0);
  });

  it("handles string values from RPC", () => {
    const raw = {
      published_events: "86",
      published_events_prev: "80",
      published_events_delta: "6",
      new_users: "42",
      new_users_prev: "38",
      new_users_delta: "4",
      rsvps: "318",
      rsvps_prev: "300",
      rsvps_delta: "18",
      submissions: "29",
      submissions_prev: "25",
      submissions_delta: "4",
    };

    const result = parseMetrics(raw);
    expect(result.published_events.current).toBe(86);
  });
});

describe("parseSeries", () => {
  it("parses event and submission series arrays", () => {
    const raw = {
      events_by_week: [
        { label: "Aug 4", value: 12 },
        { label: "Aug 11", value: 15 },
      ],
      submissions_by_week: [
        { label: "Aug 4", value: 3 },
        { label: "Aug 11", value: 5 },
      ],
    };

    const result = parseSeries(raw);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].label).toBe("Aug 4");
    expect(result.events[0].value).toBe(12);
    expect(result.submissions[1].value).toBe(5);
  });

  it("returns empty arrays for null input", () => {
    const result = parseSeries(null);
    expect(result.events).toEqual([]);
    expect(result.submissions).toEqual([]);
  });

  it("filters out malformed data points", () => {
    const raw = {
      events_by_week: [{ label: "Aug 4", value: 12 }, { foo: "bar" }, null],
      submissions_by_week: [],
    };

    const result = parseSeries(raw);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].value).toBe(12);
  });
});
