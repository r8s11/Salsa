import { describe, it, expect } from "vitest";
import { databaseEventToScheduleX, DatabaseEvent } from "./events";

const baseEvent: DatabaseEvent = {
  id: "abc-123",
  title: "Saturday Social",
  description: "A fun night",
  event_type: "social",
  event_date: "2026-07-18T20:00:00-04:00",
  event_time: null,
  location: "Havana Club",
  address: "288 Green St",
  price_type: "paid",
  price_amount: 20,
  rsvp_link: "https://example.com/rsvp",
  image_url: "https://example.com/poster.jpg",
  status: "approved",
  city: "boston",
  created_at: "2026-07-01T00:00:00Z",
  host: "DJ Cocolo",
  recurrence: "weekly",
  gallery: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
};

describe("databaseEventToScheduleX", () => {
  it("passes through host, recurrence, gallery, image and price fields", () => {
    const result = databaseEventToScheduleX(baseEvent);
    expect(result.host).toBe("DJ Cocolo");
    expect(result.recurrence).toBe("weekly");
    expect(result.gallery).toEqual([
      "https://example.com/1.jpg",
      "https://example.com/2.jpg",
    ]);
    expect(result.imageUrl).toBe("https://example.com/poster.jpg");
    expect(result.priceType).toBe("paid");
    expect(result.priceAmount).toBe(20);
  });

  it("maps null new fields to undefined", () => {
    const result = databaseEventToScheduleX({
      ...baseEvent,
      host: null,
      recurrence: null,
      gallery: null,
      image_url: null,
      price_type: null,
      price_amount: null,
    });
    expect(result.host).toBeUndefined();
    expect(result.recurrence).toBeUndefined();
    expect(result.gallery).toBeUndefined();
    expect(result.imageUrl).toBeUndefined();
    expect(result.priceType).toBeUndefined();
    expect(result.priceAmount).toBeUndefined();
  });
});
