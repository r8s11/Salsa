import { supabase } from "../../../lib/supabase";
import { getFirstTouch } from "../../../shared/analytics/attribution";
import type { EventSubmission } from "../model/submissions";
import type { EventType } from "../../events/model/types";
import type { EntityReview } from "../../entity-matching/entityReview";

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
  /** Full ordered selection; `event_type` is its first member. */
  event_types: EventType[];
  city: string;
  sublocation: string | null;
  neighborhood: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: string | null;
  price_amount: number | null;
  rsvp_link: string | null;
  recurrence: string | null;
  dance_styles: string[];
  entity_review?: EntityReview;
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
  const {
    submitter_id: _s,
    submitter_email: _e,
    submitter_name: _n,
    ...submitted_data
  } = submission;

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
    // How this tab arrived (UTM/referrer host), or null for a direct visit.
    first_touch: getFirstTouch(),
  });

  if (error) throw error;
  return id;
}

/** Why a signed-in member's submission went to review instead of publishing. */
export type AutoPublishBlockReason =
  | "disabled"
  | "inactive"
  | "email_unverified"
  | "daily_limit"
  | "recurring"
  | "not_pending"
  | "needs_review";

/**
 * `unconfirmed`: the submission is saved but neither the publish response nor
 * a follow-up status read arrived, so the outcome must not be claimed.
 */
export type PublishOwnSubmissionResult =
  | { published: true; eventId: string }
  | { published: false; reason: AutoPublishBlockReason }
  | { published: "unconfirmed" };

/**
 * Publishes the caller's own pending submission when they are eligible.
 * The server decides eligibility; an ineligible or incomplete submission
 * stays pending for moderator review and the reason comes back.
 */
export async function publishOwnSubmission(id: string): Promise<PublishOwnSubmissionResult> {
  const { data, error } = await supabase.rpc("publish_own_event_submission", {
    p_submission_id: id,
  });
  if (error) throw new Error(`Failed to publish submission: ${error.message}`);
  const result = data as { published: boolean; event_id?: string; reason?: AutoPublishBlockReason };
  return result.published && result.event_id
    ? { published: true, eventId: result.event_id }
    : { published: false, reason: result.reason ?? "needs_review" };
}

/**
 * After a lost publish response: what actually happened to the caller's own
 * submission. Never throws; an unreadable status is `unconfirmed`.
 */
export async function readOwnSubmissionOutcome(id: string): Promise<PublishOwnSubmissionResult> {
  const { data, error } = await supabase
    .from("event_submissions")
    .select("status, approved_event_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return { published: "unconfirmed" };
  if (data.status === "approved" && data.approved_event_id) {
    return { published: true, eventId: data.approved_event_id as string };
  }
  return data.status === "pending"
    ? { published: false, reason: "needs_review" }
    : { published: "unconfirmed" };
}

/** The caller's current block reason, or null when their next submission publishes straight away. */
export async function fetchMyAutoPublishBlockReason(): Promise<AutoPublishBlockReason | null> {
  const { data, error } = await supabase.rpc("my_auto_publish_block_reason");
  if (error) throw new Error(`Failed to check publishing access: ${error.message}`);
  return (data as AutoPublishBlockReason | null) ?? null;
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
