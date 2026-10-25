import type { EventFormDraft } from "../model/EventForm";
import type { SubmissionCreate } from "../../admin/api/submissionsRepo";
import type { UserEventUpdatePayload, AdminEventPayload } from "../api/eventsRepo";
import { toEventDateInstant } from "../model/eventDateTime";
import { eventTypePayload } from "../model/eventTypeSelection";
import { flyerPayload } from "../model/eventFlyers";
import { normalizeSubLocation } from "../../metros/model/sublocation";

export function draftToSubmission(
  draft: EventFormDraft,
  actor: { id: string | null; email: string | null }
): SubmissionCreate {
  const event_date = toEventDateInstant(draft.event_date, draft.event_time);
  return {
    submitter_id: actor.id,
    submitter_email: actor.email || draft.submitter_email,
    submitter_name: draft.submitter_name,
    title: draft.title,
    description: draft.description || null,
    ...eventTypePayload(draft),
    event_date: event_date,
    event_time: draft.event_time || null,
    location: draft.location || null,
    address: draft.address || null,
    price_type:
      draft.price_type === "free" || draft.price_type === "paid" ? draft.price_type : null,
    price_amount: draft.price_amount ? parseFloat(draft.price_amount) : null,
    rsvp_link: draft.rsvp_link || null,
    dance_styles: draft.dance_styles,
    recurrence: draft.recurrence || null,
    city: draft.city,
    sublocation: normalizeSubLocation(draft.city, draft.sublocation),
    ...(draft.entity_review ? { entity_review: draft.entity_review } : {}),
  };
}

export function draftToUserPayload(draft: EventFormDraft): UserEventUpdatePayload {
  const event_date = toEventDateInstant(draft.event_date, draft.event_time);
  return {
    title: draft.title,
    description: draft.description || null,
    ...eventTypePayload(draft),
    event_date: event_date,
    event_time: draft.event_time || null,
    location: draft.location || null,
    address: draft.address || null,
    price_type:
      draft.price_type === "free" || draft.price_type === "paid" ? draft.price_type : null,
    price_amount: draft.price_amount ? parseFloat(draft.price_amount) : null,
    rsvp_link: draft.rsvp_link || null,
    recurrence: draft.recurrence || null,
    city: draft.city,
    sublocation: normalizeSubLocation(draft.city, draft.sublocation),
    ...flyerPayload(draft.image_urls),
  };
}

export function draftToAdminPayload(draft: EventFormDraft): AdminEventPayload {
  const event_date = toEventDateInstant(draft.event_date, draft.event_time);
  return {
    title: draft.title,
    description: draft.description || null,
    ...eventTypePayload(draft),
    event_date: event_date,
    event_time: draft.event_time || null,
    location: draft.location || null,
    address: draft.address || null,
    price_type:
      draft.price_type === "free" || draft.price_type === "paid" ? draft.price_type : null,
    price_amount: draft.price_amount ? parseFloat(draft.price_amount) : null,
    rsvp_link: draft.rsvp_link || null,
    recurrence: draft.recurrence || null,
    city: draft.city,
    sublocation: normalizeSubLocation(draft.city, draft.sublocation),
    ...flyerPayload(draft.image_urls),
    host: draft.host || null,
    contact_email: draft.contact_email || null,
    contact_instagram: draft.contact_instagram || null,
    contact_website: draft.contact_website || null,
    venue_id: draft.venue_id || null,
    taxonomy_term_ids: draft.taxonomy_term_ids,
    ...(draft.entity_review ? { entity_review: draft.entity_review } : {}),
  };
}
