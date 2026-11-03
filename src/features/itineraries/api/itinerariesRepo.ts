import { supabase } from "../../../lib/supabase";
import type {
  IsoWeekday,
  Itinerary,
  ItineraryDraft,
  ItineraryItem,
  ItineraryItemRole,
  ItineraryStatus,
} from "../model/types";

const COVER_BUCKET = "itinerary-covers";

export interface AdminItineraryRow extends Itinerary {
  eventCount: number;
}

/** A Supabase/Postgres failure that keeps its SQLSTATE for itineraryErrorMessage. */
export class ItineraryError extends Error {
  readonly code: string | undefined;
  constructor(error: { message: string; code?: string }) {
    super(error.message);
    this.name = "ItineraryError";
    this.code = error.code;
  }
}

function fail(error: { message: string; code?: string }): never {
  throw new ItineraryError(error);
}

interface ItineraryRow {
  id: string;
  city: string;
  week_start: string;
  time_zone: string;
  title: string;
  description: string | null;
  recommendations: string | null;
  unfeatured_days: number[] | null;
  /** Absent on public_itineraries, which only exposes published rows. */
  status?: ItineraryStatus;
  cover_image_url: string | null;
  /** Absent on public_itineraries. */
  cover_generated_at?: string | null;
  published_at: string | null;
  updated_at: string;
}

interface ItemRow {
  event_id: string;
  role: ItineraryItemRole;
  position: number;
  note: string | null;
}

function toItinerary(row: ItineraryRow): Itinerary {
  return {
    id: row.id,
    city: row.city,
    weekStart: row.week_start,
    timeZone: row.time_zone,
    title: row.title,
    description: row.description,
    recommendations: row.recommendations,
    unfeaturedDays: (row.unfeatured_days ?? []) as IsoWeekday[],
    status: row.status ?? "published",
    coverImageUrl: row.cover_image_url,
    coverGeneratedAt: row.cover_generated_at ?? null,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

function toItems(rows: ItemRow[] | null): ItineraryItem[] {
  return (rows ?? [])
    .map((row) => ({ eventId: row.event_id, role: row.role, position: row.position, note: row.note }))
    .sort((a, b) => a.position - b.position);
}

export async function fetchItineraries(): Promise<AdminItineraryRow[]> {
  const { data, error } = await supabase
    .from("itineraries")
    .select("*, itinerary_items(count)")
    .order("week_start", { ascending: false });
  if (error) fail(error);
  return ((data ?? []) as (ItineraryRow & { itinerary_items: { count: number }[] })[]).map((row) => ({
    ...toItinerary(row),
    eventCount: row.itinerary_items[0]?.count ?? 0,
  }));
}

export async function fetchItineraryDraft(
  id: string
): Promise<{ itinerary: Itinerary; draft: ItineraryDraft }> {
  const { data, error } = await supabase
    .from("itineraries")
    .select("*, itinerary_items(event_id, role, position, note)")
    .eq("id", id)
    .single();
  if (error) fail(error);
  const row = data as ItineraryRow & { itinerary_items: ItemRow[] | null };
  const itinerary = toItinerary(row);
  return {
    itinerary,
    draft: {
      id: itinerary.id,
      city: itinerary.city,
      weekStart: itinerary.weekStart,
      timeZone: itinerary.timeZone,
      title: itinerary.title,
      description: itinerary.description,
      recommendations: itinerary.recommendations,
      unfeaturedDays: itinerary.unfeaturedDays,
      items: toItems(row.itinerary_items),
    },
  };
}

export async function fetchPublishedItinerary(
  city: string,
  weekStart: string
): Promise<{ itinerary: Itinerary; items: ItineraryItem[] } | null> {
  const { data, error } = await supabase
    .from("public_itineraries")
    .select("*")
    .eq("city", city)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) fail(error);
  if (!data) return null;
  const itinerary = toItinerary(data as ItineraryRow);
  const items = await supabase
    .from("public_itinerary_items")
    .select("event_id, role, position, note")
    .eq("itinerary_id", itinerary.id)
    .order("position", { ascending: true });
  if (items.error) fail(items.error);
  return { itinerary, items: toItems(items.data as ItemRow[] | null) };
}

export async function fetchPublishedNeighbours(
  city: string,
  weekStart: string
): Promise<{ previous: string | null; next: string | null }> {
  const [previous, next] = await Promise.all([
    supabase
      .from("public_itineraries")
      .select("week_start")
      .eq("city", city)
      .lt("week_start", weekStart)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("public_itineraries")
      .select("week_start")
      .eq("city", city)
      .gt("week_start", weekStart)
      .order("week_start", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (previous.error) fail(previous.error);
  if (next.error) fail(next.error);
  return {
    previous: (previous.data as { week_start: string } | null)?.week_start ?? null,
    next: (next.data as { week_start: string } | null)?.week_start ?? null,
  };
}

/** Id of the non-archived itinerary for this metro-week, if any. */
export async function findLiveItinerary(city: string, weekStart: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("itineraries")
    .select("id")
    .eq("city", city)
    .eq("week_start", weekStart)
    .neq("status", "archived")
    .maybeSingle();
  if (error) fail(error);
  return (data as { id: string } | null)?.id ?? null;
}

export async function saveItinerary(draft: ItineraryDraft): Promise<string> {
  const { data, error } = await supabase.rpc("save_itinerary", {
    p_id: draft.id,
    p_payload: {
      city: draft.city,
      week_start: draft.weekStart,
      time_zone: draft.timeZone,
      title: draft.title,
      description: draft.description,
      recommendations: draft.recommendations,
      unfeatured_days: draft.unfeaturedDays,
      items: draft.items.map((item) => ({
        event_id: item.eventId,
        role: item.role,
        position: item.position,
        note: item.note,
      })),
    },
  });
  if (error) fail(error);
  return data as string;
}

/** Resolves to the stored published_at. */
export async function setItineraryStatus(id: string, status: ItineraryStatus): Promise<string | null> {
  const { data, error } = await supabase.rpc("set_itinerary_status", { p_id: id, p_status: status });
  if (error) fail(error);
  return (data as string | null) ?? null;
}

/** Uploads the link card to `<id>/<sha8>.jpg` and returns its public URL. */
export async function uploadItineraryCover(id: string, jpeg: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(await jpeg.arrayBuffer()));
  const sha8 = Array.from(new Uint8Array(digest).slice(0, 4), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  const path = `${id}/${sha8}.jpg`;
  const bucket = supabase.storage.from(COVER_BUCKET);
  const { error } = await bucket.upload(path, jpeg, { upsert: true, contentType: "image/jpeg" });
  if (error) fail(error as { message: string; code?: string });
  return bucket.getPublicUrl(path).data.publicUrl;
}

/** Resolves to the stored cover_generated_at. */
export async function setItineraryCover(id: string, url: string): Promise<string> {
  const { data, error } = await supabase.rpc("set_itinerary_cover", { p_id: id, p_url: url });
  if (error) fail(error);
  return data as string;
}

export function itineraryErrorMessage(error: unknown): string {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  if (code === "23505") return "An itinerary for this city and week already exists.";
  if (code === "42501") return "You need moderator access to change itineraries.";
  return typeof message === "string" && message ? message : String(error);
}
