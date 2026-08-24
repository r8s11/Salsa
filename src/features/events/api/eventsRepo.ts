import { supabase } from "../../../lib/supabase";
import { DatabaseEvent, City, EventType } from "../../../types/events";
import { toEventDateInstant, formatTimeLabel } from "../../../features/events/model/eventDateTime";
import { replaceEventTaxonomyTerms } from "../../admin/api/taxonomyRepo";

export interface AdminEventPayload {
  title: string;
  description: string | null;
  event_type: EventType;
  city: City;
  event_date: string;
  event_time: string | null;
  location: string | null;
  address: string | null;
  price_type: "free" | "paid" | null;
  price_amount: number | null;
  rsvp_link: string | null;
  host: string | null;
  image_url: string | null;
  recurrence: "weekly" | null;
  contact_email: string | null;
  contact_instagram: string | null;
  contact_website: string | null;
  taxonomy_term_ids: string[];
  venue_id: string | null;
  /** Optional — the manual admin form doesn't manage this field; CSV import does. */
  gallery?: string[] | null;
}

type EventWithTaxonomy = Omit<DatabaseEvent, "taxonomy_term_ids" | "taxonomy_terms"> & {
  event_taxonomy_terms?: {
    taxonomy_term_id: string;
    taxonomy_terms: DatabaseEvent["taxonomy_terms"][number] | null;
  }[];
};

function projectEventTaxonomy(rows: EventWithTaxonomy[] | null): DatabaseEvent[] {
  return (rows ?? []).map(({ event_taxonomy_terms, ...event }) => ({
    ...event,
    taxonomy_term_ids: event_taxonomy_terms?.map(({ taxonomy_term_id }) => taxonomy_term_id) ?? [],
    taxonomy_terms:
      event_taxonomy_terms?.flatMap(({ taxonomy_terms }) =>
        taxonomy_terms ? [taxonomy_terms] : []
      ) ?? [],
  }));
}

export async function fetchApprovedEvents(city: City): Promise<DatabaseEvent[]> {
  const today = new Date();
  today.setDate(today.getDate() - 1);
  const floorDate = today.toISOString();
  const { data, error } = await supabase
    .from("events")
    .select(
      "*, event_taxonomy_terms(taxonomy_term_id, taxonomy_terms(id, name, slug, category, status))"
    )
    .eq("status", "approved")
    .eq("city", city)
    .gte("event_date", floorDate)
    .order("event_date", { ascending: true });
  if (error) throw new Error(error.message);
  return projectEventTaxonomy(data as EventWithTaxonomy[] | null);
}

export async function fetchApprovedEventById(id: string): Promise<DatabaseEvent | null> {
  const { data, error } = await supabase
    .from("events")
    .select(
      "*, event_taxonomy_terms(taxonomy_term_id, taxonomy_terms(id, name, slug, category, status))"
    )
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return projectEventTaxonomy(data ? [data as EventWithTaxonomy] : null)[0] ?? null;
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
  const { taxonomy_term_ids = [], ...eventPayload } = payload;
  const { error } = await supabase.from("events").update(eventPayload).eq("id", id);
  if (error) throw new Error(error.message);
  await replaceEventTaxonomyTerms(id, taxonomy_term_ids);
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
  city: City;
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
    city: payload.city,
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
  submitter: { id: string; email: string | null }
): Promise<void> {
  const { taxonomy_term_ids = [], ...eventPayload } = payload;
  const { data, error } = await supabase
    .from("events")
    .insert({
      ...eventPayload,
      status: "approved",
      source_type: "admin",
      submitter_id: submitter.id,
      submitter_email: submitter.email,
      submitter_name: "Salsa Segura",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await replaceEventTaxonomyTerms(data.id, taxonomy_term_ids);
}

export async function duplicateEvent(
  source: DatabaseEvent,
  input: { date: string; time: string; publish: boolean },
  actor: { id: string; email: string | null }
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
    ...carried
  } = source;

  const { data, error } = await supabase
    .from("events")
    .insert({
      ...carried,
      event_date: toEventDateInstant(input.date, input.time),
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
  await replaceEventTaxonomyTerms(data.id, taxonomyTermIds);
}
