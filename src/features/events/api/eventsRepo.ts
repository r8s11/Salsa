import { supabase } from "../../../lib/supabase";
import { DatabaseEvent, City, EventType } from "../../../types/events";
import { toEventDateInstant, formatTimeLabel } from "../model/eventDateTime";
import { timeZoneForDisplay } from "../../../shared/utils/timezone";
import { shortCodeIdRange } from "../model/shortLink";
import { replaceEventTaxonomyTerms } from "../../admin/api/taxonomyRepo";
import type { EntityReview } from "../../entity-matching/entityReview";
import { flyerPayload } from "../model/eventFlyers";
import { normalizeSubLocation, type SubLocation } from "../../metros/model/sublocation";
import { normalizeNeighborhood } from "../../metros/model/neighborhood";

export interface AdminEventPayload {
  title: string;
  description: string | null;
  /** Primary category (first selection); drives calendar color. */
  event_type: EventType;
  /** Full ordered selection; `event_type` is its first member. */
  event_types?: EventType[];
  city: City;
  /** Optional NYC borough; null clears it (All NYC). Omitted leaves the stored value alone. */
  sublocation?: SubLocation | null;
  /** Optional curated area; null clears it and omission preserves it unless its parent changes. */
  neighborhood?: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: "free" | "paid" | null;
  price_amount: number | null;
  rsvp_link: string | null;
  host: string | null;
  image_url: string | null;
  image_urls?: string[] | null;
  recurrence: "weekly" | null;
  contact_email: string | null;
  contact_instagram: string | null;
  contact_website: string | null;
  taxonomy_term_ids: string[];
  venue_id: string | null;
  series_id?: string | null;
  /** Optional — the manual admin form doesn't manage this field; CSV import does. */
  gallery?: string[] | null;
  entity_review?: EntityReview;
  organizer_id?: string | null;
}

type EventWithTaxonomy = Omit<DatabaseEvent, "taxonomy_term_ids" | "taxonomy_terms"> & {
  event_taxonomy_terms?: {
    taxonomy_term_id: string;
    taxonomy_terms: DatabaseEvent["taxonomy_terms"][number] | null;
  }[];
};

export function projectEventTaxonomy(rows: EventWithTaxonomy[] | null): DatabaseEvent[] {
  return (rows ?? []).map(({ event_taxonomy_terms, ...event }) => ({
    ...event,
    taxonomy_term_ids: event_taxonomy_terms?.map(({ taxonomy_term_id }) => taxonomy_term_id) ?? [],
    taxonomy_terms:
      event_taxonomy_terms?.flatMap(({ taxonomy_terms }) =>
        taxonomy_terms ? [taxonomy_terms] : []
      ) ?? [],
  }));
}

export async function fetchApprovedEvents(
  city: City,
  subLocation: SubLocation | null = null,
  neighborhood: string | null = null
): Promise<DatabaseEvent[]> {
  if (subLocation !== null && normalizeSubLocation(city, subLocation) !== subLocation) {
    throw new Error("Borough does not belong to the selected city.");
  }
  if (
    neighborhood !== null &&
    normalizeNeighborhood(city, subLocation, neighborhood) !== neighborhood
  ) {
    throw new Error("Neighborhood does not belong to the selected city and borough.");
  }
  const today = new Date();
  today.setDate(today.getDate() - 1);
  const floorDate = today.toISOString();
  let query = supabase
    .from("public_events")
    .select("*")
    .eq("status", "approved")
    .eq("city", city);
  // NULL means all neighborhoods within the selected city/borough.
  if (subLocation) query = query.eq("sublocation", subLocation);
  if (neighborhood) query = query.eq("neighborhood", neighborhood);
  const { data, error } = await query
    .gte("event_date", floorDate)
    .order("event_date", { ascending: true });
  if (error) throw new Error(error.message);
  return projectEventTaxonomy(data as EventWithTaxonomy[] | null);
}

export async function fetchApprovedEventById(id: string): Promise<DatabaseEvent | null> {
  const column = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  )
    ? "id"
    : "slug";
  const { data, error } = await supabase
    .from("public_events")
    .select("*")
    .eq(column, id)
    .eq("status", "approved")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return projectEventTaxonomy(data ? [data as EventWithTaxonomy] : null)[0] ?? null;
}

export interface ShortLinkMatch {
  id: string;
  title: string;
}

/**
 * Approved public events whose UUID starts with the short-link code.
 * Returns at most two so callers can tell a unique match from an ambiguous
 * one without fetching every collision; titles let an ambiguous page name
 * each night.
 */
export async function fetchShortLinkMatches(code: string): Promise<ShortLinkMatch[]> {
  const { from, to } = shortCodeIdRange(code);
  const { data, error } = await supabase
    .from("public_events")
    .select("id, title")
    .eq("status", "approved")
    .gte("id", from)
    .lte("id", to)
    .limit(2);

  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row: unknown) =>
    row && typeof row === "object" && "id" in row && "title" in row
      ? [{ id: String(row.id), title: String(row.title) }]
      : []
  );
}

