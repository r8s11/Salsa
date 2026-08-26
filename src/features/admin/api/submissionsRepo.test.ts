import { describe, expect, it, vi } from "vitest";
import {
  approveSubmissionWithTaxonomy,
  createSubmission,
  fetchOwnEventSubmissions,
  submissionsRepo,
  updateOwnEventSubmission,
  withdrawOwnEventSubmission,
} from "./submissionsRepo";
import { supabase } from "../../../lib/supabase";

const queryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  insert: vi.fn().mockResolvedValue({ error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "submission-id" }, error: null }),
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
  it("fetches pending submissions", async () => {
    await submissionsRepo.getPendingSubmissions();
    expect(supabase.from).toHaveBeenCalledWith("event_submissions");
  });

  it("fetches submission by id", async () => {
    await submissionsRepo.getSubmissionById("123");
    expect(supabase.from).toHaveBeenCalledWith("event_submissions");
  });

  it("updates submission as a reviewer", async () => {
    await submissionsRepo.updateSubmission("123", { status: "approved" });
    expect(supabase.from).toHaveBeenCalledWith("event_submissions");
  });

  it("fetches only owner-editable lifecycle submissions", async () => {
    await fetchOwnEventSubmissions("owner-1");

    expect(supabase.from).toHaveBeenCalledWith("event_submissions");
    expect(queryBuilder.eq).toHaveBeenCalledWith("submitter_id", "owner-1");
    expect(queryBuilder.in).toHaveBeenCalledWith("status", ["pending", "rejected"]);
  });

  it("persists only edited_data for an owner submission", async () => {
    await updateOwnEventSubmission("submission-1", { title: "Revised title" });

    expect(queryBuilder.update).toHaveBeenCalledWith({ edited_data: { title: "Revised title" } });
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "submission-1");
  });

  it("withdraws through status=withdrawn instead of deleting history", async () => {
    await withdrawOwnEventSubmission("submission-1");

    expect(queryBuilder.update).toHaveBeenCalledWith({ status: "withdrawn" });
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "submission-1");
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

  it("approves through atomic taxonomy RPC", async () => {
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
