import type { EventType, City, DatabaseEvent } from "../../../types/events";
import { buildInitialForm, validateSubmitForm } from "../../submit-event/validation";
import type { SubmitForm } from "../../submit-event/validation";
import { toEventDateInstant, fromEventDateInstant } from "../../events/model/eventDateTime";
import type { AdminEventPayload } from "../../events/api/eventsRepo";

export type AdminEventForm = Omit<SubmitForm, "dance_styles"> & {
  host: string;
  image_url: string;
  contact_email: string;
  contact_instagram: string;
  contact_website: string;
  taxonomy_term_ids: string[];
  venue_id: string;
};

const HOST_MAX_LENGTH = 300;
const INSTAGRAM_MAX_LENGTH = 100;

export function buildEmptyAdminForm(city: City): AdminEventForm {
  return {
    ...buildInitialForm(city),
    host: "",
    image_url: "",
    contact_email: "",
    contact_instagram: "",
    contact_website: "",
    taxonomy_term_ids: [],
    venue_id: "",
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
    location: event.location ?? "",
    address: event.address ?? "",
    price_type: event.price_type ?? "",
    price_amount: event.price_amount != null ? String(event.price_amount) : "",
    rsvp_link: event.rsvp_link ?? "",
    submitter_name: "",
    submitter_email: "",
    recurrence: event.recurrence === "weekly" ? "weekly" : "",
    host: event.host ?? "",
    image_url: event.image_url ?? "",
    contact_email: event.contact_email ?? "",
    contact_instagram: event.contact_instagram ?? "",
    contact_website: event.contact_website ?? "",
    taxonomy_term_ids: event.taxonomy_term_ids ?? [],
    venue_id: event.venue_id ?? "",
  };
}

export function adminFormToPayload(form: AdminEventForm): AdminEventPayload {
  return {
    title: form.title,
    description: form.description || null,
    event_type: form.event_type as EventType,
    city: form.city,
    event_date: toEventDateInstant(form.event_date, form.event_time),
    event_time: form.event_time || null,
    location: form.location || null,
    address: form.address || null,
    price_type: form.price_type === "free" || form.price_type === "paid" ? form.price_type : null,
    price_amount: form.price_amount ? parseFloat(form.price_amount) : null,
    rsvp_link: form.rsvp_link || null,
    host: form.host || null,
    image_url: form.image_url || null,
    recurrence: form.recurrence || null,
    contact_email: form.contact_email || null,
    contact_instagram: form.contact_instagram || null,
    contact_website: form.contact_website || null,
    taxonomy_term_ids: form.taxonomy_term_ids,
    venue_id: form.venue_id || null,
  };
}

export function validateAdminEventForm(form: AdminEventForm): string | null {
  const submitFormError = validateSubmitForm({ ...form, dance_styles: [] });
  if (submitFormError) {
    return submitFormError;
  }

  if (form.host.length > HOST_MAX_LENGTH) {
    return `Host must be ${HOST_MAX_LENGTH} characters or fewer.`;
  }

  if (form.image_url) {
    try {
      if (!new URL(form.image_url).protocol.startsWith("http")) {
        return "Image URL must be a valid HTTP or HTTPS URL.";
      }
    } catch {
      return "Image URL must be a valid HTTP or HTTPS URL.";
    }
  }

  if (form.contact_website) {
    try {
      if (!new URL(form.contact_website).protocol.startsWith("http")) {
        return "Contact website must be a valid HTTP or HTTPS URL.";
      }
    } catch {
      return "Contact website must be a valid HTTP or HTTPS URL.";
    }
  }

  if (form.contact_email && !/^\S+@\S+\.\S+$/.test(form.contact_email)) {
    return "Contact email must be a valid email address.";
  }

  if (form.contact_instagram.length > INSTAGRAM_MAX_LENGTH) {
    return `Instagram handle must be ${INSTAGRAM_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}
