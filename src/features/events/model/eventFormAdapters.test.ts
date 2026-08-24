import "temporal-polyfill/global";
import { describe, expect, it } from "vitest";
import { draftToSubmission, draftToUserPayload } from "./eventFormAdapters";
import type { EventFormDraft } from "./eventFormAdapters";

const draft: EventFormDraft = {
  title: "Havana Nights", description: "Social dancing", event_type: "social", city: "boston",
  event_date: "2026-10-24", event_time: "21:00", recurrence: "weekly", location: "Grand Ballroom", address: "288 Green St", venue_id: "venue-1",
  price_type: "paid", price_amount: "15", rsvp_link: "https://example.com/rsvp", image_url: "https://example.com/flyer.jpg",
  host: "Carlos", contact_email: "host@example.com", contact_instagram: "@havana", contact_website: "https://example.com",
  submitter_name: "Ana", submitter_email: "form@example.com", dance_styles: ["salsa"], taxonomy_term_ids: ["term-1"],
};

describe("event form adapters", () => {
  it("preserves authenticated email precedence and wall-clock time for submissions", () => {
    const result = draftToSubmission(draft, { id: "user-1", email: "account@example.com" });
    expect(result.submitter_id).toBe("user-1");
    expect(result.submitter_email).toBe("account@example.com");
    expect(result.event_date).toBe("2026-10-25T01:00:00Z");
    expect(result).not.toHaveProperty("host");
    expect(result).not.toHaveProperty("venue_id");
  });

  it("never emits admin-only fields in organizer updates", () => {
    const result = draftToUserPayload(draft);
    expect(result).toMatchObject({ title: "Havana Nights", dance_styles: ["salsa"], image_url: "https://example.com/flyer.jpg" });
    for (const key of ["status", "source_type", "submitter_id", "host", "contact_email", "venue_id", "gallery", "taxonomy_term_ids"]) {
      expect(result).not.toHaveProperty(key);
    }
  });
});
