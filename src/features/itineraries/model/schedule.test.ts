import { describe, expect, it } from "vitest";
import type { DatabaseEvent } from "../../../types/events";
import type { ItineraryDraft, ItineraryItem } from "./types";
import { buildSchedule, estimatedAdmission, itineraryWarnings, spotlightNights } from "./schedule";

const TZ = "America/New_York";

function event(id: string, isoStart: string, extra: Partial<DatabaseEvent> = {}): DatabaseEvent {
  return {
    id,
    title: id,
    description: null,
    event_type: "social",
    event_date: isoStart,
    event_time: null,
    location: "Venue",
    address: null,
    price_type: "paid",
    price_amount: 15,
    rsvp_link: null,
    image_url: "https://example.com/f.jpg",
    city: "new-york-city",
    sublocation: null,
    created_at: "2026-11-01T00:00:00Z",
    host: null,
    ...extra,
  } as DatabaseEvent;
}

const item = (eventId: string, role: ItineraryItem["role"] = "featured", position = 0): ItineraryItem => ({
  eventId,
  role,
  position,
  note: null,
});

function draft(items: ItineraryItem[], extra: Partial<ItineraryDraft> = {}): ItineraryDraft {
  return {
    id: null,
    city: "new-york-city",
    weekStart: "2026-11-09",
    timeZone: TZ,
    title: "Week",
    description: null,
    recommendations: null,
    unfeaturedDays: [],
    items,
    ...extra,
  };
}

const mapOf = (...events: DatabaseEvent[]) => new Map(events.map((e) => [e.id, e]));

describe("buildSchedule", () => {
  it("groups after-midnight starts into the previous night, chronologically", () => {
    const events = mapOf(event("late", "2026-11-15T05:30:00Z"), event("early", "2026-11-15T03:00:00Z"));
    const s = buildSchedule(draft([item("late", "alternative", 0), item("early")]), events);
    const sat = s.nights.find((n) => n.date === "2026-11-14")!;
    expect(sat.weekday).toBe(6);
    expect(sat.entries.map((e) => e.event.id)).toEqual(["early", "late"]);
    expect(sat.featured?.event.id).toBe("early");
    expect(sat.alternatives.map((e) => e.event.id)).toEqual(["late"]);
    expect(s.nights).toHaveLength(7);
  });

  it("orders alternatives by position", () => {
    const events = mapOf(event("a", "2026-11-15T03:00:00Z"), event("b", "2026-11-15T04:00:00Z"));
    const s = buildSchedule(draft([item("a", "alternative", 2), item("b", "alternative", 1)]), events);
    expect(s.nights[5].alternatives.map((e) => e.event.id)).toEqual(["b", "a"]);
  });
});

describe("itineraryWarnings", () => {
  it("flags items whose event is gone as missing and not_public", () => {
    const d = draft([item("gone")]);
    expect(buildSchedule(d, mapOf()).missing).toEqual([item("gone")]);
    expect(itineraryWarnings(d, mapOf())).toContainEqual({
      code: "not_public",
      eventId: "gone",
      night: null,
      blocking: true,
      message: "No longer public (cancelled, unpublished or removed)",
    });
  });

  it("flags events outside the week", () => {
    const d = draft([item("x")]);
    const events = mapOf(event("x", "2026-11-16T11:00:00Z"));
    expect(buildSchedule(d, events).outside.map((e) => e.event.id)).toEqual(["x"]);
    expect(itineraryWarnings(d, events)).toContainEqual(
      expect.objectContaining({ code: "outside_week", eventId: "x", blocking: true, message: "Now outside this week" }),
    );
  });

  it("flags events in another city", () => {
    const events = mapOf(event("x", "2026-11-15T03:00:00Z", { city: "boston" }));
    expect(itineraryWarnings(draft([item("x")]), events)).toContainEqual(
      expect.objectContaining({ code: "wrong_city", blocking: true, message: "Now listed in another city" }),
    );
  });

  it("flags two featured events on one night", () => {
    const events = mapOf(event("a", "2026-11-15T03:00:00Z"), event("b", "2026-11-15T04:00:00Z"));
    expect(itineraryWarnings(draft([item("a"), item("b", "featured", 1)]), events)).toContainEqual({
      code: "two_featured",
      eventId: null,
      night: "2026-11-14",
      blocking: true,
      message: "Two featured events on one night",
    });
  });

  it("unfeaturedDays silences no_featured only for that weekday", () => {
    const events = mapOf(event("wed", "2026-11-12T00:00:00Z"), event("thu", "2026-11-13T00:00:00Z"));
    const warnings = itineraryWarnings(
      draft([item("wed", "alternative"), item("thu", "alternative")], { unfeaturedDays: [3] }),
      events,
    );
    const noFeatured = warnings.filter((w) => w.code === "no_featured");
    expect(noFeatured).toEqual([
      { code: "no_featured", eventId: null, night: "2026-11-12", blocking: false, message: "No featured pick" },
    ]);
  });

  it("flags missing flyer, venue and price as non-blocking", () => {
    const events = mapOf(
      event("x", "2026-11-15T03:00:00Z", { image_url: null, image_urls: [], location: " ", price_amount: null }),
    );
    const warnings = itineraryWarnings(draft([item("x")]), events);
    expect(warnings.map((w) => [w.code, w.message, w.blocking])).toEqual([
      ["missing_flyer", "No flyer", false],
      ["missing_venue", "No venue", false],
      ["missing_price", "No price", false],
    ]);
  });
});

describe("spotlightNights", () => {
  it("prefers Fri and Sat and returns them in week order", () => {
    const events = mapOf(
      event("mon", "2026-11-10T00:00:00Z"),
      event("sat", "2026-11-15T00:00:00Z"),
      event("fri", "2026-11-14T00:00:00Z"),
    );
    const s = buildSchedule(draft([item("mon"), item("sat"), item("fri")]), events);
    expect(spotlightNights(s.nights, 2).map((n) => n.date)).toEqual(["2026-11-13", "2026-11-14"]);
  });
});

describe("estimatedAdmission", () => {
  const admission = (second: Partial<DatabaseEvent>) => {
    const events = mapOf(event("a", "2026-11-14T00:00:00Z"), event("b", "2026-11-15T00:00:00Z", second));
    return estimatedAdmission(buildSchedule(draft([item("a"), item("b")]), events).nights);
  };

  it("sums featured prices", () => expect(admission({})).toBe(30));
  it("counts free picks as zero", () => expect(admission({ price_type: "free", price_amount: null })).toBe(15));
  it("is null when a featured price is unknown", () => expect(admission({ price_amount: null })).toBeNull());
  it("is null with no featured picks", () => expect(estimatedAdmission(buildSchedule(draft([]), mapOf()).nights)).toBeNull());
});
