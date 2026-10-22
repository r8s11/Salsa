import { describe, expect, it } from "vitest";
import {
  buildEmptyAdminForm,
  buildAdminFormFromEvent,
  validateAdminEventForm,
} from "./adminEventForm";
import { toggleEventType } from "../../events/model/eventTypeSelection";
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

describe("adminEventForm event types", () => {
  const multiEvent: DatabaseEvent = {
    ...baseEvent,
    event_type: "concert",
    event_types: ["concert", "live_music", "social"],
  };

  it("loads the full ordered list, and reload after save keeps every choice", () => {
    const form = buildAdminFormFromEvent(multiEvent);
    expect(form).toMatchObject({
      event_type: "concert",
      event_types: ["concert", "live_music", "social"],
    });

    const saved = draftToAdminPayload(form);
    const reloaded = buildAdminFormFromEvent({ ...multiEvent, ...saved } as DatabaseEvent);
    expect(reloaded.event_types).toEqual(["concert", "live_music", "social"]);
    expect(reloaded.event_type).toBe("concert");
  });

  it("loads a single-type event as a one-item list", () => {
    expect(buildAdminFormFromEvent(baseEvent)).toMatchObject({
      event_type: "social",
      event_types: ["social"],
    });
  });

  it("saves a removal as a smaller list with the next type promoted", () => {
    const form = buildAdminFormFromEvent(multiEvent);
    const trimmed = { ...form, ...toggleEventType(form, "concert") };

    expect(draftToAdminPayload(trimmed)).toMatchObject({
      event_type: "live_music",
      event_types: ["live_music", "social"],
    });
  });

  it("starts empty and requires at least one type", () => {
    const empty = buildEmptyAdminForm("boston");
    expect(empty).toMatchObject({ event_type: "", event_types: [] });
    expect(validateAdminEventForm({ ...empty, title: "Night" })).toBe("Choose an event type.");
  });

  it("accepts a form whose selection is only in the list", () => {
    const form = {
      ...buildAdminFormFromEvent(baseEvent),
      event_type: "" as const,
      event_types: ["concert" as const],
    };
    expect(validateAdminEventForm(form)).toBeNull();
  });
});
