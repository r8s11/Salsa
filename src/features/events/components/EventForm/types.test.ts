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
  sublocation: "manhattan",
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
  image_urls: ["https://example.com/flyer.jpg", "https://example.com/second.jpg"],
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
  it("uses the authenticated email and produces a submission payload", () => {
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
        "neighborhood",
        "price_amount",
        "price_type",
        "recurrence",
        "rsvp_link",
        "sublocation",
        "submitter_email",
        "submitter_id",
        "submitter_name",
        "title",
      ].sort()
    );
  });

  it("uses an anonymous form email and preserves permitted organizer fields", () => {
    const submission = draftToSubmission(draft, null);
    const user = draftToUserPayload(draft);
    expect(submission.submitter_email).toBe("form@example.com");
    expect(user.price_amount).toBe(15);
    // updateEventForUser writes `event_time ?? null`: dropping it would wipe the time on every owner edit.
    expect(user.event_time).toBe(draft.event_time || null);
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
        "image_urls",
        "location",
        "neighborhood",
        "price_amount",
        "price_type",
        "recurrence",
        "rsvp_link",
        "sublocation",
        "title",
      ].sort()
    );
  });

  it("clears price amounts for free events and emits admin fields without gallery", () => {
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
        "image_urls",
        "location",
        "neighborhood",
        "price_amount",
        "price_type",
        "recurrence",
        "rsvp_link",
        "sublocation",
        "taxonomy_term_ids",
        "title",
        "venue_id",
      ].sort()
    );
  });
  it("emits the ordered flyer list with the first as the primary, or falls back to the lone image_url", () => {
    const admin = draftToAdminPayload(draft);
    expect(admin.image_url).toBe("https://example.com/flyer.jpg");
    expect(admin.image_urls).toEqual([
      "https://example.com/flyer.jpg",
      "https://example.com/second.jpg",
    ]);
    const legacy = draftToAdminPayload({ ...draft, image_urls: [] });
    expect(legacy.image_urls).toEqual(["https://example.com/flyer.jpg"]);
    const cleared = draftToAdminPayload({ ...draft, image_url: "", image_urls: [] });
    expect(cleared.image_url).toBeNull();
    expect(cleared.image_urls).toBeNull();
  });

  describe("NYC borough", () => {
    const actor = { id: "user-1", email: "account@example.com" };
    const everyPayload = (value: EventFormDraft) => ({
      submission: draftToSubmission(value, actor),
      user: draftToUserPayload(value),
      admin: draftToAdminPayload(value),
      organizerCreate: draftToOrganizerCreatePayload(value),
      organizerUpdate: draftToOrganizerUpdatePayload(value),
    });

    it("sends the selected borough through every payload", () => {
      for (const payload of Object.values(everyPayload({ ...draft, sublocation: "staten-island" }))) {
        expect(payload).toHaveProperty("sublocation", "staten-island");
      }
    });

    it("sends an explicit null for All NYC so an edit clears the stored borough", () => {
      for (const payload of Object.values(everyPayload({ ...draft, sublocation: "" }))) {
        expect(payload).toHaveProperty("sublocation", null);
      }
    });

    it("never serializes a borough for a non-NYC city", () => {
      for (const payload of Object.values(everyPayload({ ...draft, city: "boston" }))) {
        expect(payload).toHaveProperty("sublocation", null);
      }
    });
  });
  it("persists and clears only neighborhoods valid for the selected borough", () => {
    const actor = { id: "user-1", email: "account@example.com" };
    const selected = {
      ...draft,
      sublocation: "manhattan" as const,
      neighborhood: "harlem",
    };
    expect(draftToSubmission(selected, actor).neighborhood).toBe("harlem");
    expect(draftToUserPayload(selected).neighborhood).toBe("harlem");
    expect(draftToAdminPayload(selected).neighborhood).toBe("harlem");
    expect(draftToOrganizerCreatePayload(selected).neighborhood).toBe("harlem");
    expect(draftToOrganizerUpdatePayload(selected).neighborhood).toBe("harlem");

    const mismatch = { ...selected, neighborhood: "astoria" };
    expect(draftToAdminPayload(mismatch).neighborhood).toBeNull();
    expect(draftToOrganizerUpdatePayload(mismatch).neighborhood).toBeNull();
    const cleared = { ...selected, neighborhood: "" };
    expect(draftToSubmission(cleared, actor).neighborhood).toBeNull();
    expect(draftToUserPayload(cleared).neighborhood).toBeNull();
    expect(draftToAdminPayload(cleared).neighborhood).toBeNull();
    expect(draftToAdminPayload({ ...selected, neighborhood: null }).neighborhood).toBeNull();
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
