import { supabase } from "../../lib/supabase";

/**
 * Client side of the event-submission transactional emails.
 *
 * WHAT THIS REPLACED, AND WHY
 * The previous implementation built a full email payload in the browser
 * (`from`, `to`, `subject`, `html`) and posted it to a `send-email` Edge
 * Function that forwarded it to Resend verbatim. Two problems:
 *
 *   1. It was an open relay. Any visitor holding the publishable key could
 *      call `send-email` with any recipient and any body, and the mail would
 *      go out from a verified SalsaSegura domain.
 *   2. It didn't actually work for anonymous submitters. It read the
 *      moderator address via `fetchPlatformSettings()`, but
 *      `platform_settings` is granted to `authenticated` only — so for the
 *      anonymous submissions this feature exists to serve, the read failed
 *      and the notification was silently swallowed by the catch below.
 *
 * Now the browser sends only an id and an event name. The Edge Function reads
 * the recipient server-side from `event_submissions` and `platform_settings`
 * with the service role. The browser cannot name a recipient, cannot write
 * copy, and needs no access to platform settings.
 *
 * FIRE-AND-FORGET, ALWAYS
 * Database state is the source of truth; email is secondary. Every function
 * here resolves rather than throwing, so a mail failure can never surface as
 * a submission failure, undo an approval, or block navigation. Failures are
 * durably recorded in `event_submission_email_attempts` by the Edge Function
 * (queryable by moderators) — the `console.warn` here is only a dev-time
 * convenience, not the diagnostic record.
 */

export type SubmissionEmailEvent = "received" | "awaiting_review" | "approved" | "rejected";

export interface SubmissionEmailOutcome {
  success: boolean;
  deduplicated?: boolean;
  skipped?: string;
  error?: string;
}

async function requestSubmissionEmail(
  submissionId: string,
  event: SubmissionEmailEvent
): Promise<SubmissionEmailOutcome> {
  try {
    const { data, error } = await supabase.functions.invoke<SubmissionEmailOutcome>(
      "send-submission-email",
      { body: { submissionId, event } }
    );

    if (error) {
      console.warn(`Submission email (${event}) failed:`, error.message);
      return { success: false, error: error.message };
    }
    return data ?? { success: false, error: "No response from email function" };
  } catch (err) {
    console.warn(`Submission email (${event}) failed:`, err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * A. Confirmation to the submitter + B. notification to the moderation queue.
 *
 * Called immediately after a successful insert. The two are requested in
 * parallel and independently: the submitter's confirmation is not contingent
 * on the moderator notification succeeding, or vice versa.
 */
export async function notifySubmissionReceived(submissionId: string): Promise<void> {
  await Promise.allSettled([
    requestSubmissionEmail(submissionId, "received"),
    requestSubmissionEmail(submissionId, "awaiting_review"),
  ]);
}

/** C. Approval notice. Only ever called after the approval RPC succeeded. */
export async function notifySubmissionApproved(submissionId: string): Promise<void> {
  await requestSubmissionEmail(submissionId, "approved");
}

/** D. Rejection notice. Only ever called after the rejection update succeeded. */
export async function notifySubmissionRejected(submissionId: string): Promise<void> {
  await requestSubmissionEmail(submissionId, "rejected");
}
