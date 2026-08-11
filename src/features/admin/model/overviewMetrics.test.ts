import { describe, expect, it } from "vitest";
import type { DatabaseEvent } from "../../events/model/types";
import {
  UPCOMING_WINDOW_DAYS,
  deriveIncompleteEvents,
  deriveOverviewMetrics,
  deriveUpcomingEvents,
  missingFields,
} from "./overviewMetrics";

const NOW = new Date("2026-08-11T12:00:00.000Z");

function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

let nextId = 0;

function makeEvent(overrides: Partial<DatabaseEvent> = {}): DatabaseEvent {
  nextId += 1;
  return {
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
    expect(missingFields(makeEvent({ location: null, event_time: null, image_url: null }))).toEqual([
      "venue",
      "time",
      "image",
    ]);
  });
});

describe("deriveOverviewMetrics — upcomingCount", () => {
  it("counts an approved event exactly at now + 30 days as upcoming (inclusive boundary)", () => {
    const events = [makeEvent({ status: "approved", event_date: daysFromNow(UPCOMING_WINDOW_DAYS) })];
    expect(deriveOverviewMetrics(events, NOW).upcomingCount).toBe(1);
  });

  it("excludes an approved event at now + 31 days (past the window)", () => {
    const events = [makeEvent({ status: "approved", event_date: daysFromNow(UPCOMING_WINDOW_DAYS + 1) })];
    expect(deriveOverviewMetrics(events, NOW).upcomingCount).toBe(0);
  });

  it("excludes a pending event even if its date falls inside the window", () => {
    const events = [makeEvent({ status: "pending", event_date: daysFromNow(5) })];
    expect(deriveOverviewMetrics(events, NOW).upcomingCount).toBe(0);
  });

  it("excludes an approved event in the past", () => {
    const events = [makeEvent({ status: "approved", event_date: daysFromNow(-1) })];
    expect(deriveOverviewMetrics(events, NOW).upcomingCount).toBe(0);
  });
});

describe("deriveOverviewMetrics — pendingCount", () => {
  it("counts only pending events, regardless of date", () => {
    const events = [
      makeEvent({ status: "pending", event_date: daysFromNow(-30) }),
      makeEvent({ status: "pending", event_date: daysFromNow(30) }),
      makeEvent({ status: "approved" }),
      makeEvent({ status: "rejected" }),
    ];
    expect(deriveOverviewMetrics(events, NOW).pendingCount).toBe(2);
  });
});

describe("deriveOverviewMetrics — incompleteCount", () => {
  it("a pending event is never counted as incomplete, even with missing fields", () => {
    const events = [makeEvent({ status: "pending", location: null })];
    expect(deriveOverviewMetrics(events, NOW).incompleteCount).toBe(0);
  });

  it("an event whose only gap is image_url still counts as incomplete", () => {
    const events = [makeEvent({ status: "approved", image_url: null })];
    expect(deriveOverviewMetrics(events, NOW).incompleteCount).toBe(1);
  });

  it("has no upper date bound — a far-future incomplete event still counts", () => {
    const events = [makeEvent({ status: "approved", event_date: daysFromNow(365), location: null })];
    expect(deriveOverviewMetrics(events, NOW).incompleteCount).toBe(1);
  });

  it("excludes a past approved event even if incomplete", () => {
    const events = [makeEvent({ status: "approved", event_date: daysFromNow(-1), location: null })];
    expect(deriveOverviewMetrics(events, NOW).incompleteCount).toBe(0);
  });

  it("excludes a complete approved event", () => {
    const events = [makeEvent({ status: "approved" })];
    expect(deriveOverviewMetrics(events, NOW).incompleteCount).toBe(0);
  });
});

describe("deriveOverviewMetrics — totalCount", () => {
  it("counts every event regardless of status", () => {
    const events = [makeEvent({ status: "approved" }), makeEvent({ status: "pending" }), makeEvent({ status: "rejected" })];
    expect(deriveOverviewMetrics(events, NOW).totalCount).toBe(3);
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
      makeEvent({ status: "approved", event_date: daysFromNow(index + 1) }),
    );
    expect(deriveUpcomingEvents(events, NOW)).toHaveLength(8);
  });
});
