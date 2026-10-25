import { EventSubmission } from "./submissions";

/**
 * Merges the submitted data with moderator edits.
 * Moderator edits take precedence.
 */
export function getEffectiveEventData(submission: EventSubmission): Record<string, unknown> {
  return {
    ...submission.submitted_data,
    ...(submission.edited_data || {}),
  };
}
