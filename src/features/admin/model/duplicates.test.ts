import { describe, expect, it } from "vitest";
import type { DatabaseEvent } from "../../events/model/types";
import { detectDuplicates } from "./duplicates";
import type { EventSubmission } from "./submissions";

function makeSubmission(overrides: Partial<EventSubmission> = {}): EventSubmission {
  return {
    id: "sub-1",
    submitter_id: "user-1",
    submitter_email: "submitter@example.com",
    submitter_name: "Submitter",
    status: "pending",
    submitted_data: {
      location: "Havana Club",
      event_date: "2026-08-24T18:00:00Z",
      title: "Salsa Night",
      host: "Maria",
    },
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
    ...overrides,
  };
}

describe("detectDuplicates", () => {
  it("should detect a duplicate based on venue and date", () => {
    const submission = makeSubmission();
    const candidate = {
      id: "1",
      title: "Salsa Night",
      location: "Havana Club",
      event_date: "2026-08-24T19:00:00Z",
      host: "Different",
    } as DatabaseEvent;

    const duplicates = detectDuplicates(submission, [candidate]);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].signals).toContain("same-venue");
    expect(duplicates[0].signals).toContain("same-date");
    expect(duplicates[0].confidence).toBe("high");
  });
});
