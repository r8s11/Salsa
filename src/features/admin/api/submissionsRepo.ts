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

export async function createSubmission(submission: SubmissionCreate) {
  const { submitter_id, submitter_email, submitter_name, ...submitted_data } = submission;

  const { error } = await supabase.from("event_submissions").insert({
    submitter_id,
    submitter_email,
    submitter_name,
    status: "pending",
    submitted_data,
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
