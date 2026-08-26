import { describe, it, expect } from "vitest";
import { draftToSubmission, draftToUserPayload, draftToAdminPayload } from "./eventFormAdapters";
import type { EventFormDraft } from "../model/EventForm";

const baseDraft: EventFormDraft = {
  title: "Test Event",
  description: "Test Description",
  event_type: "social",
  city: "boston",
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
});
