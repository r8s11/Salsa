import "temporal-polyfill/global";
import { describe, expect, it } from "vitest";
import { draftToAdminPayload, draftToSubmission, draftToUserPayload } from "./types";
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
});
