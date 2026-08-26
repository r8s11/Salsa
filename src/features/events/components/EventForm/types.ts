import type { City, EventType } from "../../model/types";
import { toEventDateInstant } from "../../model/eventDateTime";
import type { SubmissionCreate } from "../../../admin/api/submissionsRepo";
import type { AdminEventPayload, UserEventUpdatePayload } from "../../api/eventsRepo";

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

export type EventFormCapabilities = {
  styles: "slug-chips" | "taxonomy-chips" | "none";
  attributes: boolean;
  venue: "free-text" | "combobox";
  flyer: boolean;
  hostAndContact: boolean;
  submitterInfo: boolean;
};

export const CAPABILITIES: Record<
  "submit" | "organizerEdit" | "organizerSubmissionEdit" | "admin",
  EventFormCapabilities
> = {
  submit: {
    styles: "slug-chips",
    attributes: false,
    venue: "free-text",
    flyer: false,
    hostAndContact: false,
    submitterInfo: true,
  },
  organizerEdit: {
    styles: "slug-chips",
    attributes: false,
    venue: "free-text",
    flyer: true,
    hostAndContact: false,
    submitterInfo: false,
  },
  // A moderation submission has no canonical event id yet. Storage policy
  // paths are event-id based, so pre-approval flyer upload remains unavailable
  // instead of pretending the image will survive approval.
  organizerSubmissionEdit: {
    styles: "slug-chips",
    attributes: false,
    venue: "free-text",
    flyer: false,
    hostAndContact: false,
    submitterInfo: false,
  },
  admin: {
    styles: "taxonomy-chips",
    attributes: true,
    venue: "combobox",
    flyer: true,
    hostAndContact: true,
    submitterInfo: false,
  },
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
    event_type: draft.event_type as EventType,
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
    event_type: draft.event_type as EventType,
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

export function draftToAdminPayload(draft: EventFormDraft): AdminEventPayload {
  return {
    title: draft.title,
    description: draft.description || null,
    event_type: draft.event_type as EventType,
    city: draft.city,
    event_date: toEventDateInstant(draft.event_date, draft.event_time),
    event_time: draft.event_time || null,
    location: draft.location || null,
    address: draft.address || null,
    price_type: draft.price_type || null,
    price_amount: priceAmount(draft),
    rsvp_link: draft.rsvp_link || null,
    recurrence: draft.recurrence || null,
    host: draft.host || null,
    image_url: draft.image_url || null,
    contact_email: draft.contact_email || null,
    contact_instagram: draft.contact_instagram || null,
    contact_website: draft.contact_website || null,
    taxonomy_term_ids: draft.taxonomy_term_ids,
    venue_id: draft.venue_id || null,
  };
}
