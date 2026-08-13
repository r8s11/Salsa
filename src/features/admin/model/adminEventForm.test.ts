import { describe, expect, it } from "vitest";
import { buildEmptyAdminForm, buildAdminFormFromEvent, adminFormToPayload } from "./adminEventForm";
import type { DatabaseEvent } from "../../events/model/types";

const baseEvent: DatabaseEvent = {
  id: "event-1",
  title: "Test Event",
  description: "A test event",
  event_type: "social",
  city: "boston",
  event_date: "2026-08-20T20:00:00Z",
  event_time: "20:00",
  location: "Venue Name",
  address: "123 Main St",
  price_type: "free",
  price_amount: null,
  rsvp_link: null,
  image_url: "https://example.com/image.jpg",
  host: "The Host",
  recurrence: null,
  gallery: null,
  contact_email: "host@example.com",
  contact_instagram: "@host",
  contact_website: "https://host.com",
  source_type: "admin",
  dance_styles: ["salsa", "bachata"],
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  status: "approved",
  submitter_name: null,
  submitter_email: null,
  submitter_id: null,
  cancellation_reason: null,
  venue_id: null,
};

describe("adminEventForm model", () => {
  it("buildEmptyAdminForm initializes dance_styles as an empty array", () => {
    const form = buildEmptyAdminForm("boston");
    expect(form.dance_styles).toEqual([]);
  });

  it("buildAdminFormFromEvent maps dance_styles from the event", () => {
    const form = buildAdminFormFromEvent(baseEvent);
    expect(form.dance_styles).toEqual(["salsa", "bachata"]);
  });

  it("buildAdminFormFromEvent handles null dance_styles", () => {
    const event: DatabaseEvent = { ...baseEvent, dance_styles: null };
    const form = buildAdminFormFromEvent(event);
    expect(form.dance_styles).toEqual([]);
  });

  it("adminFormToPayload serializes non-empty dance_styles", () => {
    const form = buildAdminFormFromEvent(baseEvent);
    const payload = adminFormToPayload(form);
    expect(payload.dance_styles).toEqual(["salsa", "bachata"]);
  });

  it("adminFormToPayload serializes empty dance_styles as null", () => {
    const form = buildEmptyAdminForm("boston");
    // Provide valid date/time so toEventDateInstant doesn't throw
    form.event_date = "2026-08-20";
    form.event_time = "20:00";
    const payload = adminFormToPayload(form);
    expect(payload.dance_styles).toBeNull();
  });
});
