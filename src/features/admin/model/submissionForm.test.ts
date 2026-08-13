import { describe, expect, it } from "vitest";
import { getEffectiveEventData } from "./submissionForm";
import type { EventSubmission } from "./submissions";

function makeSubmission(
  submittedData: EventSubmission["submitted_data"],
  editedData: EventSubmission["edited_data"] = null,
): EventSubmission {
  return {
    id: "sub-1",
    submitter_id: "user-1",
    submitter_email: "submitter@example.com",
    submitter_name: "Submitter",
    status: "pending",
    submitted_data: submittedData,
    edited_data: editedData,
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

describe("getEffectiveEventData", () => {
  it("should return submitted data when no edits exist", () => {
    const submission = makeSubmission({ title: "Test Event" });

    expect(getEffectiveEventData(submission)).toEqual({ title: "Test Event" });
  });

  it("should merge edits when they exist", () => {
    const submission = makeSubmission(
      { title: "Test Event", location: "Old Venue" },
      { location: "New Venue" },
    );

    expect(getEffectiveEventData(submission)).toEqual({
      title: "Test Event",
      location: "New Venue",
    });
  });
});
