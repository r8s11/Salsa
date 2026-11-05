import type { EntityReview } from "../../../entity-matching/entityReview";
import type { City, EventType } from "../../model/types";
import { toEventDateInstant } from "../../model/eventDateTime";
import { eventTypePayload } from "../../model/eventTypeSelection";
import { resolveEventTimeZone, type TimeZoneResolution } from "../../../../shared/utils/timezone";
import type { SubmissionCreate } from "../../../admin/api/submissionsRepo";
import type { AdminEventPayload, UserEventUpdatePayload } from "../../api/eventsRepo";
import { eventFlyerList, flyerPayload } from "../../model/eventFlyers";
import { normalizeNeighborhood } from "../../../metros/model/neighborhood";
import { normalizeSubLocation, type SubLocation } from "../../../metros/model/sublocation";

export type EventFormDraft = {
  title: string;
  description: string;
  /** Primary category: the first selected type, which colors the calendar. "" when none. */
  event_type: EventType | "";
  /** Full ordered selection; `event_type` is always its first member. */
  event_types?: EventType[];
  city: City;
  /** Curated neighborhood slug; null means unassigned. */
  neighborhood?: string | null;
  /** Optional NYC borough; "" means All NYC. Only meaningful while `city` is New York City. */
  sublocation: SubLocation | "";
  event_date: string;
  event_time: string;
  recurrence: "weekly" | "";
  location: string;
  address: string;
  venue_id: string;
  price_type: "free" | "paid" | "";
  price_amount: string;
  rsvp_link: string;
  /** Primary flyer. Always the first of `image_urls` (or the lone legacy URL). */
  image_url: string;
  /** Ordered flyer list (max `MAX_FLYERS_PER_EVENT`); the first is the primary. */
  image_urls: string[];
  host: string;
  contact_email: string;
  contact_instagram: string;
  contact_website: string;
  submitter_name: string;
  submitter_email: string;
  dance_styles: string[];
  taxonomy_term_ids: string[];
  series_id?: string;
  /** Explicit IANA zone chosen for this event; wins over venue and metro. */
  time_zone?: string;
  /** Zone of the linked venue, carried so save and load resolve identically. */
  venue_time_zone?: string;
  /** Zone of the parent series, inherited by every occurrence. */
  series_time_zone?: string;
  entity_review?: EntityReview;
};

export type EventFormCapabilities = {
  styles: "slug-chips" | "taxonomy-chips" | "none";
  attributes: boolean;
  venue: "free-text" | "combobox";
  flyer: boolean;
  hostAndContact: boolean;
  /** Shows the time-zone control; only surfaces that can persist an explicit zone. */
  timeZone: boolean;
  submitterInfo: boolean;
};

export const CAPABILITIES: Record<
  "submit" | "organizerEdit" | "organizerCreate" | "organizerSubmissionEdit" | "admin",
  EventFormCapabilities
> = {
  submit: {
    styles: "slug-chips",
    attributes: false,
    venue: "free-text",
    flyer: false,
    hostAndContact: false,
    timeZone: false,
    submitterInfo: true,
  },
  organizerEdit: {
    styles: "slug-chips",
    attributes: false,
    venue: "free-text",
    flyer: true,
    hostAndContact: true,
    timeZone: false,
    submitterInfo: false,
  },
  organizerCreate: {
    styles: "slug-chips",
    attributes: false,
    venue: "free-text",
    flyer: true,
    hostAndContact: true,
    timeZone: false,
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
    timeZone: false,
    submitterInfo: false,
  },
  admin: {
    styles: "taxonomy-chips",
    attributes: true,
    venue: "combobox",
    flyer: true,
    hostAndContact: true,
    timeZone: true,
    submitterInfo: false,
  },
};

type Actor = { id: string; email: string | null; name?: string | null } | null;

/**
 * The zone a draft's wall-clock date/time is in: explicit choice, then series,
 * then venue, then the city's canonical metro. Load (fromEventDateInstant) and
 * save (toEventDateInstant) must both use this so an edit never shifts the hour.
 */
export function resolveDraftTimeZone(
  draft: Pick<EventFormDraft, "time_zone" | "series_time_zone" | "venue_time_zone" | "city">
): TimeZoneResolution {
  return resolveEventTimeZone({
    event: draft.time_zone,
    series: draft.series_time_zone,
    venue: draft.venue_time_zone,
    metro: draft.city,
  });
}

function draftInstant(draft: EventFormDraft): string {
  const zone = resolveDraftTimeZone(draft);
  if (!zone.ok) throw new Error(zone.message);
  return toEventDateInstant(draft.event_date, draft.event_time, zone.timeZone);
}

/** Ordered flyers of a draft; a draft that only carries the legacy `image_url` yields that one. */
export function draftFlyerUrls(draft: Pick<EventFormDraft, "image_url" | "image_urls">): string[] {
  return eventFlyerList(draft);
}

/** The borough that may be persisted: only an NYC draft with a known borough keeps one. */
export function draftSubLocation(draft: Pick<EventFormDraft, "city" | "sublocation">): SubLocation | null {
  return normalizeSubLocation(draft.city, draft.sublocation);
}
/** Only a catalog entry matching the draft's exact city and borough is persisted. */
export function draftNeighborhood(
  draft: Pick<EventFormDraft, "city" | "sublocation" | "neighborhood">
): string | null {
  return normalizeNeighborhood(draft.city, draftSubLocation(draft), draft.neighborhood);
}

