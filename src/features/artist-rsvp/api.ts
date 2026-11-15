import { supabase } from "../../lib/supabase";
import { fetchApprovedEventById } from "../events/api/eventsRepo";
import type { EventResponsibilityAck } from "../events/model/eventResponsibility";
import type { ArtistEvent, GuestRsvpInput, GuestRsvpReceipt, RsvpChanges, RsvpRoster, RsvpRow, RsvpSummary } from "./model";

export class ArtistRsvpError extends Error {
  constructor(public code: string, message: string, public retryAfter?: number) { super(message); this.name = "ArtistRsvpError"; }
}
function failure(error: { code?: string }): ArtistRsvpError {
  const code = error.code ?? "unknown";
  const messages: Record<string, string> = {
    "42501": "Artist access denied. Only active owners and managers of this artist can open these records.",
    "40001": "Another manager changed this signup. Your edits remain here. Refresh and review before saving.",
    "55000": "This change is unavailable. Check main-list space, current signups and event status, then refresh.",
    "23505": "This email already has a signup for this event. Review the existing row.",
    "22023": "Check the event details, RSVP settings and responsibility acknowledgements before saving.",
    "23514": "Check the name, email, role and main-list limit before saving.",
  };
  return new ArtistRsvpError(code, messages[code] ?? "We couldn’t save or load these records. Please try again.");
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw failure(error);
  return data as T;
}
export const listArtistEvents = (artistId: string) => rpc<ArtistEvent[]>("artist_event_list", { p_artist_id: artistId });
export const getArtistEvent = (artistId: string, eventId: string) => rpc<ArtistEvent>("artist_event_get", { p_artist_id: artistId, p_event_id: eventId });
export const createArtistEvent = (artistId: string, payload: object, publish: boolean) => rpc<string>("artist_event_create", { p_artist_id: artistId, p_payload: payload, p_publish: publish });
export const updateArtistEvent = (eventId: string, payload: object) => rpc<void>("artist_event_update", { p_event_id: eventId, p_payload: payload });
export const publishArtistEvent = (eventId: string, ack: EventResponsibilityAck) => rpc<void>("artist_event_publish", { p_event_id: eventId, p_ack: ack });
export const listArtistRsvps = (eventId: string) => rpc<RsvpRoster>("artist_rsvp_list", { p_event_id: eventId });
export const updateArtistRsvp = (id: string, version: number, changes: RsvpChanges) => rpc<RsvpRow>("artist_rsvp_update", { p_rsvp_id: id, p_expected_version: version, p_changes: changes });
export const removeArtistRsvp = (id: string, version: number) => rpc<void>("artist_rsvp_remove", { p_rsvp_id: id, p_expected_version: version });
export async function getPublicArtistRsvp(id: string) {
  const event = await fetchApprovedEventById(id);
  if (!event?.artist_id || !event.rsvp_enabled) return null;
  const summary = await rpc<RsvpSummary | null>("artist_rsvp_summary", { p_event_id: event.id });
  return summary ? { event, summary } : null;
}
export async function submitGuestRsvp(input: GuestRsvpInput): Promise<GuestRsvpReceipt> {
  const { data, error } = await supabase.functions.invoke("artist-rsvp-submit", { body: input });
  if (error) {
    const response = error.context instanceof Response ? error.context : null;
    if (response?.status === 429) throw new ArtistRsvpError("rate_limited", "Too many requests. Your details are still here. Try again after the waiting period.", Number(response.headers.get("Retry-After")) || 600);
    if (response?.status === 409) throw new ArtistRsvpError("unavailable", "New signups are unavailable for this event.");
    throw new ArtistRsvpError("request_failed", "We couldn’t save your RSVP. Your details are still here. Please try again.");
  }
  if (data?.status !== "received") throw new ArtistRsvpError("request_failed", "We couldn’t save your RSVP. Please try again.");
  return { status: "received", event_id: data.event_id, external_url: data.external_url };
}
