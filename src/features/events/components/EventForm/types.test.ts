import "temporal-polyfill/global";
import { describe, expect, it } from "vitest";
import {
  draftToAdminPayload,
  draftToOrganizerCreatePayload,
  draftToOrganizerUpdatePayload,
  draftToSubmission,
  draftToUserPayload,
} from "./types";
import type { EventFormDraft } from "./types";

const draft: EventFormDraft = {
  title: "Havana Nights",
  description: "Social dancing",
  event_type: "social",
  city: "new-york-city",
  event_date: "2026-10-24",
  event_time: "21:00",
  recurrence: "weekly",
  location: "Grand Ballroom",
  address: "288 Green St",
  venue_id: "venue-1",
  price_type: "paid",
  price_amount: "15",
  rsvp_link: "https://example.com/rsvp",
  image_url: "https://example.com/flyer.jpg",
  host: "Carlos",
  contact_email: "host@example.com",
  contact_instagram: "@havana",
  contact_website: "https://example.com",
  submitter_name: "Ana",
  submitter_email: "form@example.com",
  dance_styles: ["salsa"],
  taxonomy_term_ids: ["term-1"],
};

describe("EventForm adapters", () => {
  it("uses the authenticated email and produces only SubmissionCreate keys", () => {
    const result = draftToSubmission(draft, { id: "user-1", email: "account@example.com" });
    expect(result.submitter_email).toBe("account@example.com");
    expect(result.event_date).toBe("2026-10-25T01:00:00Z");
    expect(Object.keys(result).sort()).toEqual(
      [
        "address",
        "city",
        "dance_styles",
        "description",
        "event_date",
        "event_time",
        "event_type",
        "event_types",
        "location",
        "price_amount",
        "price_type",
        "recurrence",
        "rsvp_link",
        "submitter_email",
        "submitter_id",
        "submitter_name",
        "title",
      ].sort()
    );
  });

  it("uses an anonymous form email and emits only permitted organizer fields", () => {
    const submission = draftToSubmission(draft, null);
    const user = draftToUserPayload(draft);
    expect(submission.submitter_email).toBe("form@example.com");
    expect(user.price_amount).toBe(15);
    expect(Object.keys(user).sort()).toEqual(
      [
        "address",
        "city",
        "dance_styles",
        "description",
        "event_date",
        "event_time",
        "event_type",
        "event_types",
        "image_url",
        "location",
        "price_amount",
        "price_type",
        "recurrence",
        "rsvp_link",
        "title",
      ].sort()
    );
  });

  it("clears price amounts for free events and emits the full admin payload without gallery", () => {
    const freeDraft = { ...draft, price_type: "free" as const, price_amount: "15" };
    expect(draftToUserPayload(freeDraft).price_amount).toBeNull();
    const admin = draftToAdminPayload(freeDraft);
    expect(admin.price_amount).toBeNull();
    expect(Object.keys(admin).sort()).toEqual(
      [
        "address",
        "city",
        "contact_email",
        "contact_instagram",
        "contact_website",
        "description",
        "event_date",
        "event_time",
        "event_type",
        "event_types",
        "host",
        "image_url",
        "location",
        "price_amount",
        "price_type",
        "recurrence",
        "rsvp_link",
        "taxonomy_term_ids",
        "title",
        "venue_id",
      ].sort()
    );
  });
  it("maps organizer creation to canonical fields including slug-based styles", () => {
    const payload = draftToOrganizerCreatePayload(draft);
    expect(payload.dance_styles).toEqual(["salsa"]);
    expect(payload).not.toHaveProperty("taxonomy_term_ids");
    expect(payload).toHaveProperty("venue_id", "venue-1");
  });

  describe("multiple event types", () => {
    const multi: EventFormDraft = {
      ...draft,
      event_type: "live_music",
      event_types: ["live_music", "concert", "social"],
    };

    it("sends the full ordered list with the first selection as primary in every payload", () => {
      const expected = { event_type: "live_music", event_types: ["live_music", "concert", "social"] };
      expect(draftToSubmission(multi, null)).toMatchObject(expected);
      expect(draftToUserPayload(multi)).toMatchObject(expected);
      expect(draftToAdminPayload(multi)).toMatchObject(expected);
      expect(draftToOrganizerCreatePayload(multi)).toMatchObject(expected);
      expect(draftToOrganizerUpdatePayload(multi)).toMatchObject(expected);
    });

    it("accepts Concert as a primary or sole type", () => {
      const concert: EventFormDraft = { ...draft, event_type: "concert", event_types: ["concert"] };
      expect(draftToAdminPayload(concert)).toMatchObject({
        event_type: "concert",
        event_types: ["concert"],
      });
    });

    it("derives a one-item list from a draft that only has the primary", () => {
      expect(draftToAdminPayload({ ...draft, event_type: "class" })).toMatchObject({
        event_type: "class",
        event_types: ["class"],
      });
    });

    it("keeps the primary equal to the first listed type even if the draft's primary is stale", () => {
      const stale: EventFormDraft = { ...draft, event_type: "social", event_types: ["class", "social"] };
      expect(draftToUserPayload(stale)).toMatchObject({
        event_type: "class",
        event_types: ["class", "social"],
      });
    });

    it("refuses to build a payload with no event type", () => {
      const none: EventFormDraft = { ...draft, event_type: "", event_types: [] };
      expect(() => draftToSubmission(none, null)).toThrow("Choose at least one event type.");
      expect(() => draftToAdminPayload(none)).toThrow("Choose at least one event type.");
    });
  });
});
