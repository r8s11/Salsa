import { describe, expect, it } from "vitest";
import { dateRangeFor, granularityFor, growthPercentage, parseCities, parseEntityPerformance, parseEventEngagement, parseInsights, parseMetrics } from "./analyticsQuery";

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

describe("insight comparison boundaries", () => {
  it("uses a meaningful previous baseline, never infinity or fabricated all-time growth", () => {
    expect(growthPercentage(6, 4)).toBe(50);
    expect(growthPercentage(0, 4)).toBe(-100);
    expect(growthPercentage(6, 0)).toBeNull();
    expect(growthPercentage(6, null)).toBeNull();
  });
  it("adapts reporting resolution to the selected calendar window", () => {
    expect(["7d", "30d", "90d", "all"].map((range) => granularityFor(range as "7d" | "30d" | "90d" | "all")))
      .toEqual(["daily", "daily", "weekly", "monthly"]);
  });
});

describe("insight source isolation", () => {
  const users = { current: 2, previous: 0, total_accounts: 12, series: [{ period: "2026-10-11", count: 2 }] };
  it("preserves healthy registration counts when event aggregation is unavailable", () => {
    const result = parseInsights({ granularity: "daily", events: null, users });
    expect(result.events).toBeNull();
    expect(result.users).toEqual(users);
    expect(result.submissions).toBeNull();
  });
  it("keeps genuine empty datasets distinct from malformed source results", () => {
    expect(parseInsights({ users: { ...users, current: 0, series: [] } }).users?.current).toBe(0);
    expect(parseInsights({ users: { ...users, series: [{ period: "2026-02-30", count: 2 }] } }).users).toBeNull();
    expect(parseInsights({ users: { ...users, total_accounts: -1 } }).users).toBeNull();
  });
  it("retains multi-style counts with the event denominator and unknown-style bucket", () => {
    const styles = { upcoming_total: 2, distribution: [
      { slug: "salsa", style: "Salsa", count: 2 }, { slug: "bachata", style: "Bachata", count: 1 },
      { slug: null, style: "Unspecified", count: 0 },
    ], scheduled: [] };
    expect(parseInsights({ styles }).styles).toEqual(styles);
    expect(parseInsights({ styles: { ...styles, distribution: [{ slug: "salsa", style: "", count: 2 }] } }).styles).toBeNull();
  });
  it("preserves same-name metro identities and unavailable inventory history", () => {
    const geography = { active_metros: 2, scheduled: [
      { period: "2026-10-11", slug: "first", city: "Springfield", count: 1 },
      { period: "2026-10-11", slug: "second", city: "Springfield", count: 1 },
    ], emerging: [], inventory_history_available: false };
    expect(parseInsights({ geography }).geography).toEqual(geography);
    expect(parseInsights({ geography: { ...geography, inventory_history_available: true } }).geography).toBeNull();
  });
});

describe("event engagement availability and attribution", () => {
  const payload = {
    as_of: "2026-10-14T12:00:00Z",
    first_recorded_at: "2026-10-01T16:00:00Z",
    summary: { detail_views: 10, rsvp_clicks: 8, ticket_clicks: 10, shares: 4, outbound_clicks: 18, click_to_view_ratio: 180 },
    events: [{ id: "evt-1", title: "Salsa Night", event_date: "2026-10-15T00:30:00Z",
      city_slug: "nyc", city: "New York City", status: "approved",
      detail_views: 10, rsvp_clicks: 8, ticket_clicks: 10, shares: 4 }],
    metros: [{ slug: "nyc", city: "New York City", detail_views: 10, rsvp_clicks: 8, ticket_clicks: 10, shares: 4 }],
    styles: [{ slug: "salsa", style: "Salsa", detail_views: 10, rsvp_clicks: 8, shares: 4 }],
    saves_available: false,
  };

  it("preserves uncapped click-to-view ratios, event status and event-city attribution", () => {
    expect(parseEventEngagement(payload).summary).toEqual(payload.summary);
    expect(parseEventEngagement(payload).events).toEqual(payload.events);
    expect(parseEventEngagement(payload).metros).toEqual(payload.metros);
    expect(parseEventEngagement(payload).savesAvailable).toBe(false);
  });
  it("keeps source failures independent of genuine empty sections", () => {
    const parsed = parseEventEngagement({ ...payload, events: null, metros: [], styles: null });
    expect(parsed.events).toBeNull();
    expect(parsed.metros).toEqual([]);
    expect(parsed.styles).toBeNull();
    expect(parsed.summary).toEqual(payload.summary);
  });
  it("rejects malformed counts and contradictory outbound totals without inventing zeros", () => {
    expect(parseEventEngagement({ ...payload, events: [{ ...payload.events[0], detail_views: -1 }] }).events).toBeNull();
    expect(parseEventEngagement({ ...payload, summary: { ...payload.summary, outbound_clicks: 17 } }).summary).toBeNull();
    expect(parseEventEngagement({ ...payload, summary: { ...payload.summary, click_to_view_ratio: 100 } }).summary).toBeNull();
  });
  it("accepts the database's two-decimal ratio instead of hiding valid fractional totals", () => {
    const summary = { detail_views: 15, rsvp_clicks: 1, ticket_clicks: 3, shares: 1, outbound_clicks: 4, click_to_view_ratio: 26.67 };
    expect(parseEventEngagement({ ...payload, summary }).summary).toEqual(summary);
  });
});

