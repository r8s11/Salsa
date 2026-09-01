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
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  instagram: string | null;
  organizerType: string | null;
  primaryCity: string | null;
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
  organizers: {
    id: string;
    name: string;
    slug: string | null;
    status: string;
    description: string | null;
    logo_url: string | null;
    website: string | null;
    instagram: string | null;
    organizer_type: string | null;
    primary_city: string | null;
  } | null;
}

const MEMBER_SELECT =
  "member_role, status, organizers(id, name, slug, status, description, logo_url, website, instagram, organizer_type, primary_city)";

function projectMembership(row: OrganizerMemberRow): OrganizerMembership | null {
  if (!row.organizers) return null;
  return {
    organizerId: row.organizers.id,
    organizerName: row.organizers.name,
    organizerSlug: row.organizers.slug,
    organizerStatus: row.organizers.status,
    memberRole: row.member_role,
    description: row.organizers.description,
    logoUrl: row.organizers.logo_url,
    website: row.organizers.website,
    instagram: row.organizers.instagram,
    organizerType: row.organizers.organizer_type,
    primaryCity: row.organizers.primary_city,
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

/**
 * Fields an organizer owner/manager may edit through
 * public.organizer_update_profile(). Mirrors the RPC whitelist exactly.
 */
export type OrganizerProfileUpdatePayload = {
  name?: string;
  description?: string | null;
  logo_url?: string | null;
  website?: string | null;
  instagram?: string | null;
  organizer_type?: string | null;
  primary_city?: string | null;
};

/**
 * Fetches the full organizer record. The caller must have an active
 * membership; RLS on organizers enforces this at the database level.
 */
export async function fetchOrganizerProfile(organizerId: string): Promise<OrganizerMembership> {
  const { data, error } = await supabase
    .from("organizers")
    .select("id, name, slug, status, description, logo_url, website, instagram, organizer_type, primary_city")
    .eq("id", organizerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organizer not found.");

  const org = data as {
    id: string; name: string; slug: string | null; status: string;
    description: string | null; logo_url: string | null; website: string | null;
    instagram: string | null; organizer_type: string | null; primary_city: string | null;
  };

  return {
    organizerId: org.id,
    organizerName: org.name,
    organizerSlug: org.slug,
    organizerStatus: org.status,
    memberRole: "owner", // placeholder — caller already knows their role from membership
    description: org.description,
    logoUrl: org.logo_url,
    website: org.website,
    instagram: org.instagram,
    organizerType: org.organizer_type,
    primaryCity: org.primary_city,
  };
}

/**
 * Updates an organizer's profile through the secure RPC boundary.
 * Authorization is enforced inside the SECURITY DEFINER RPC.
 */
export async function updateOrganizerProfile(
  organizerId: string,
  payload: OrganizerProfileUpdatePayload
): Promise<void> {
  const { error } = await supabase.rpc("organizer_update_profile", {
    p_organizer_id: organizerId,
    p_payload: payload,
  });
  if (error) throw repositoryError(error);
}
