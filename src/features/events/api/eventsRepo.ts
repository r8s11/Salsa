import { supabase } from "../../../lib/supabase";
import { DatabaseEvent, City, EventType } from "../../../types/events";
import { toEventDateInstant, formatTimeLabel } from "../../../features/events/model/eventDateTime";


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
  dance_styles: string[] | null;
  venue_id: string | null;
}

type EventWithTaxonomy = DatabaseEvent & { event_taxonomy_terms?: { taxonomy_term_id: string }[] };

function projectEventTaxonomy(rows: EventWithTaxonomy[] | null): DatabaseEvent[] {
  return (rows ?? []).map(({ event_taxonomy_terms, ...event }) => ({
    ...event,
    taxonomy_term_ids: event_taxonomy_terms?.map(({ taxonomy_term_id }) => taxonomy_term_id) ?? [],
  }));
}

export async function fetchApprovedEvents(city: City): Promise<DatabaseEvent[]> {
  const today = new Date();
  today.setDate(today.getDate() - 1);
  const floorDate = today.toISOString();

  const { data, error } = await supabase
    .from("events")
    .select("*, event_taxonomy_terms(taxonomy_term_id)")
    .eq("status", "approved")
    .eq("city", city)
    .gte("event_date", floorDate)
    .order("event_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return projectEventTaxonomy(data as EventWithTaxonomy[] | null);
}

export async function fetchMyApprovedEvents(userId: string): Promise<DatabaseEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*, event_taxonomy_terms(taxonomy_term_id)")
    .eq("submitter_id", userId)
    .eq("status", "approved")
    .order("event_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return projectEventTaxonomy(data as EventWithTaxonomy[] | null);
}


export async function fetchMySubmissions(userId: string): Promise<DatabaseEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("submitter_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as DatabaseEvent[]) || [];
}


export async function fetchAllEvents(): Promise<DatabaseEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as DatabaseEvent[]) || [];
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
  const { error } = await supabase.from("events").update(payload).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createEventAsAdmin(
  payload: AdminEventPayload,
  submitter: { id: string; email: string | null }
): Promise<void> {
  const { error } = await supabase.from("events").insert({
    ...payload,
    status: "approved",
    source_type: "admin",
    submitter_id: submitter.id,
    submitter_email: submitter.email,
    submitter_name: "Salsa Segura",
  });

  if (error) {
    throw new Error(error.message);
  }
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
    ...carried
  } = source;

  const { error } = await supabase.from("events").insert({
    ...carried,
    event_date: toEventDateInstant(input.date, input.time),
    event_time: formatTimeLabel(input.time),
    status: input.publish ? "approved" : "draft",
    source_type: "admin",
    cancellation_reason: null,
    submitter_id: actor.id,
    submitter_email: actor.email,
    submitter_name: "Salsa Segura",
  });

  if (error) {
    throw new Error(error.message);
  }
}


// Allows the original submitter to update their own event, but only while it
// is still pending or has been rejected (not yet approved/published). Uses a
// Postgres RBAC filter so the database enforces ownership at the row level.

// Allows the original submitter to recall (soft-delete) their own event
// while it is still pending. Recalled events are hard-removed so the user
// can re-submit cleanly; this cannot be called on approved events.
