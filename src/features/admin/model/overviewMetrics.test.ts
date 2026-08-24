import { describe, expect, it } from "vitest";
import type { DatabaseEvent } from "../../events/model/types";
import type { AdminUserRow } from "../model/usersQuery";
import {
  deriveIncompleteEvents,
  deriveOverviewMetrics,
  deriveUpcomingEvents,
  missingFields,
  qualityIssues,
  findPotentialDuplicates,
} from "./overviewMetrics";

const NOW = new Date("2026-08-11T12:00:00.000Z");

function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

let nextId = 0;

function makeEvent(overrides: Partial<DatabaseEvent> = {}): DatabaseEvent {
  nextId += 1;
  const base: DatabaseEvent = {
    id: `event-${nextId}`,
    title: `Event ${nextId}`,
    description: null,
    event_type: "social",
    event_date: daysFromNow(1),
    event_time: "20:00",
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
    created_at: NOW.toISOString(),
    host: null,
    recurrence: null,
    gallery: null,
    contact_email: null,
    contact_instagram: null,
    contact_website: null,
    source_type: "user_submission",
    taxonomy_term_ids: [],
    taxonomy_terms: [],
    updated_at: NOW.toISOString(),
    cancellation_reason: null,
    venue_id: null,
  };
  // Filter out undefined values so `venue_id` stays `string | null` when not overridden
  const filtered = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined)
  ) as Partial<DatabaseEvent>;
  return { ...base, ...filtered };
}

function makeUser(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  nextId += 1;
  return {
    kind: "profile",
    id: `user-${nextId}`,
    user_id: `user-${nextId}`,
    email: `user${nextId}@test.com`,
    display_name: `User ${nextId}`,
    username: `user${nextId}`,
    avatar_url: null,
    role: null,
    status: "active",
    status_reason: null,
    created_at: NOW.toISOString(),
    last_active_at: NOW.toISOString(),
    contributions: 0,
    pending_count: 0,
    email_confirmed_at: NOW.toISOString(),
    approved_count: 0,
    ...overrides,
  };
}

describe("missingFields", () => {
  it("flags a null/blank location as missing venue", () => {
    expect(missingFields(makeEvent({ location: null }))).toEqual(["venue"]);
    expect(missingFields(makeEvent({ location: "   " }))).toEqual(["venue"]);
  });

  it("flags a null/blank event_time as missing time", () => {
    expect(missingFields(makeEvent({ event_time: null }))).toEqual(["time"]);
  });

  it("flags a null/blank image_url as missing image, independent of other fields", () => {
    expect(missingFields(makeEvent({ image_url: null }))).toEqual(["image"]);
  });

  it("returns no missing fields when venue, time, and image are all present", () => {
    expect(missingFields(makeEvent())).toEqual([]);
  });

  it("accumulates every missing field in order", () => {
    expect(missingFields(makeEvent({ location: null, event_time: null, image_url: null }))).toEqual(
      ["venue", "time", "image"]
    );
  });
});

describe("deriveOverviewMetrics — upcomingCount", () => {
  it("returns correct count", () => {
    const events = [makeEvent({ event_date: daysFromNow(1) })];
    const metrics = deriveOverviewMetrics(events, NOW, 0, 0, []);
    expect(metrics.upcomingCount).toBe(1);
  });
});

describe("deriveOverviewMetrics — pendingCount", () => {
  it("returns correct count", () => {
    const events = [makeEvent({ status: "pending" })];
    const metrics = deriveOverviewMetrics(events, NOW, 0, 1, []);
    expect(metrics.pendingCount).toBe(1);
  });
});

describe("deriveOverviewMetrics — incompleteCount", () => {
  it("returns correct count", () => {
    const events = [makeEvent({ location: "" })];
    const metrics = deriveOverviewMetrics(events, NOW, 0, 0, []);
    expect(metrics.incompleteCount).toBe(1);
  });
});

describe("deriveOverviewMetrics — totalCount", () => {
  it("returns correct count", () => {
    const events = [makeEvent()];
    const metrics = deriveOverviewMetrics(events, NOW, 0, 0, []);
    expect(metrics.totalCount).toBe(1);
  });
});

