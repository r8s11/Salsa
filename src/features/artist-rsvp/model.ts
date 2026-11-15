import type { DatabaseEvent } from "../events/model/types";
import type { EventFormDraft } from "../events/components/EventForm";
import { draftToOrganizerCreatePayload, draftToOrganizerUpdatePayload } from "../events/components/EventForm";
import { selectedEventTypes } from "../events/model/eventTypeSelection";
import { validateAdminEventForm } from "../admin/model/adminEventForm";

export const RSVP_ROLES = ["leader", "follower", "undecided"] as const;
export type RsvpRole = (typeof RSVP_ROLES)[number];
export const RSVP_ROLE_LABELS: Record<RsvpRole, string> = { leader: "Leader", follower: "Follower", undecided: "Undecided" };
export type ArtistRsvpSettings = { rsvp_enabled: boolean; rsvp_closed: boolean; rsvp_limit: number | null };
export type ArtistEvent = DatabaseEvent & ArtistRsvpSettings & { artist_id: string; rsvp_state_version?: number };
export type RsvpSummary = ArtistRsvpSettings & { event_id: string; artist_id: string; artist_name: string; artist_slug: string; main_list_count: number; available: boolean; waitlist: boolean };
export type RsvpRow = {
  id: string; event_id: string; name: string; email: string; role: RsvpRole;
  placement: "main_list" | "waitlist"; contacted: boolean; confirmed: boolean;
  version: number; contact_version: number; acceptance_version: number;
  created_at: string; updated_at: string;
  delivery: { kind: string; status: string; failure: string | null } | null;
};
export type RsvpChanges = Partial<Pick<RsvpRow, "name" | "email" | "role" | "contacted" | "confirmed">> & { promote?: true };
export type RoleTotals = Record<RsvpRole, number>;
export type RsvpRoster = { event: ArtistEvent; rows: RsvpRow[]; totals: { main_list: number; waitlist: number; confirmed: number; roles: RoleTotals; confirmed_roles: RoleTotals } };
export type GuestRsvpInput = { event_id: string; name: string; email: string; role: RsvpRole };
export type GuestRsvpReceipt = { status: "received"; event_id: string; external_url: string | null };

export function requiresArtistRsvp(draft: EventFormDraft): boolean {
  return selectedEventTypes(draft).includes("workshop");
}
export function validArtistUrl(value: string): boolean {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}
export function validateArtistEvent(draft: EventFormDraft, settings: ArtistRsvpSettings): string | null {
  const canonical = validateAdminEventForm(draft);
  if (canonical) return canonical;
  if (requiresArtistRsvp(draft) && !settings.rsvp_enabled) return "Workshops require website-managed RSVPs.";
  if (settings.rsvp_enabled && !draft.price_type) return "Choose Free or Paid for website-managed RSVPs.";
  if (settings.rsvp_enabled && draft.price_type === "paid" && !validArtistUrl(draft.rsvp_link)) return "Paid RSVPs require an HTTP(S) artist payment link without credentials.";
  if (settings.rsvp_limit !== null && (!Number.isSafeInteger(settings.rsvp_limit) || settings.rsvp_limit < 1)) return "Main-list limit must be a positive whole number.";
  return null;
}
export function artistEventPayload(draft: EventFormDraft, settings: ArtistRsvpSettings, editing = false) {
  const { recurrence: _recurrence, ...canonical } = editing ? draftToOrganizerUpdatePayload(draft) : draftToOrganizerCreatePayload({ ...draft, series_id: undefined });
  return { ...canonical, ...settings };
}
export function countRoles(rows: readonly RsvpRow[], confirmed = false): RoleTotals {
  const totals: RoleTotals = { leader: 0, follower: 0, undecided: 0 };
  for (const row of rows) if (!confirmed || row.confirmed) totals[row.role]++;
  return totals;
}
