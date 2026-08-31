import { supabase } from "../../../lib/supabase";
import type { DatabaseEvent } from "../../events/model/types";
import { projectEventTaxonomy } from "../../events/api/eventsRepo";

export type OrganizerMemberRole = "owner" | "manager" | "editor";

export interface OrganizerMembership {
  organizerId: string;
  organizerName: string;
  organizerSlug: string | null;
  organizerStatus: string;
  memberRole: OrganizerMemberRole;
}

/**
 * Thrown when the authenticated user lacks an active membership for the
 * organizer an operation targets. The database enforces the same boundary
 * via RLS; this keeps the application layer honest about it.
 */
export class OrganizerAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizerAccessError";
  }
}
function repositoryError(error: { message: string; code?: string }): Error {
  if (
    error.code === "42501" ||
    /active owner or manager|organizer.*access|not organizer-owned/i.test(error.message)
  ) {
    return new OrganizerAccessError(error.message);
  }
  return new Error(error.message);
}


interface OrganizerMemberRow {
  member_role: OrganizerMemberRole;
  status: string;
  organizers: { id: string; name: string; slug: string | null; status: string } | null;
}

const MEMBER_SELECT = "member_role, status, organizers(id, name, slug, status)";

function projectMembership(row: OrganizerMemberRow): OrganizerMembership | null {
  if (!row.organizers) return null;
  return {
    organizerId: row.organizers.id,
    organizerName: row.organizers.name,
    organizerSlug: row.organizers.slug,
    organizerStatus: row.organizers.status,
    memberRole: row.member_role,
  };
}

/**
 * Canonical "my organizers" query. The caller's identity comes from the
 * authenticated session — RLS on organizer_members restricts the rows to
 * auth.uid(), so no user id is ever accepted from (or sent by) the caller.
 */
export async function fetchMyOrganizers(): Promise<OrganizerMembership[]> {
  const { data, error } = await supabase
    .from("organizer_members")
    .select(MEMBER_SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data as unknown as OrganizerMemberRow[] | null) ?? [])
    .map(projectMembership)
    .filter((row): row is OrganizerMembership => row !== null);
}

/**
 * Verifies the authenticated user holds an active membership for the given
 * organizer. RLS guarantees only the caller's own rows are visible, so a
 * visible row is proof of membership; absence is a denial.
 */
export async function assertOrganizerAccess(organizerId: string): Promise<OrganizerMembership> {
  const { data, error } = await supabase
    .from("organizer_members")
    .select(MEMBER_SELECT)
    .eq("organizer_id", organizerId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw repositoryError(error);
  const membership = data ? projectMembership(data as unknown as OrganizerMemberRow) : null;
  if (!membership) {
    throw new OrganizerAccessError("You do not have access to this organizer.");
  }
  return membership;
}

/**
 * Canonical organizer event read. Membership is verified first so an
 * unauthorized organizer id produces an explicit denial instead of an
 * unexplained empty list; the events select RLS policy is the second,
 * database-side enforcement of the same rule.
 */
export async function fetchOrganizerEvents(organizerId: string): Promise<DatabaseEvent[]> {
  await assertOrganizerAccess(organizerId);

  const { data, error } = await supabase
    .from("events")
    .select("*, event_taxonomy_terms(taxonomy_term_id, taxonomy_terms(id, name, slug, category, status))")
    .eq("organizer_id", organizerId)
    .order("event_date", { ascending: false });
  if (error) throw new Error(error.message);
  return projectEventTaxonomy(data as Parameters<typeof projectEventTaxonomy>[0]);
}

/**
 * Fields an organizer owner/manager may edit through
 * public.organizer_update_event(). Mirrors the RPC whitelist exactly;
 * anything else (status, ownership, submitter identity, venue) is rejected
 * by the RPC with SQLSTATE 42501.
 */
export type OrganizerEventUpdatePayload = {
  title?: string;
  description?: string | null;
  event_type?: string;
  city?: string;
  event_date?: string;
  event_time?: string | null;
  location?: string | null;
  address?: string | null;
  price_type?: "free" | "paid" | null;
  price_amount?: number | null;
  rsvp_link?: string | null;
  recurrence?: "weekly" | null;
  contact_email?: string | null;
  contact_instagram?: string | null;
  contact_website?: string | null;
  image_url?: string | null;
  host?: string | null;
  dance_styles?: string[];
};

export type OrganizerEventCreatePayload = Omit<OrganizerEventUpdatePayload, "dance_styles"> & {
  dance_styles: string[];
  venue_id?: string | null;
};

export async function createOrganizerEvent(
  organizerId: string,
  payload: OrganizerEventCreatePayload,
  publish: boolean
): Promise<string> {
  const { data, error } = await supabase.rpc("organizer_create_event", {
    p_organizer_id: organizerId,
    p_payload: payload,
    p_publish: publish,
  });
  if (error) throw repositoryError(error);
  if (!data) throw new Error("The event was not created.");
  return data as string;
}

/**
 * Organizer-scoped event mutation seam. Authorization (authenticated
 * session, active account, active owner/manager membership on the event's
 * organizer) is enforced inside the SECURITY DEFINER RPC; the event's
 * organizer is read from the row, never from the caller.
 */
export async function updateOrganizerEvent(
  eventId: string,
  payload: OrganizerEventUpdatePayload
): Promise<void> {
  const { error } = await supabase.rpc("organizer_update_event", {
    p_event_id: eventId,
    p_payload: payload,
  });
  if (error) throw repositoryError(error);
}
