import { describe, expect, it } from "vitest";
import type { DatabaseEvent } from "../../events/model/types";
import { findVenueMatch } from "./venueMatching";
import type { EventSubmission } from "./submissions";

function makeSubmission(location: string): EventSubmission {
  return {
    id: "sub-1",
    submitter_id: "user-1",
    submitter_email: "submitter@example.com",
    submitter_name: "Submitter",
    status: "pending",
    submitted_data: { location },
    edited_data: null,
    submitted_at: "2026-08-20T10:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    rejection_message: null,
    internal_note: null,
    duplicate_of_event_id: null,
    dismissed_duplicate_ids: [],
    approved_event_id: null,
    created_at: "2026-08-20T10:00:00.000Z",
    updated_at: "2026-08-20T10:00:00.000Z",
  };
}

describe("findVenueMatch", () => {
  it("should detect an exact match", () => {
    const submission = makeSubmission("Havana Club");
    const existing = [{ location: "Havana Club" }] as DatabaseEvent[];
    const match = findVenueMatch(submission, existing);
    expect(match?.match).toBe("exact");
  });

  it("should detect a fuzzy match", () => {
    const submission = makeSubmission("Havana Club Salsa");
    const existing = [{ location: "Havana Club" }] as DatabaseEvent[];
    const match = findVenueMatch(submission, existing);
    expect(match?.match).toBe("fuzzy");
  });
});
