import { describe, expect, it } from "vitest";
import type { EventSubmission } from "../../admin/model/submissions";
import { submissionToDatabaseEvent } from "./ownerSubmissions";

const pendingSubmission: EventSubmission = {
  id: "submission-1",
  submitter_id: "owner-1",
  submitter_email: "owner@example.test",
  submitter_name: "Owner",
  status: "pending",
  submitted_data: {
    title: "New Salsa Social",
    description: "Initial details",
    event_type: "social",
    city: "boston",
    event_date: "2026-10-10T20:00:00Z",
    event_time: "20:00",
    location: "Grand Ballroom",
    address: "1 Main St",
    price_type: "paid",
    price_amount: 20,
    rsvp_link: "https://tickets.example.test",
    recurrence: "weekly",
    dance_styles: ["salsa", "bachata"],
  },
  edited_data: null,
  submitted_at: "2026-08-25T00:00:00Z",
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  rejection_message: null,
  internal_note: null,
  duplicate_of_event_id: null,
  dismissed_duplicate_ids: [],
  approved_event_id: null,
  created_at: "2026-08-25T00:00:00Z",
  updated_at: "2026-08-25T00:00:00Z",
};

describe("submissionToDatabaseEvent", () => {
  it("projects an owner pending submission into Host lifecycle event data", () => {
    expect(submissionToDatabaseEvent(pendingSubmission)).toMatchObject({
      id: "submission-1",
      submission_id: "submission-1",
      title: "New Salsa Social",
      status: "pending",
      submitter_id: "owner-1",
      event_date: "2026-10-10T20:00:00Z",
      location: "Grand Ballroom",
      taxonomy_term_ids: [],
      taxonomy_terms: [
        { slug: "salsa", category: "dance_style" },
        { slug: "bachata", category: "dance_style" },
      ],
    });
  });
  it("preserves Live Music type when projecting an owner submission", () => {
    const event = submissionToDatabaseEvent({
      ...pendingSubmission,
      submitted_data: { ...pendingSubmission.submitted_data, event_type: "live_music" },
    });

    expect(event?.event_type).toBe("live_music");
  });

  it("uses owner edited_data without mutating immutable submitted_data", () => {
    const event = submissionToDatabaseEvent({
      ...pendingSubmission,
      status: "rejected",
      edited_data: { title: "Revised Salsa Social", location: "Studio 4B" },
    });

    expect(event).toMatchObject({
      title: "Revised Salsa Social",
      location: "Studio 4B",
      description: "Initial details",
      status: "rejected",
    });
    expect(pendingSubmission.submitted_data.title).toBe("New Salsa Social");
  });

  it("omits lifecycle states without owner edit routes", () => {
    expect(submissionToDatabaseEvent({ ...pendingSubmission, status: "withdrawn" })).toBeNull();
    expect(submissionToDatabaseEvent({ ...pendingSubmission, status: "approved" })).toBeNull();
  });
});

describe("submission event types", () => {
  it("projects the submitted ordered list with its first entry as primary", () => {
    const event = submissionToDatabaseEvent({
      ...pendingSubmission,
      submitted_data: {
        ...pendingSubmission.submitted_data,
        event_type: "concert",
        event_types: ["concert", "live_music"],
      },
    });

    expect(event).toMatchObject({ event_type: "concert", event_types: ["concert", "live_music"] });
  });

  it("reads a submission that only has the primary as a one-item list", () => {
    expect(submissionToDatabaseEvent(pendingSubmission)).toMatchObject({
      event_type: "social",
      event_types: ["social"],
    });
  });

  it("lets owner edits replace the submitted list and keeps edited selections on reload", () => {
    const event = submissionToDatabaseEvent({
      ...pendingSubmission,
      submitted_data: {
        ...pendingSubmission.submitted_data,
        event_type: "social",
        event_types: ["social", "class"],
      },
      edited_data: { event_type: "workshop", event_types: ["workshop", "concert", "class"] },
    });

    expect(event).toMatchObject({
      event_type: "workshop",
      event_types: ["workshop", "concert", "class"],
    });
  });

  it("does not let a stale submitted list override an edit that only set the primary", () => {
    const event = submissionToDatabaseEvent({
      ...pendingSubmission,
      submitted_data: {
        ...pendingSubmission.submitted_data,
        event_type: "social",
        event_types: ["social", "class"],
      },
      edited_data: { event_type: "workshop" },
    });

    expect(event).toMatchObject({ event_type: "workshop", event_types: ["workshop"] });
  });
});
