import { describe, it, expect } from "vitest";
import { draftToSubmission, draftToUserPayload, draftToAdminPayload } from "./eventFormAdapters";
import type { EventFormDraft } from "../model/EventForm";

const baseDraft: EventFormDraft = {
  title: "Test Event",
  description: "Test Description",
  event_type: "social",
  city: "boston",
  sublocation: "",
  event_date: "2026-09-01",
  event_time: "21:00",
  recurrence: "",
  location: "Venue",
  address: "123 Main St",
  venue_id: "venue-1",
  price_type: "free",
  price_amount: "",
  rsvp_link: "https://example.com",
  image_url: "https://example.com/image.jpg",
  image_urls: ["https://example.com/image.jpg", "https://example.com/second.jpg"],
  host: "Test Host",
  contact_email: "test@example.com",
  contact_instagram: "@test",
  contact_website: "https://test.com",
  submitter_name: "Submitter",
  submitter_email: "submitter@example.com",
  dance_styles: ["salsa"],
  taxonomy_term_ids: ["term-1"],
};

describe("eventFormAdapters", () => {
  describe("draftToSubmission", () => {
    it("converts draft to submission payload with actor email precedence", () => {
      const actor = { id: "user-1", email: "actor@example.com" };
      const submission = draftToSubmission(baseDraft, actor);
      expect(submission.submitter_id).toBe("user-1");
      expect(submission.submitter_email).toBe("actor@example.com");
      expect(submission.event_date).toBe("2026-09-02T01:00:00Z"); // 21:00 + date
    });
    it("uses form email when actor email is missing", () => {
      const actor = { id: "user-1", email: null };
      const submission = draftToSubmission(baseDraft, actor);
      expect(submission.submitter_email).toBe("submitter@example.com");
    });
  });

  describe("draftToUserPayload", () => {
    it("converts draft to user payload excluding forbidden fields", () => {
      const payload = draftToUserPayload(baseDraft);
      expect(payload).not.toHaveProperty("status");
      expect(payload).not.toHaveProperty("host");
      expect(payload).not.toHaveProperty("venue_id");
      expect(payload).not.toHaveProperty("taxonomy_term_ids");
      expect(payload.title).toBe("Test Event");
    });
    it("emits the primary flyer and the ordered list", () => {
      expect(draftToUserPayload(baseDraft)).toMatchObject({
        image_url: "https://example.com/image.jpg",
        image_urls: ["https://example.com/image.jpg", "https://example.com/second.jpg"],
      });
      expect(draftToAdminPayload(baseDraft)).toMatchObject({
        image_url: "https://example.com/image.jpg",
        image_urls: ["https://example.com/image.jpg", "https://example.com/second.jpg"],
      });
    });
  });

  describe("draftToAdminPayload", () => {
    it("converts draft to admin payload including taxonomy and host info", () => {
      const payload = draftToAdminPayload(baseDraft);
      expect(payload.taxonomy_term_ids).toEqual(["term-1"]);
      expect(payload.host).toBe(
        "Test Event Host".split(" ").pop() === "Host" ? "Test Host" : "Test Host"
      ); // Verify correct host
      expect(payload.venue_id).toBe("venue-1");
    });
  });
  it("preserves Live Music type across submission, user, and admin payloads", () => {
    const liveMusicDraft: EventFormDraft = { ...baseDraft, event_type: "live_music" };

    expect(draftToSubmission(liveMusicDraft, { id: "user-1", email: null }).event_type).toBe(
      "live_music"
    );
    expect(draftToUserPayload(liveMusicDraft).event_type).toBe("live_music");
    expect(draftToAdminPayload(liveMusicDraft).event_type).toBe("live_music");
  });

  it("sends Concert and the ordered type list through every legacy payload", () => {
    const multi: EventFormDraft = {
      ...baseDraft,
      event_type: "concert",
      event_types: ["concert", "live_music"],
    };
    const expected = { event_type: "concert", event_types: ["concert", "live_music"] };

    expect(draftToSubmission(multi, { id: "user-1", email: null })).toMatchObject(expected);
    expect(draftToUserPayload(multi)).toMatchObject(expected);
    expect(draftToAdminPayload(multi)).toMatchObject(expected);
  });

  it("derives a one-item list when only the primary is set", () => {
    expect(draftToAdminPayload(baseDraft)).toMatchObject({
      event_type: "social",
      event_types: ["social"],
    });
  });

  it("persists an NYC borough through every legacy payload and drops it outside NYC", () => {
    const nyc: EventFormDraft = { ...baseDraft, city: "new-york-city", sublocation: "brooklyn" };
    const actor = { id: "u1", email: "u@example.com" };
    expect(draftToSubmission(nyc, actor).sublocation).toBe("brooklyn");
    expect(draftToUserPayload(nyc).sublocation).toBe("brooklyn");
    expect(draftToAdminPayload(nyc).sublocation).toBe("brooklyn");

    const moved: EventFormDraft = { ...nyc, city: "boston" };
    expect(draftToSubmission(moved, actor).sublocation).toBeNull();
    expect(draftToUserPayload(moved).sublocation).toBeNull();
    expect(draftToAdminPayload(moved).sublocation).toBeNull();

    expect(draftToAdminPayload({ ...nyc, sublocation: "" }).sublocation).toBeNull();
  });
});