export async function fetchMyApprovedEvents(userId: string): Promise<DatabaseEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(
      "*, event_taxonomy_terms(taxonomy_term_id, taxonomy_terms(id, name, slug, category, status))"
    )
    .eq("submitter_id", userId)
    .eq("status", "approved")
    .order("event_date", { ascending: true });
  if (error) throw new Error(error.message);
  return projectEventTaxonomy(data as EventWithTaxonomy[] | null);
}

export async function fetchMySubmissions(userId: string): Promise<DatabaseEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(
      "*, event_taxonomy_terms(taxonomy_term_id, taxonomy_terms(id, name, slug, category, status))"
    )
    .eq("submitter_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return projectEventTaxonomy(data as EventWithTaxonomy[] | null);
}

export async function fetchAllEvents(): Promise<DatabaseEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(
      "*, event_taxonomy_terms(taxonomy_term_id, taxonomy_terms(id, name, slug, category, status))"
    )
    .order("event_date", { ascending: false });
  if (error) throw new Error(error.message);
  return projectEventTaxonomy(data as EventWithTaxonomy[] | null);
}

export async function setEventStatus(
  id: string,
  status: DatabaseEvent["status"],
  extra?: { cancellation_reason?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from("events")
    .update({ status, ...extra })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateEvent(id: string, payload: AdminEventPayload): Promise<void> {
  const { error } = await supabase.rpc("save_event_with_entities", {
    p_event_id: id,
    p_payload: payload,
    p_publish: null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Narrow update: set or clear the flyer image for a single event.
 * Touches ONLY `image_url` — no taxonomy, no other fields.
 * Verifies the row was actually updated to guard against zero-row updates
 * (e.g. RLS policy denying the write).
 */
export async function updateEventFlyer(eventId: string, imageUrl: string | null): Promise<void> {
  const { data, error } = await supabase
    .from("events")
    .update({ image_url: imageUrl })
    .eq("id", eventId)
    .select("id, image_url")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Event not found or update denied by policy.");
}

/**
 * Replace the full ordered flyer list for one event. `image_url` is derived
 * from `image_urls[0]` by the database trigger. An empty list clears all flyers.
 */
export async function updateEventFlyers(eventId: string, imageUrls: readonly string[]): Promise<void> {
  const { image_urls } = flyerPayload(imageUrls);
  const { data, error } = await supabase
    .from("events")
    .update({ image_urls })
    .eq("id", eventId)
    .select("id, image_url, image_urls")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Event not found or update denied by policy.");
}

// Fields a submitter may edit on their own pending/rejected event.
// Everything excluded here (status, source_type, submitter_*, host,
// contact_*, venue_id, gallery) is admin/moderator-only or immutable after
// submission. The RLS UPDATE policy on events enforces the ownership + status
// guard at the database layer; this type documents and enforces the boundary
// at the TypeScript layer too.
export type UserEventUpdatePayload = {
  title: string;
  description?: string | null;
  event_type: EventType;
  /** Full ordered selection; `event_type` is its first member. */
  event_types: EventType[];
  city: City;
  sublocation?: SubLocation | null;
  neighborhood?: string | null;
  event_date: string;
  event_time?: string | null;
  location?: string | null;
  address?: string | null;
  price_type?: "free" | "paid" | null;
  price_amount?: number | null;
  rsvp_link?: string | null;
  recurrence?: "weekly" | null;
  dance_styles?: string[];
  image_url?: string | null;
  image_urls?: string[] | null;
};

/**
 * Allows the original submitter to edit their own event while it is still
 * pending or has been rejected (not yet approved/published). The RLS UPDATE
 * policy on `events` enforces `submitter_id = auth.uid()` AND
 * `status IN ('pending', 'rejected')` — the database is the source of truth
 * for the ownership guard, not just the frontend check.
 */
export async function updateEventForUser(
  id: string,
  payload: UserEventUpdatePayload
): Promise<void> {
  const updatePayload: UserEventUpdatePayload = {
    title: payload.title,
    description: payload.description ?? null,
    event_type: payload.event_type,
    event_types: payload.event_types,
    city: payload.city,
    // Always written alongside city: a city change must clear a stale borough.
    ...(payload.sublocation !== undefined ? { sublocation: payload.sublocation } : {}),
    ...(payload.neighborhood !== undefined ? { neighborhood: payload.neighborhood } : {}),
    event_date: payload.event_date,
    event_time: payload.event_time ?? null,
    location: payload.location ?? null,
    address: payload.address ?? null,
    price_type: payload.price_type ?? null,
    price_amount: payload.price_amount ?? null,
    rsvp_link: payload.rsvp_link ?? null,
    recurrence: payload.recurrence ?? null,
    dance_styles: payload.dance_styles ?? [],
  };
  if (payload.image_url !== undefined) {
    updatePayload.image_url = payload.image_url;
  }
  if (payload.image_urls !== undefined) {
    updatePayload.image_urls = payload.image_urls;
  }

  const { error } = await supabase.from("events").update(updatePayload).eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Allows the original submitter to withdraw (hard-delete) their own event
 * while it is still pending. The RLS DELETE policy enforces
 * `submitter_id = auth.uid() AND status = 'pending'` at the database layer.
 */
export async function deleteEventForUser(id: string): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) throw new Error(error.message);
}

export async function createEventAsAdmin(
  payload: AdminEventPayload,
  submitter: { id: string; email: string | null },
  publish = true
): Promise<void> {
  const { error } = await supabase.rpc("save_event_with_entities", {
    p_event_id: null,
    p_payload: {
      ...payload,
      submitter_id: submitter.id,
      submitter_email: submitter.email,
    },
    p_publish: publish,
  });
  if (error) throw new Error(error.message);
}

export async function duplicateEvent(
  source: DatabaseEvent,
  input: { date: string; time: string; publish: boolean },
  actor: { id: string; email: string | null },
  onTaxonomyFailure?: (message: string) => void
): Promise<void> {
  const {
    id: _id,
    created_at: _createdAt,
    updated_at: _updatedAt,
    submitter_id: _submitterId,
    submitter_email: _submitterEmail,
    submitter_name: _submitterName,
    status: _status,
    source_type: _sourceType,
    cancellation_reason: _cancellationReason,
    event_date: _eventDate,
    event_time: _eventTime,
    taxonomy_term_ids: taxonomyTermIds = [],
    taxonomy_terms: _taxonomyTerms,
    // In-memory zone hints are not columns; the copy re-derives its zone the same way.
    time_zone: _timeZone,
    series_time_zone: _seriesTimeZone,
    venue_time_zone: _venueTimeZone,
    ...carried
  } = source;
  // Same chain the dialog used to read the original, so the copy keeps its local hour.
  const copyZone = timeZoneForDisplay({
    event: source.time_zone,
    series: source.series_time_zone,
    venue: source.venue_time_zone,
    metro: source.city,
  });

  const { data, error } = await supabase
    .from("events")
    .insert({
      ...carried,
      event_date: toEventDateInstant(input.date, input.time, copyZone),
      event_time: formatTimeLabel(input.time),
      status: input.publish ? "approved" : "draft",
      source_type: "admin",
      cancellation_reason: null,
      submitter_id: actor.id,
      submitter_email: actor.email,
      submitter_name: "Salsa Segura",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  try {
    await replaceEventTaxonomyTerms(data.id, taxonomyTermIds);
  } catch (taxonomyError) {
    if (!onTaxonomyFailure) throw taxonomyError;
    onTaxonomyFailure("Event saved, but tags could not be linked. Check them in the event editor.");
  }
}

export type EventTouchKind = "view" | "rsvp_click" | "ticket_click" | "share";

/**
 * Umami event names. The metro is part of the name (`event-view:boston`)
 * because Umami's event-listing API filters by name but does not return event
 * properties; `scripts/repeat-dancers.mjs` depends on this shape.
 */
const UMAMI_EVENT_NAMES: Record<EventTouchKind, string> = {
  view: "event-view",
  rsvp_click: "rsvp-click",
  ticket_click: "ticket-click",
  share: "event-share",
};

type UmamiWindow = Window & { umami?: { track: (name: string, data?: Record<string, string>) => Promise<unknown> | void } };

/**
 * Sends only event id + allowlisted interaction kind to the first-party
 * counter, and the kind + event metro to cookieless Umami. Detail views are
 * session-deduped per event/day; explicit outbound/share actions count each
 * activation. Telemetry failures are swallowed and never gate navigation.
 */
export async function recordEventTouch(eventId: string, kind: EventTouchKind, metro?: string | null): Promise<void> {
  try {
    const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (privacy.doNotTrack === "1" || privacy.globalPrivacyControl === true) return;
    if (kind === "view") {
      const day = new Date().toISOString().slice(0, 10);
      const key = `salsasegura-touch:${kind}:${eventId}:${day}`;
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, day);
    }
    const metroTag = metro?.trim() || "none";
    try {
      void Promise.resolve((window as UmamiWindow).umami?.track(`${UMAMI_EVENT_NAMES[kind]}:${metroTag}`, { metro: metroTag })).catch(() => undefined);
    } catch {
      // A blocked analytics vendor must not suppress the first-party counter.
    }
    await supabase.rpc("record_event_touch", { p_event_id: eventId, p_kind: kind });
  } catch {
    // Fire-and-forget: failures are invisible by design.
  }
}
