import { describe, expect, it } from "vitest";
import { dateRangeFor, parseCities, parseMetrics } from "./analyticsQuery";

describe("analytics activity boundaries", () => {
  it("includes seven Eastern calendar days even when UTC is already tomorrow", () => {
    expect(dateRangeFor("7d", new Date("2026-10-12T02:00:00Z"))).toEqual({
      from: "2026-10-05T04:00:00Z", to: "2026-10-12T04:00:00Z",
    });
  });
  it("uses calendar arithmetic over spring DST rather than 24-hour durations", () => {
    expect(dateRangeFor("7d", new Date("2026-03-08T15:00:00Z"))).toEqual({
      from: "2026-03-02T05:00:00Z", to: "2026-03-09T04:00:00Z",
    });
  });
  it("uses calendar arithmetic over fall DST", () => {
    expect(dateRangeFor("30d", new Date("2026-11-01T18:00:00Z"))).toEqual({
      from: "2026-10-03T04:00:00Z", to: "2026-11-02T05:00:00Z",
    });
  });
  it("includes ninety calendar days and no artificial all-time cutoff", () => {
    expect(dateRangeFor("90d", new Date("2026-10-11T12:00:00Z"))).toEqual({
      from: "2026-07-14T04:00:00Z", to: "2026-10-12T04:00:00Z",
    });
    expect(dateRangeFor("all", new Date("2026-10-11T12:00:00Z"))).toEqual({ from: null, to: null });
  });
});

describe("analytics unavailable values", () => {
  it("never converts missing or failed counts to zero", () => {
    expect(parseMetrics(null)).toEqual({ total_events: null, upcoming_events: null,
      registered_users: null, pending_submissions: null, active_organizers: null });
  });
  it("retains genuine empty counts but rejects invalid or unsafe counts independently", () => {
    expect(parseMetrics({ total_events: 0, upcoming_events: -1, registered_users: "12",
      pending_submissions: "not a number", active_organizers: Number.MAX_SAFE_INTEGER + 1 })).toEqual({
      total_events: 0, upcoming_events: null, registered_users: 12,
      pending_submissions: null, active_organizers: null,
    });
  });
});

describe("city distribution availability", () => {
  it("distinguishes an empty inventory from missing aggregation", () => {
    expect(parseCities([])).toEqual([]);
    expect(parseCities(null)).toBeNull();
    expect(parseCities(undefined)).toBeNull();
  });
  it("never silently omits malformed city counts from the distribution", () => {
    expect(parseCities([{ slug: "boston", city: "Boston", count: 5 }, { slug: "miami", city: "Miami", count: null }])).toBeNull();
    expect(parseCities([{ slug: "boston", city: "", count: 3 }])).toBeNull();
    expect(parseCities([{ slug: null, city: "Unknown city", count: 2 }])).toEqual([{ slug: null, city: "Unknown city", count: 2 }]);
  });
  it("preserves canonical identities when two metros share a display name", () => {
    const rows = [
      { slug: "boston", city: "Boston", count: 2 },
      { slug: "other-boston", city: "Boston", count: 1 },
    ];
    expect(parseCities(rows)).toEqual(rows);
  });
});
