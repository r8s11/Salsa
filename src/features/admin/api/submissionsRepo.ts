import { supabase } from "../../../lib/supabase";
import type { EventSubmission } from "../model/submissions";

export interface SubmissionUpdate {
  status?: EventSubmission["status"];
  edited_data?: Record<string, unknown>;
  rejection_reason?: EventSubmission["rejection_reason"];
  rejection_message?: string;
  internal_note?: string;
  duplicate_of_event_id?: string | null;
  approved_event_id?: string | null;
}

export type SubmissionCreate = {
  submitter_id: string | null;
  submitter_email: string | null;
  submitter_name: string | null;
  title: string;
  description: string | null;
  event_type: string;
  city: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: string | null;
  price_amount: number | null;
  rsvp_link: string | null;
  recurrence: string | null;
  dance_styles: string[];
};

/**
 * Inserts a submission and returns its id.
 *
 * The id is generated client-side rather than read back from the insert
 * because anonymous callers hold only an INSERT grant on
 * `event_submissions` — `.insert().select()` would need SELECT and fails for
 * exactly the anonymous path this feature serves. A caller-supplied UUID is
 * safe here: it is only a lookup key, never an authorization token. The
 * Edge Function that consumes it re-reads the row server-side and derives
 * every recipient from that row, so knowing or guessing an id grants nothing.
 */
export async function createSubmission(
  submission: SubmissionCreate,
  extraSubmittedData?: Record<string, unknown>
): Promise<string> {
  const submitter_id = submission.submitter_id;
  const submitter_email = submission.submitter_email;
  const submitter_name = submission.submitter_name;
  const { submitter_id: _s, submitter_email: _e, submitter_name: _n, ...submitted_data } = submission;

  const id = crypto.randomUUID();

  const { error } = await supabase.from("event_submissions").insert({
    id,
    submitter_id,
    submitter_email,
    submitter_name,
    status: "pending",
    submitted_data: { ...submitted_data, ...(extraSubmittedData ?? {}) },
    edited_data: null,
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    rejection_message: null,
    internal_note: null,
    duplicate_of_event_id: null,
    dismissed_duplicate_ids: [],
    approved_event_id: null,
  });

  if (error) throw error;
  return id;
}

/**
 * Owner-visible moderation records that can still be edited. RLS remains the
 * authority; the explicit user filter documents the intended lifecycle and
 * avoids downloading withdrawn/approved history into Host screens.
 */
export async function fetchOwnEventSubmissions(userId: string): Promise<EventSubmission[]> {
  const { data, error } = await supabase
    .from("event_submissions")
    .select("*")
    .eq("submitter_id", userId)
    .in("status", ["pending", "rejected"])
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(`Failed to load your submissions: ${error.message}`);
  return (data ?? []) as EventSubmission[];
}

async function requireUpdatedOwnerSubmission(
  id: string,
  update: { edited_data?: Record<string, unknown>; status?: "withdrawn" }
): Promise<void> {
  const { data, error } = await supabase
    .from("event_submissions")
    .update(update)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Failed to update submission: ${error.message}`);
  if (!data) throw new Error("Submission could not be updated.");
}

export async function updateOwnEventSubmission(
  id: string,
  editedData: Record<string, unknown>
): Promise<void> {
  await requireUpdatedOwnerSubmission(id, { edited_data: editedData });
}

export async function withdrawOwnEventSubmission(id: string): Promise<void> {
  await requireUpdatedOwnerSubmission(id, { status: "withdrawn" });
}

export async function approveSubmissionWithTaxonomy(
  submissionId: string,
  taxonomyTermIds: string[]
): Promise<string> {
  const { data, error } = await supabase.rpc("approve_event_submission", {
    p_submission_id: submissionId,
    p_taxonomy_term_ids: taxonomyTermIds,
  });
  if (error) throw new Error(`Failed to approve submission: ${error.message}`);
  return data as string;
}
export const submissionsRepo = {
  async getPendingSubmissions() {
    const { data, error } = await supabase
      .from("event_submissions")
      .select("*")
      .eq("status", "pending")
      .order("submitted_at", { ascending: false });

    if (error) throw error;
    return data;
  },

  async getSubmissionById(id: string) {
    const { data, error } = await supabase
      .from("event_submissions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async updateSubmission(id: string, update: SubmissionUpdate) {
    const { data, error } = await supabase
      .from("event_submissions")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  createSubmission,
  approveSubmissionWithTaxonomy,
};
