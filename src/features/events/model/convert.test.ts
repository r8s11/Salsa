import "temporal-polyfill/global";
import { describe, it, expect } from "vitest";
import { databaseEventToScheduleX } from "./convert";
import { DatabaseEvent } from "./types";

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
});