function priceAmount(draft: EventFormDraft): number | null {
  if (draft.price_type !== "paid") return null;
  const parsed = Number.parseFloat(draft.price_amount);
  return Number.isFinite(parsed) ? parsed : null;
}

export function draftToSubmission(draft: EventFormDraft, actor: Actor): SubmissionCreate {
  return {
    submitter_id: actor?.id ?? null,
    submitter_email: actor?.email ?? (draft.submitter_email || null),
    submitter_name: actor?.name ?? (draft.submitter_name || null),
    title: draft.title,
    description: draft.description || null,
    ...eventTypePayload(draft),
    city: draft.city,
    sublocation: draftSubLocation(draft),
    neighborhood: draftNeighborhood(draft),
    event_date: draftInstant(draft),
    event_time: draft.event_time || null,
    location: draft.location || null,
    address: draft.address || null,
    price_type: draft.price_type || null,
    price_amount: priceAmount(draft),
    rsvp_link: draft.rsvp_link || null,
    recurrence: draft.recurrence || null,
    dance_styles: draft.dance_styles,
    ...(draft.entity_review ? { entity_review: draft.entity_review } : {}),
  };
}

export function draftToUserPayload(draft: EventFormDraft): UserEventUpdatePayload {
  return {
    title: draft.title,
    description: draft.description || null,
    ...eventTypePayload(draft),
    city: draft.city,
    sublocation: draftSubLocation(draft),
    neighborhood: draftNeighborhood(draft),
    event_date: draftInstant(draft),
    event_time: draft.event_time || null,
    location: draft.location || null,
    address: draft.address || null,
    price_type: draft.price_type || null,
    price_amount: priceAmount(draft),
    rsvp_link: draft.rsvp_link || null,
    recurrence: draft.recurrence || null,
    dance_styles: draft.dance_styles,
    ...flyerPayload(draftFlyerUrls(draft)),
  };
}

export function draftToAdminPayload(draft: EventFormDraft): AdminEventPayload {
  return {
    title: draft.title,
    description: draft.description || null,
    ...eventTypePayload(draft),
    city: draft.city,
    sublocation: draftSubLocation(draft),
    neighborhood: draftNeighborhood(draft),
    event_date: draftInstant(draft),
    event_time: draft.event_time || null,
    location: draft.location || null,
    address: draft.address || null,
    price_type: draft.price_type || null,
    price_amount: priceAmount(draft),
    rsvp_link: draft.rsvp_link || null,
    recurrence: draft.recurrence || null,
    host: draft.host || null,
    ...flyerPayload(draftFlyerUrls(draft)),
    contact_email: draft.contact_email || null,
    contact_instagram: draft.contact_instagram || null,
    contact_website: draft.contact_website || null,
    taxonomy_term_ids: draft.taxonomy_term_ids,
    venue_id: draft.venue_id || null,
    ...(draft.series_id !== undefined ? { series_id: draft.series_id || null } : {}),
    ...(draft.entity_review ? { entity_review: draft.entity_review } : {}),
  };
}
export type OrganizerCreateDraftPayload = Omit<AdminEventPayload, "taxonomy_term_ids"> & {
  dance_styles: string[];
};

/** Maps the host form to the canonical organizer RPC payload. */
export function draftToOrganizerCreatePayload(draft: EventFormDraft): OrganizerCreateDraftPayload {
  const { taxonomy_term_ids: _taxonomyTermIds, ...payload } = draftToAdminPayload(draft);
  return { ...payload, dance_styles: draft.dance_styles };
}

/**
 * Maps the host edit form to the organizer update RPC payload.
 * Only includes fields the RPC whitelist permits — status, organizer_id,
 * submitter_id, source_type, venue_id, and created_at are excluded.
 */
export function draftToOrganizerUpdatePayload(draft: EventFormDraft): OrganizerUpdateDraftPayload {
  return {
    title: draft.title,
    description: draft.description || null,
    ...eventTypePayload(draft),
    city: draft.city,
    sublocation: draftSubLocation(draft),
    neighborhood: draftNeighborhood(draft),
    event_date: draftInstant(draft),
    event_time: draft.event_time || null,
    location: draft.location || null,
    address: draft.address || null,
    price_type: draft.price_type || null,
    price_amount: priceAmount(draft),
    rsvp_link: draft.rsvp_link || null,
    recurrence: draft.recurrence || null,
    host: draft.host || null,
    ...flyerPayload(draftFlyerUrls(draft)),
    contact_email: draft.contact_email || null,
    contact_instagram: draft.contact_instagram || null,
    contact_website: draft.contact_website || null,
    dance_styles: draft.dance_styles,
  };
}

export type OrganizerUpdateDraftPayload = {
  title: string;
  description: string | null;
  event_type: string;
  event_types: EventType[];
  city: string;
  event_date: string;
  sublocation: SubLocation | null;
  neighborhood: string | null;
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: "free" | "paid" | null;
  price_amount: number | null;
  rsvp_link: string | null;
  recurrence: "weekly" | null;
  host: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  contact_email: string | null;
  contact_instagram: string | null;
  contact_website: string | null;
  dance_styles: string[];
};
