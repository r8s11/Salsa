import type { EventSubmission } from "../../admin/model/submissions";
import type { City, DatabaseEvent, EventTaxonomyTerm, EventType } from "../../events/model/types";

type SubmissionData = Record<string, unknown>;

function stringValue(data: SubmissionData, key: string, fallback = ""): string {
  return typeof data[key] === "string" ? data[key] : fallback;
}

function nullableString(data: SubmissionData, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value ? value : null;
}

function eventType(data: SubmissionData): EventType {
  const value = data.event_type;
  return value === "class" || value === "workshop" || value === "social" ? value : "social";
}

function city(data: SubmissionData): City {
  return data.city === "new-york-city" ? "new-york-city" : "boston";
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

  const data: SubmissionData = {
    ...submission.submitted_data,
    ...(submission.edited_data ?? {}),
  };
  const taxonomyTerms = danceStyles(data);

  return {
    id: submission.id,
    submission_id: submission.id,
    title: stringValue(data, "title", "Untitled event"),
    description: nullableString(data, "description"),
    event_type: eventType(data),
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
