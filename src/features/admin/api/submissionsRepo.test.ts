import { describe, expect, it, vi } from "vitest";
import {
  approveSubmissionWithTaxonomy,
  createSubmission,
  submissionsRepo,
} from "./submissionsRepo";
import { supabase } from "../../../lib/supabase";

const queryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  insert: vi.fn().mockResolvedValue({ error: null }),
  single: vi.fn().mockResolvedValue({ data: {}, error: null }),
};
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => queryBuilder),
    rpc,
  },
}));

describe("submissionsRepo", () => {
  it("should fetch pending submissions", async () => {
    await submissionsRepo.getPendingSubmissions();
    expect(supabase.from).toHaveBeenCalledWith("event_submissions");
  });

  it("should fetch submission by id", async () => {
    await submissionsRepo.getSubmissionById("123");
    expect(supabase.from).toHaveBeenCalledWith("event_submissions");
  });

  it("should update submission", async () => {
    await submissionsRepo.updateSubmission("123", { status: "approved" });
    expect(supabase.from).toHaveBeenCalledWith("event_submissions");
  });

  it("inserts public submissions without requesting returned rows", async () => {
    queryBuilder.select.mockClear();
    queryBuilder.insert.mockClear();

    await createSubmission({
      submitter_id: null,
      submitter_email: "anon@example.com",
      submitter_name: "Anonymous Dancer",
      title: "Public Salsa Night",
      description: null,
      event_type: "social",
      city: "boston",
      event_date: "2026-08-20T20:00:00Z",
      event_time: null,
      location: null,
      address: null,
      price_type: null,
      price_amount: null,
      rsvp_link: null,
      recurrence: null,
      dance_styles: [],
    });

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        submitter_id: null,
        submitter_email: "anon@example.com",
        submitter_name: "Anonymous Dancer",
        status: "pending",
        submitted_data: expect.objectContaining({
          title: "Public Salsa Night",
          city: "boston",
        }),
      })
    );
    expect(queryBuilder.select).not.toHaveBeenCalled();
  });

  it("approves through the atomic taxonomy RPC", async () => {
    rpc.mockResolvedValue({ data: "event-id", error: null });
    await expect(approveSubmissionWithTaxonomy("submission-id", ["salsa-id"])).resolves.toBe(
      "event-id"
    );
    expect(rpc).toHaveBeenCalledWith("approve_event_submission", {
      p_submission_id: "submission-id",
      p_taxonomy_term_ids: ["salsa-id"],
    });
  });
});
