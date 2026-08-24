import type { SubmissionCreate } from "../../admin/api/submissionsRepo";
import type { UserEventUpdatePayload } from "../api/eventsRepo";
import { toEventDateInstant } from "./eventDateTime";
import type { City, EventType } from "./types";

export type EventFormDraft = {
  title: string;
  description: string;
  event_type: EventType | "";
  city: City;
  event_date: string;
  event_time: string;
  recurrence: "weekly" | "";
  location: string;
  address: string;
  venue_id: string;
  price_type: "free" | "paid" | "";
  price_amount: string;
  rsvp_link: string;
  image_url: string;
  host: string;
  contact_email: string;
  contact_instagram: string;
  contact_website: string;
  submitter_name: string;
  submitter_email: string;
  dance_styles: string[];
  taxonomy_term_ids: string[];
};

type Actor = { id: string; email: string | null } | null;

function priceAmount(draft: EventFormDraft): number | null {
  if (draft.price_type !== "paid") return null;
  const parsed = Number.parseFloat(draft.price_amount);
  return Number.isFinite(parsed) ? parsed : null;
}

export function draftToSubmission(draft: EventFormDraft, actor: Actor): SubmissionCreate {
  return {
    submitter_id: actor?.id ?? null,
    submitter_email: actor?.email ?? (draft.submitter_email || null),
    submitter_name: draft.submitter_name || null,
    title: draft.title,
    description: draft.description || null,
    event_type: draft.event_type,
    city: draft.city,
    event_date: toEventDateInstant(draft.event_date, draft.event_time),
    event_time: draft.event_time || null,
    location: draft.location || null,
    address: draft.address || null,
    price_type: draft.price_type || null,
    price_amount: priceAmount(draft),
    rsvp_link: draft.rsvp_link || null,
    recurrence: draft.recurrence || null,
    dance_styles: draft.dance_styles,
  };
}

export function draftToUserPayload(draft: EventFormDraft): UserEventUpdatePayload {
  return {
    title: draft.title,
    description: draft.description || null,
    event_type: draft.event_type,
    city: draft.city,
    event_date: toEventDateInstant(draft.event_date, draft.event_time),
    event_time: draft.event_time || null,
    location: draft.location || null,
    address: draft.address || null,
    price_type: draft.price_type || null,
    price_amount: priceAmount(draft),
    rsvp_link: draft.rsvp_link || null,
    recurrence: draft.recurrence || null,
    dance_styles: draft.dance_styles,
    image_url: draft.image_url || null,
  };
}
