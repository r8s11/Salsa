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
  taxonomy_terms: [],
  taxonomy_term_ids: ["salsa-id", "bachata-id"],
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
  it("buildEmptyAdminForm initializes taxonomy_term_ids as an empty array", () => {
    expect(buildEmptyAdminForm("boston").taxonomy_term_ids).toEqual([]);
  });

  it("buildAdminFormFromEvent maps taxonomy term IDs from the event", () => {
    expect(buildAdminFormFromEvent(baseEvent).taxonomy_term_ids).toEqual(["salsa-id", "bachata-id"]);
  });

  it("adminFormToPayload carries selected taxonomy term IDs", () => {
    const payload = adminFormToPayload(buildAdminFormFromEvent(baseEvent));
    expect(payload.taxonomy_term_ids).toEqual(["salsa-id", "bachata-id"]);
    expect(payload).not.toHaveProperty("dance_styles");
  });
});
