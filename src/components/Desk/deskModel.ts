import type { EventSubmission } from "../../features/admin/model/submissions";

/**
 * Non-component vocabulary of the listings desk. It lives outside the
 * component files so those stay component-only and hot reload cleanly.
 */

/** The state palette law. One state, one colour, one mark. */
export type DeskState = "unset" | "set" | "killed" | "standing" | "tonight";

export const DESK_STATE_LABEL: Record<DeskState, string> = {
  unset: "Awaiting decision",
  set: "Published",
  killed: "Rejected",
  standing: "Draft",
  tonight: "Tonight",
};

export interface DeskListing {
  id: string;
  title: string;
  /** ISO timestamp. Positions the entry on the time axis. */
  date: string | null;
  venue: string | null;
  state: DeskState;
  to?: string;
  /** Short state words shown after the venue, e.g. "No venue". */
  flags?: string[];
  flyerUrl?: string | null;
}

export interface DeskCount {
  id: string;
  /** Counts that represent work carry the unset colour. */
  work?: boolean;
  value: number;
  label: string;
  to?: string;
  /** Set for one render after a decision, to pulse the figure. */
  settled?: boolean;
}

export interface SubmissionView {
  title: string;
  date: string | null;
  venue: string | null;
  address: string | null;
  description: string | null;
  flyerUrl: string | null;
  taxonomyTermIds: string[];
}

/**
 * A submission's own edits win over what was originally submitted, so the
 * desk always reads the version a moderator is actually deciding on.
 */
export function readSubmission(submission: EventSubmission): SubmissionView {
  const data = { ...submission.submitted_data, ...(submission.edited_data ?? {}) };
  const text = (key: string): string | null => {
    const value = data[key];
    return typeof value === "string" && value.trim() ? value : null;
  };

  return {
    title: text("title") ?? "Untitled event",
    date: text("event_date"),
    venue: text("location"),
    address: text("address"),
    description: text("description"),
    flyerUrl: text("image_url"),
    taxonomyTermIds: Array.isArray(data.taxonomy_term_ids)
      ? (data.taxonomy_term_ids as string[])
      : [],
  };
}
