import type { City, DatabaseEvent } from "../../events/model/types";
import type { EventFormDraft } from "../../events/components/EventForm";
import { buildInitialForm, validateSubmitForm } from "../../submit-event/validation";
import { fromEventDateInstant } from "../../events/model/eventDateTime";

export type AdminEventForm = EventFormDraft;
export const HOST_MAX_LENGTH = 300;
export const INSTAGRAM_MAX_LENGTH = 100;

export function buildEmptyAdminForm(city: City): AdminEventForm {
  return {
    ...buildInitialForm(city),
    venue_id: "",
    image_url: "",
    host: "",
    contact_email: "",
    contact_instagram: "",
    contact_website: "",
    taxonomy_term_ids: [],
  };
}

export function buildAdminFormFromEvent(event: DatabaseEvent): AdminEventForm {
  const { date, time } = fromEventDateInstant(event.event_date);
  return {
    title: event.title,
    description: event.description ?? "",
    event_type: event.event_type,
    city: event.city,
    event_date: date,
    event_time: time,
    recurrence: event.recurrence === "weekly" ? "weekly" : "",
    location: event.location ?? "",
    address: event.address ?? "",
    venue_id: event.venue_id ?? "",
    price_type: event.price_type ?? "",
    price_amount: event.price_amount == null ? "" : String(event.price_amount),
    rsvp_link: event.rsvp_link ?? "",
    image_url: event.image_url ?? "",
    host: event.host ?? "",
    contact_email: event.contact_email ?? "",
    contact_instagram: event.contact_instagram ?? "",
    contact_website: event.contact_website ?? "",
    submitter_name: "",
    submitter_email: "",
    dance_styles: [],
    taxonomy_term_ids: event.taxonomy_term_ids ?? [],
  };
}

export function validateAdminEventForm(form: AdminEventForm): string | null {
  const submitFormError = validateSubmitForm({
    title: form.title,
    description: form.description,
    event_type: form.event_type,
    city: form.city,
    event_date: form.event_date,
    event_time: form.event_time,
    location: form.location,
    address: form.address,
    price_type: form.price_type,
    price_amount: form.price_amount,
    rsvp_link: form.rsvp_link,
    submitter_name: form.submitter_name,
    submitter_email: form.submitter_email,
    recurrence: form.recurrence,
    dance_styles: form.dance_styles,
  });
  if (submitFormError) return submitFormError;
  if (form.host.length > HOST_MAX_LENGTH)
    return `Host must be ${HOST_MAX_LENGTH} characters or fewer.`;
  if (form.contact_email && !/^\S+@\S+\.\S+$/.test(form.contact_email))
    return "Contact email must be a valid email address.";
  if (form.contact_instagram.length > INSTAGRAM_MAX_LENGTH)
    return `Instagram handle must be ${INSTAGRAM_MAX_LENGTH} characters or fewer.`;
  for (const [label, value] of [
    ["Image URL", form.image_url],
    ["Contact website", form.contact_website],
  ] as const) {
    if (!value) continue;
    try {
      new URL(value);
    } catch {
      return `${label} must be a valid URL.`;
    }
  }
  return null;
}
