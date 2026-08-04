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

export async function submitEvent(payload: NewEventSubmission): Promise<void> {
  const { error } = await supabase.from("events").insert({
    ...payload,
    status: "pending",
  });

  if (error) {
    throw new Error(error.message);
  }
}
