import { describe, expect, it } from "vitest";
import type { DatabaseEvent } from "../../events/model/types";
import { applyView, applyFilters, applySort, defaultSortFor, viewCounts, type EventFilters } from "./eventsQuery";

// Frozen clock: 2026-08-11T16:00:00 UTC == 2026-08-11T12:00:00 America/New_York (EDT, UTC-4).
const NOW = new Date("2026-08-11T16:00:00.000Z");

let nextId = 0;

function makeEvent(overrides: Partial<DatabaseEvent> = {}): DatabaseEvent {
  nextId += 1;
  return {
    id: `event-${nextId}`,
    title: `Event ${nextId}`,
    description: "A great event.",
    event_type: "social",
    event_date: "2026-08-15T00:00:00.000Z",
    event_time: "8:00 PM",
    location: "Havana Club",
    address: null,
    price_type: "free",
    price_amount: null,
    rsvp_link: null,
    image_url: "https://example.com/image.jpg",
    submitter_name: "Ada",
    submitter_email: "ada@salsa.test",
    submitter_id: null,
    status: "approved",
    city: "boston",
    created_at: "2026-08-01T00:00:00.000Z",
    host: "DJ Cocolo",
    recurrence: null,
    gallery: null,
    contact_email: null,
    contact_instagram: null,
    contact_website: null,
    source_type: "admin",
    dance_styles: ["salsa"],
    updated_at: "2026-08-01T00:00:00.000Z",
    cancellation_reason: null,
    ...overrides,
  };
}

const baseFilters: EventFilters = {
  q: "",
  from: null,
  to: null,
  status: [],
  organizer: null,
  venue: null,
  city: null,
  style: null,
  source: null,
  incompleteOnly: false,
};

describe("applyView", () => {
  it("all excludes archived but includes cancelled", () => {
    const archived = makeEvent({ status: "archived" });
    const cancelled = makeEvent({ status: "cancelled" });
    const result = applyView([archived, cancelled], "all", NOW);
    expect(result).toEqual([cancelled]);
  });

  it("upcoming includes a cancelled future event and excludes a rejected one", () => {
    const cancelled = makeEvent({ status: "cancelled", event_date: "2026-08-20T00:00:00.000Z" });
    const rejected = makeEvent({ status: "rejected", event_date: "2026-08-20T00:00:00.000Z" });
    const result = applyView([cancelled, rejected], "upcoming", NOW);
    expect(result).toEqual([cancelled]);
  });

  it("an event exactly at startOfToday (NY midnight) counts as upcoming", () => {
    // 2026-08-11T00:00:00 America/New_York == 2026-08-11T04:00:00Z (EDT).
    const atMidnight = makeEvent({ status: "approved", event_date: "2026-08-11T04:00:00.000Z" });
    expect(applyView([atMidnight], "upcoming", NOW)).toEqual([atMidnight]);
  });

  it("an event one minute before startOfToday does not count as upcoming", () => {
    const beforeMidnight = makeEvent({ status: "approved", event_date: "2026-08-11T03:59:00.000Z" });
    expect(applyView([beforeMidnight], "upcoming", NOW)).toEqual([]);
  });
});

describe("applyFilters", () => {
  it("from/to bound by New York calendar date — a 9pm event whose UTC date rolls to the next day", () => {
    // 2026-08-15T21:00 America/New_York (EDT, UTC-4) == 2026-08-16T01:00Z.
    const nightEvent = makeEvent({ event_date: "2026-08-16T01:00:00.000Z" });
    const inRange = applyFilters([nightEvent], { ...baseFilters, from: "2026-08-15", to: "2026-08-15" }, NOW);
    expect(inRange).toEqual([nightEvent]);
    const outOfRange = applyFilters([nightEvent], { ...baseFilters, from: "2026-08-16", to: "2026-08-16" }, NOW);
    expect(outOfRange).toEqual([]);
  });

  it("q matches the city display label 'New York City' and not the raw city value", () => {
    const nyc = makeEvent({ city: "new-york-city", title: "Untitled" });
    expect(applyFilters([nyc], { ...baseFilters, q: "new york city" }, NOW)).toEqual([nyc]);
    expect(applyFilters([nyc], { ...baseFilters, q: "new-york-city" }, NOW)).toEqual([]);
  });

  it("incompleteOnly matches events with at least one quality issue", () => {
    const complete = makeEvent();
    const incomplete = makeEvent({ location: null });
    const result = applyFilters([complete, incomplete], { ...baseFilters, incompleteOnly: true }, NOW);
    expect(result).toEqual([incomplete]);
  });

  it("status filter is a membership check; empty array matches everything", () => {
    const pending = makeEvent({ status: "pending" });
    const approved = makeEvent({ status: "approved" });
    expect(applyFilters([pending, approved], { ...baseFilters, status: ["pending"] }, NOW)).toEqual([pending]);
    expect(applyFilters([pending, approved], baseFilters, NOW)).toEqual([pending, approved]);
  });
});

describe("applySort", () => {
  it("sorts by title case-insensitively", () => {
    const b = makeEvent({ title: "banana" });
    const a = makeEvent({ title: "Apple" });
    expect(applySort([b, a], "title", "asc")).toEqual([a, b]);
  });

  it("is stable for equal keys", () => {
    const first = makeEvent({ title: "Same", event_date: "2026-08-15T00:00:00.000Z" });
    const second = makeEvent({ title: "Same", event_date: "2026-08-15T00:00:00.000Z" });
    const third = makeEvent({ title: "Same", event_date: "2026-08-15T00:00:00.000Z" });
    expect(applySort([first, second, third], "event_date", "asc")).toEqual([first, second, third]);
  });
});

describe("defaultSortFor", () => {
  it("upcoming sorts soonest-first; every other view sorts newest-first", () => {
    expect(defaultSortFor("upcoming")).toEqual({ key: "event_date", dir: "asc" });
    expect(defaultSortFor("all")).toEqual({ key: "event_date", dir: "desc" });
    expect(defaultSortFor("archived")).toEqual({ key: "event_date", dir: "desc" });
  });
});

describe("viewCounts", () => {
  it("counts each view over the unfiltered set, independent of applyFilters", () => {
    const pending = makeEvent({ status: "pending", event_date: "2026-08-20T00:00:00.000Z" });
    const archived = makeEvent({ status: "archived" });
    const counts = viewCounts([pending, archived], NOW);
    expect(counts.pending).toBe(1);
    expect(counts.archived).toBe(1);
    expect(counts.all).toBe(1); // excludes archived
  });
});
