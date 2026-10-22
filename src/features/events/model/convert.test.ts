import "temporal-polyfill/global";
import { describe, it, expect } from "vitest";
import { databaseEventToScheduleX } from "./convert";
import { DatabaseEvent, EventType } from "./types";
import { CALENDARS_CONFIG } from "./calendarsConfig";

const mockEvent = (overrides: Partial<DatabaseEvent> = {}): DatabaseEvent => ({
  id: "test-id",
  title: "Test Event",
  description: null,
  event_type: "social",
  event_date: "2026-07-01T12:00:00Z", // Summer (EDT)
  event_time: null,
  location: null,
  address: null,
  price_type: "free",
  price_amount: null,
  rsvp_link: null,
  image_url: null,
  submitter_name: null,
  submitter_email: null,
  submitter_id: null,
  status: "approved",
  city: "boston",
  created_at: "2026-07-14T00:00:00Z",
  host: null,
  recurrence: null,
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
  source_type: "user_submission",
  taxonomy_term_ids: [],
  taxonomy_terms: [],
  updated_at: "2026-07-01T00:00:00Z",
  cancellation_reason: null,
  venue_id: null,
  ...overrides,
});

describe("databaseEventToScheduleX", () => {
  it("renders summer timestamp in EDT (UTC-4)", () => {
    const event = mockEvent({ event_date: "2026-07-01T12:00:00Z" });
    const result = databaseEventToScheduleX(event);
    expect(result.start).toBe("2026-07-01 08:00"); // EDT is UTC-4
  });

  it("renders winter timestamp in EST (UTC-5)", () => {
    const event = mockEvent({ event_date: "2026-01-01T12:00:00Z" });
    const result = databaseEventToScheduleX(event);
    expect(result.start).toBe("2026-01-01 07:00"); // EST is UTC-5
  });

  it("sets end time to start time + 4 hours", () => {
    const event = mockEvent();
    const result = databaseEventToScheduleX(event);
    expect(result.end).toBe("2026-07-01 12:00"); // 08:00 + 4 hours = 12:00
  });

  it("preserves approval provenance for public discovery indicators", () => {
    const result = databaseEventToScheduleX(
      mockEvent({
        created_at: "2026-08-31T12:00:00Z",
        source_type: "moderator",
      })
    );

    expect(result.createdAt).toBe("2026-08-31T12:00:00Z");
    expect(result.sourceType).toBe("moderator");
  });

  it("handles DST fall-back (EST transition) correctly", () => {
    const event = mockEvent({ event_date: "2026-11-01T12:00:00Z" });
    const result = databaseEventToScheduleX(event);
    // In November, Boston is on EST (UTC-5)
    expect(result.start).toBe("2026-11-01 07:00");
  });

  it("maps null optional fields to undefined", () => {
    const event = mockEvent({
      location: null,
      description: null,
      address: null,
      rsvp_link: null,
      host: null,
      recurrence: null,
      gallery: null,
      contact_email: null,
      contact_instagram: null,
      contact_website: null,
    });
    const result = databaseEventToScheduleX(event);
    expect(result.location).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.address).toBeUndefined();
    expect(result.rsvpLink).toBeUndefined();
    expect(result.host).toBeUndefined();
    expect(result.recurrence).toBeUndefined();
    expect(result.gallery).toBeUndefined();
    expect(result.contactEmail).toBeUndefined();
    expect(result.contactInstagram).toBeUndefined();
    expect(result.contactWebsite).toBeUndefined();
  });

  it("sets imageUrl to undefined when image_url is null (fallback handled by components)", () => {
    const event = mockEvent({ id: "event-1", image_url: null });
    const result = databaseEventToScheduleX(event);
    expect(result.imageUrl).toBeUndefined();
  });

  it("uses the stored image_url when one is present", () => {
    const url = "https://example.test/flyers/custom.jpg";
    const event = mockEvent({ image_url: url });
    const result = databaseEventToScheduleX(event);
    expect(result.imageUrl).toBe(url);
  });

  it("keeps a normalized poster cache separate from the original flyer", () => {
    const result = databaseEventToScheduleX(
      mockEvent({
        image_url: "https://flyers.example/original.jpg",
        poster_image_url:
          "https://project.supabase.co/storage/v1/object/public/event-flyers/poster-cache/test-id/flyer.jpg",
      })
    );

    expect(result.imageUrl).toBe("https://flyers.example/original.jpg");
    expect(result.posterImageUrl).toContain("poster-cache/test-id/");
  });

  it("projects canonical dance-style term names", () => {
    const event = mockEvent({
      taxonomy_term_ids: ["salsa", "beginner"],
      taxonomy_terms: [
        { id: "salsa", name: "Salsa", slug: "salsa", category: "dance_style", status: "active" },
        {
          id: "beginner",
          name: "Beginner",
          slug: "beginner",
          category: "dance_style",
          status: "active",
        },
      ],
    });
    const result = databaseEventToScheduleX(event);
    expect(result.danceStyles).toEqual(["Salsa", "Beginner"]);
  });

  it("uses public view dance_styles when taxonomy relationships are absent", () => {
    const result = databaseEventToScheduleX(
      mockEvent({
        dance_styles: ["Salsa", "Bachata"],
        taxonomy_terms: [],
      })
    );

    expect(result.danceStyles).toEqual(["Salsa", "Bachata"]);
  });
});

