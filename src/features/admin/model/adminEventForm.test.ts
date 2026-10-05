import { describe, expect, it } from "vitest";
import { buildEmptyAdminForm, buildAdminFormFromEvent } from "./adminEventForm";
import type { DatabaseEvent } from "../../events/model/types";
import { draftToAdminPayload } from "../../events/components/EventForm";

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
    expect(buildAdminFormFromEvent(baseEvent).taxonomy_term_ids).toEqual([
      "salsa-id",
      "bachata-id",
    ]);
  });

  it("draftToAdminPayload carries selected taxonomy term IDs", () => {
    const payload = draftToAdminPayload(buildAdminFormFromEvent(baseEvent));
    expect(payload.taxonomy_term_ids).toEqual(["salsa-id", "bachata-id"]);
    expect(payload).not.toHaveProperty("dance_styles");
  });
  it("round-trips an existing Series link through the admin form and save payload", () => {
    const event = { ...baseEvent, series_id: "series-123" };
    const form = buildAdminFormFromEvent(event);

    expect(form.series_id).toBe("series-123");
    expect(draftToAdminPayload(form).series_id).toBe("series-123");
  });

  it("preserves existing linked entity review through an unrelated event edit", () => {
    const entityReview = {
      venue: null,
      organizer: {
        candidate: { name: "Casa Latina" },
        state: "MATCHED" as const,
        matches: [{ id: "organizer-1", name: "Casa Latina" }],
        decision: "existing" as const,
        selected_id: "organizer-1",
      },
      instructors: [],
      school: null,
    };
    const form = buildAdminFormFromEvent({ ...baseEvent, entity_review: entityReview });
    form.title = "Edited title";

    expect(draftToAdminPayload(form).entity_review).toEqual(entityReview);
  });
});
