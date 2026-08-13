import { describe, expect, it } from "vitest";
import { checkSubmissionQuality } from "./quality";
import type { EventSubmission } from "./submissions";

function makeSubmission(
  submittedData: EventSubmission["submitted_data"],
): EventSubmission {
  return {
    id: "sub-1",
    submitter_id: "user-1",
    submitter_email: "submitter@example.com",
    submitter_name: "Submitter",
    status: "pending",
    submitted_data: submittedData,
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

describe("checkSubmissionQuality", () => {
  it("should identify required gaps", () => {
    const submission = makeSubmission({
      title: "",
      event_date: null,
      city: "",
      event_type: null,
    });

    const gaps = checkSubmissionQuality(submission);
    expect(gaps).toContainEqual({ issue: "title", tier: "required" });
    expect(gaps).toContainEqual({ issue: "event_date", tier: "required" });
    expect(gaps).toContainEqual({ issue: "city", tier: "required" });
    expect(gaps).toContainEqual({ issue: "event_type", tier: "required" });
  });

  it("should identify recommended gaps", () => {
    const submission = makeSubmission({
      title: "Valid",
      event_date: "2026-08-24",
      city: "boston",
      event_type: "social",
      location: null,
      event_time: null,
      description: null,
    });

    const gaps = checkSubmissionQuality(submission);
    expect(gaps).toContainEqual({ issue: "location", tier: "recommended" });
    expect(gaps).toContainEqual({ issue: "event_time", tier: "recommended" });
    expect(gaps).toContainEqual({ issue: "description", tier: "recommended" });
  });
});
