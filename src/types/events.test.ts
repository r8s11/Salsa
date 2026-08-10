import "temporal-polyfill/global";
import { describe, it, expect } from "vitest";
import { databaseEventToScheduleX } from "../features/events/model/convert";
import { DatabaseEvent } from "./events";

describe("databaseEventToScheduleX", () => {
  it("maps properties correctly", () => {
    const event: DatabaseEvent = {
      id: "1",
      title: "Title",
      description: "Desc",
      event_type: "social",
      event_date: "2026-07-01T12:00:00Z",
      event_time: null,
      location: "Loc",
      address: "Addr",
      price_type: "paid",
      price_amount: 20,
      rsvp_link: "https://example.com/rsvp",
      image_url: "https://example.com/poster.jpg",
      submitter_name: "Name",
      submitter_email: "test@example.com",
      submitter_id: null,
      status: "approved",
      city: "boston",
      created_at: "2026-07-01T00:00:00Z",
      host: "DJ Cocolo",
      recurrence: "weekly",
      gallery: ["a.jpg"],
    };
    const result = databaseEventToScheduleX(event);
    expect(result.id).toBe("1");
    expect(result.title).toBe("Title");
    expect(result.priceType).toBe("paid");
    expect(result.priceAmount).toBe(20);
  });

  it("maps null new fields to undefined", () => {
    const event: DatabaseEvent = {
      id: "1",
      title: "Title",
      description: null,
      event_type: "social",
      event_date: "2026-07-01T12:00:00Z",
      event_time: null,
      location: null,
      address: null,
      price_type: null,
      price_amount: null,
      rsvp_link: null,
      image_url: null,
      submitter_name: null,
      submitter_email: null,
      submitter_id: null,
      status: "approved",
      city: "boston",
      created_at: "2026-07-01T00:00:00Z",
      host: null,
      recurrence: null,
      gallery: null,
    };
    const result = databaseEventToScheduleX(event);
    expect(result.host).toBeUndefined();
    expect(result.recurrence).toBeUndefined();
    expect(result.gallery).toBeUndefined();
    expect(result.priceType).toBeUndefined();
    expect(result.priceAmount).toBeUndefined();
  });
});