describe("canonical entity analytics availability", () => {
  const row = {
    id: "canonical-a", name: "Organizer A", city: null, status: "active",
    total_events: 3, upcoming_events: 2, past_events: 1, created_events: 1,
    latest_scheduled_at: "2026-10-15T12:00:00Z", last_occurred_at: "2026-09-15T12:00:00Z",
    last_published_at: null, engagement: null,
    related_total: 1, related: [{ id: "venue-a", name: "Venue A", event_count: 3 }],
    metro_total: 1, metros: [{ slug: "canonical-city", name: "City", upcoming_events: 2 }],
    style_total: null, styles: null,
  };
  const organizers = { total: 4, active: 1, created: 2, offset: 0, page_size: 25, rows: [row] };
  it("retains canonical inventory when venue and engagement sources are unavailable", () => {
    const result = parseEntityPerformance({ organizers, venues: null, engagement_available: false });
    expect(result.organizers?.rows[0].related?.[0].id).toBe("venue-a");
    expect(result.organizers?.active).toBe(1);
    expect(result.organizers?.rows[0].engagement).toBeNull();
    expect(result.venues).toBeNull();
    expect(result.coverage).toBeNull();
  });
  it("rejects malformed inventories instead of hiding individual rows or inventing zeros", () => {
    expect(parseEntityPerformance({ organizers: { ...organizers, rows: [{ ...row, upcoming_events: -1 }] } }).organizers).toBeNull();
    expect(parseEntityPerformance({ organizers: { ...organizers, active: null } }).organizers).toBeNull();
    expect(parseEntityPerformance({ organizers: { ...organizers, rows: [{ ...row, last_occurred_at: "invalid" }] } }).organizers).toBeNull();
    expect(parseEntityPerformance({ organizers: { ...organizers, rows: [{ ...row, engagement: { detail_views: 2, rsvp_clicks: -1, ticket_clicks: 0, shares: 0 } }] } }).organizers).toBeNull();
  });
  it("preserves genuine empty entities and same-name metro identities", () => {
    const result = parseEntityPerformance({
      organizers: { ...organizers, total: 0, active: 0, created: 0, rows: [] },
      coverage: { active_metros: 2, inventory_history_available: false, rows: [
        { slug: "first-city", city: "Same City", upcoming_events: 2, active_organizers: 1, active_venues: 2 },
        { slug: "second-city", city: "Same City", upcoming_events: 1, active_organizers: 1, active_venues: 1 },
      ] },
      quality: [{ key: "missing_venue", severity: "optional", count: 0, events: [] }],
    });
    expect(result.organizers?.rows).toEqual([]);
    expect(result.coverage?.rows.map((city) => city.slug)).toEqual(["first-city", "second-city"]);
    expect(result.quality?.[0].count).toBe(0);
    expect(parseEntityPerformance({ quality: [{ key: "missing_venue", severity: "optional", count: null, events: [] }] }).quality).toBeNull();
  });
});