describe("databaseEventToScheduleX time zone", () => {
  // 2026-07-19T03:00:00Z is 8pm in Los Angeles (PDT) but 11pm in New York (EDT).
  it.each([
    ["los-angeles", "America/Los_Angeles", "2026-07-18 20:00"],
    ["chicago", "America/Chicago", "2026-07-18 22:00"],
    ["boston", "America/New_York", "2026-07-18 23:00"],
    ["new-york-city", "America/New_York", "2026-07-18 23:00"],
  ])("%s renders in %s wall-clock", (city, zone, start) => {
    const result = databaseEventToScheduleX(mockEvent({ city, event_date: "2026-07-19T03:00:00Z" }));
    expect(result.start).toBe(start);
    expect(result.timeZone).toBe(zone);
  });

  it("keeps the same instant for the whole duration in the event's zone", () => {
    const result = databaseEventToScheduleX(
      mockEvent({ city: "los-angeles", event_date: "2026-07-19T03:00:00Z" })
    );
    expect(result.end).toBe("2026-07-19 00:00");
  });

  it("prefers the venue zone over the metro", () => {
    const result = databaseEventToScheduleX(
      mockEvent({
        city: "new-york-city",
        event_date: "2026-07-19T03:00:00Z",
        venue_time_zone: "America/Chicago",
      })
    );
    expect(result.timeZone).toBe("America/Chicago");
    expect(result.start).toBe("2026-07-18 22:00");
  });

  it("does not blank the page for an unmapped metro: it falls back to the platform zone for display", () => {
    const result = databaseEventToScheduleX(mockEvent({ city: "atlantis" }));
    expect(result.timeZone).toBe("America/New_York");
  });

  it("does not silently use UTC", () => {
    const result = databaseEventToScheduleX(mockEvent({ city: "los-angeles" }));
    expect(result.timeZone).not.toBe("UTC");
  });
  it("keeps every event on a calendar the views can colour, even an unknown type", () => {
    // Production held approved rows typed "club/bar"; indexing CALENDARS_CONFIG
    // with it crashed the whole calendar list view.
    const unknown = databaseEventToScheduleX(mockEvent({ event_type: "club/bar" as EventType }));
    expect(unknown.calendarId).toBe("social");
    expect(CALENDARS_CONFIG[unknown.calendarId].darkColors.main).toBeTruthy();
    expect(databaseEventToScheduleX(mockEvent({ event_type: "live_music" })).calendarId).toBe("live_music");
  });
});