describe("deriveOverviewMetrics — organizerRequestCount", () => {
  it("returns the count passed through", () => {
    const metrics = deriveOverviewMetrics([], NOW, 0, 0, [], 3);
    expect(metrics.organizerRequestCount).toBe(3);
  });

  it("defaults to 0", () => {
    const metrics = deriveOverviewMetrics([], NOW, 0, 0, []);
    expect(metrics.organizerRequestCount).toBe(0);
  });
});

describe("deriveOverviewMetrics — flaggedUserCount", () => {
  it("returns correct count", () => {
    const users = [makeUser({ status: "flagged" })];
    const metrics = deriveOverviewMetrics([], NOW, 0, 0, users);
    expect(metrics.flaggedUserCount).toBe(1);
  });
});

describe("deriveIncompleteEvents", () => {
  it("yields ['image'] and the underlying event for a gap limited to image_url", () => {
    const event = makeEvent({ status: "approved", image_url: null });
    const result = deriveIncompleteEvents([event], NOW);
    expect(result).toEqual([{ event, missing: ["image"] }]);
  });
});

describe("deriveUpcomingEvents", () => {
  it("sorts ascending by event_date and excludes past/non-approved events", () => {
    const later = makeEvent({ status: "approved", event_date: daysFromNow(10) });
    const sooner = makeEvent({ status: "approved", event_date: daysFromNow(2) });
    const past = makeEvent({ status: "approved", event_date: daysFromNow(-1) });
    const pending = makeEvent({ status: "pending", event_date: daysFromNow(1) });
    expect(deriveUpcomingEvents([later, sooner, past, pending], NOW)).toEqual([sooner, later]);
  });

  it("is not capped at the 30-day window — a far-future event still appears", () => {
    const farFuture = makeEvent({ status: "approved", event_date: daysFromNow(200) });
    expect(deriveUpcomingEvents([farFuture], NOW)).toEqual([farFuture]);
  });

  it("slices to the list limit", () => {
    const events = Array.from({ length: 12 }, (_, index) =>
      makeEvent({ status: "approved", event_date: daysFromNow(index + 1) })
    );
    expect(deriveUpcomingEvents(events, NOW)).toHaveLength(8);
  });
});

describe("qualityIssues", () => {
  it("flags pricing when price_type is null", () => {
    expect(qualityIssues(makeEvent({ price_type: null }))).toContain("pricing");
  });

  it("does not flag pricing when price_type is 'free'", () => {
    expect(qualityIssues(makeEvent({ price_type: "free" }))).not.toContain("pricing");
  });

  it("flags duplicate only when the id is in the supplied duplicate set", () => {
    const event = makeEvent();
    expect(qualityIssues(event)).not.toContain("duplicate");
    expect(qualityIssues(event, new Set([event.id]))).toContain("duplicate");
  });
});

describe("findPotentialDuplicates", () => {
  it("flags same-title-same-venue events 2 hours apart", () => {
    const a = makeEvent({
      title: "Salsa Night",
      location: "The Anchor",
      event_date: daysFromNow(5),
    });
    const b = makeEvent({
      title: "salsa night",
      location: "the anchor",
      event_date: new Date(Date.parse(daysFromNow(5)) + 2 * 60 * 60 * 1000).toISOString(),
    });
    const duplicates = findPotentialDuplicates([a, b]);
    expect(duplicates.has(a.id)).toBe(true);
    expect(duplicates.has(b.id)).toBe(true);
  });

  it("does not flag same-title-same-venue events 7 days apart", () => {
    const a = makeEvent({
      title: "Salsa Night",
      location: "The Anchor",
      event_date: daysFromNow(5),
    });
    const b = makeEvent({
      title: "Salsa Night",
      location: "The Anchor",
      event_date: daysFromNow(12),
    });
    const duplicates = findPotentialDuplicates([a, b]);
    expect(duplicates.size).toBe(0);
  });
});
