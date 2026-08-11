import { supabase } from "../../../lib/supabase";
import { DatabaseEvent, City, EventType } from "../../../types/events";

export interface NewEventSubmission {
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
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_id: string;
  recurrence: "weekly" | null;
}

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
}

export async function fetchApprovedEvents(city: City): Promise<DatabaseEvent[]> {
  const today = new Date();
  today.setDate(today.getDate() - 1);
  const floorDate = today.toISOString();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "approved")
    .eq("city", city)
    .gte("event_date", floorDate)
    .order("event_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as DatabaseEvent[]) || [];
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

export async function submitEvent(payload: NewEventSubmission): Promise<void> {
  const { error } = await supabase.from("events").insert({
    ...payload,
    status: "pending",
    source_type: "user_submission",
  });

  if (error) {
    throw new Error(error.message);
  }
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

export async function setEventStatus(id: string, status: "approved" | "rejected"): Promise<void> {
  const { error } = await supabase.from("events").update({ status }).eq("id", id);

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
