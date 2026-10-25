import type { EventSubmission } from "../../admin/model/submissions";
import type { City, DatabaseEvent, EventTaxonomyTerm, EventType } from "../../events/model/types";
import { eventTypeFieldsFrom } from "../../events/model/eventTypeSelection";

type SubmissionData = Record<string, unknown>;

function stringValue(data: SubmissionData, key: string, fallback = ""): string {
  return typeof data[key] === "string" ? data[key] : fallback;
}

function nullableString(data: SubmissionData, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value ? value : null;
}

/** Both fields come from one ordered list; a submission with no valid type reads as social. */
function eventTypes(data: SubmissionData): { event_type: EventType; event_types: EventType[] } {
  const { event_types } = eventTypeFieldsFrom(data);
  return event_types.length
    ? { event_type: event_types[0], event_types }
    : { event_type: "social", event_types: ["social"] };
}

function city(data: SubmissionData): City {
  return typeof data.city === "string" ? data.city : "";
}

function priceType(data: SubmissionData): "free" | "paid" | null {
  return data.price_type === "free" || data.price_type === "paid" ? data.price_type : null;
}

function priceAmount(data: SubmissionData): number | null {
  return typeof data.price_amount === "number" && Number.isFinite(data.price_amount)
    ? data.price_amount
    : null;
}

function danceStyles(data: SubmissionData): EventTaxonomyTerm[] {
  if (!Array.isArray(data.dance_styles)) return [];
  return data.dance_styles.flatMap((style) => {
    if (typeof style !== "string" || !style) return [];
    return [
      {
        id: `submitted-style:${style}`,
        name: style,
        slug: style,
        category: "dance_style" as const,
        status: "active" as const,
      },
    ];
  });
}

/**
 * Projects an owner-editable moderation submission into the existing Host
 * DatabaseEvent view. This keeps Dashboard, My Events, detail, and edit
 * routes on one display model while preserving event_submissions as source of
 * truth until a moderator creates the canonical approved event.
 */
export function submissionToDatabaseEvent(submission: EventSubmission): DatabaseEvent | null {
  if (submission.status !== "pending" && submission.status !== "rejected") return null;

  const edits = submission.edited_data ?? {};
  const data: SubmissionData = { ...submission.submitted_data, ...edits };
  // An edit that sets only the primary supersedes the originally submitted list.
  if ("event_type" in edits && !("event_types" in edits)) delete data.event_types;
  const taxonomyTerms = danceStyles(data);

  return {
    id: submission.id,
    submission_id: submission.id,
    title: stringValue(data, "title", "Untitled event"),
    description: nullableString(data, "description"),
    ...eventTypes(data),
    event_date: stringValue(data, "event_date", submission.submitted_at),
    event_time: nullableString(data, "event_time"),
    location: nullableString(data, "location"),
    address: nullableString(data, "address"),
    price_type: priceType(data),
    price_amount: priceAmount(data),
    rsvp_link: nullableString(data, "rsvp_link"),
    image_url: null,
    submitter_name: submission.submitter_name,
    submitter_email: submission.submitter_email,
    submitter_id: submission.submitter_id,
    status: submission.status,
    source_type: "user_submission",
    taxonomy_term_ids: [],
    taxonomy_terms: taxonomyTerms,
    updated_at: submission.updated_at,
    cancellation_reason: null,
    city: city(data),
    sublocation: nullableString(data, "sublocation"),
    created_at: submission.created_at,
    host: null,
    recurrence: data.recurrence === "weekly" ? "weekly" : null,
    gallery: null,
    contact_email: null,
    contact_instagram: null,
    contact_website: null,
    venue_id: null,
  };
}
