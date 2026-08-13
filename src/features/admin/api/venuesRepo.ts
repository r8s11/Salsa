import { supabase } from "../../../lib/supabase";
import type {
  VenueRow,
  VenueDetailRow,
  VenueForm,
  VenueStatus,
} from "../model/venuesQuery";
import type { AuditLogRow } from "../model/auditLog";

/**
 * Central admin venue repository.
 * This is the sole module that calls supabase.from('venues') —
 * no component or hook queries Supabase directly.
 *
 * All queries call the admin_* RPCs that enrich venue rows with
 * computed columns (upcoming_count, quality_issues) — same pattern
 * as admin_organizer_requests() / admin_user_directory().
 */

interface DirectoryParams {
  search?: string;
  status?: VenueStatus[];
  city?: string[];
  state?: string[];
  has_upcoming?: boolean;
  sort?: string;
  limit?: number;
  offset?: number;
}

/** Admin venue directory with upcoming counts and quality flags. */
export async function fetchVenueDirectory(params: DirectoryParams): Promise<VenueRow[]> {
  const { data, error } = await supabase.rpc("admin_venue_directory", {
    p_search: params.search ?? "",
    p_status: params.status ?? null,
    p_city: params.city ?? null,
    p_state: params.state ?? null,
    p_has_upcoming: params.has_upcoming ?? null,
    p_sort: params.sort ?? "name-asc",
    p_limit: params.limit ?? 25,
    p_offset: params.offset ?? 0,
  });
  if (error) throw new Error(`Failed to load venues: ${error.message}`);
  return (data ?? []) as VenueRow[];
}

/** Single venue detail (with quality issues + stats). */
export async function fetchVenueDetail(id: string): Promise<VenueDetailRow> {
  const { data, error } = await supabase.rpc("admin_venue_detail", {
    p_id: id,
  });
  if (error) throw new Error(`Failed to load venue: ${error.message}`);
  if (!data || data.length === 0) throw new Error("Venue not found");
  return data[0] as VenueDetailRow;
}

export async function createVenue(form: VenueForm): Promise<VenueDetailRow> {
  const payload = {
    name: form.name.trim(),
    address_line1: form.address_line1.trim() || null,
    address_line2: form.address_line2.trim() || null,
    city: form.city.trim() || null,
    state_region: form.state_region.trim() || null,
    postal_code: form.postal_code.trim() || null,
    country: form.country || null,
    website: form.website.trim() || null,
    instagram: form.instagram.trim() || null,
    phone: form.phone.trim() || null,
    timezone: form.timezone.trim() || null,
  };
  const { data, error } = await supabase
    .from("venues")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Failed to create venue: ${error.message}`);
  // Re-fetch as detail to get quality_issues + upcoming_count
  return fetchVenueDetail(data.id);
}

export async function updateVenue(id: string, form: VenueForm): Promise<VenueDetailRow> {
  const payload = {
    name: form.name.trim(),
    address_line1: form.address_line1.trim() || null,
    address_line2: form.address_line2.trim() || null,
    city: form.city.trim() || null,
    state_region: form.state_region.trim() || null,
    postal_code: form.postal_code.trim() || null,
    country: form.country || null,
    website: form.website.trim() || null,
    instagram: form.instagram.trim() || null,
    phone: form.phone.trim() || null,
    timezone: form.timezone.trim() || null,
  };
  const { error } = await supabase
    .from("venues")
    .update(payload)
    .eq("id", id);
  if (error) throw new Error(`Failed to update venue: ${error.message}`);
  return fetchVenueDetail(id);
}

/** Archive a venue — marks status=archived, does not delete. */
export async function archiveVenue(id: string): Promise<void> {
  const { error } = await supabase
    .from("venues")
    .update({ status: "archived" as VenueStatus })
    .eq("id", id);
  if (error) throw new Error(`Failed to archive venue: ${error.message}`);
}

/** Restore an archived venue to its prior status — defaults to active. */
export async function restoreVenue(id: string, targetStatus: VenueStatus = "active"): Promise<void> {
  const { error } = await supabase
    .from("venues")
    .update({ status: targetStatus })
    .eq("id", id);
  if (error) throw new Error(`Failed to restore venue: ${error.message}`);
}

/**
 * Merge one venue into another. The RPC handles:
 * - reassigning events.venue_id
 * - copying blank fields from the merge record
 * - archiving the merge record
 * - writing audit_logs row: venue.merged
 */
export async function mergeVenues(keepId: string, mergeId: string): Promise<void> {
  const { error } = await supabase.rpc("merge_venues", {
    p_keep_id: keepId,
    p_merge_id: mergeId,
  });
  if (error) throw new Error(`Failed to merge venues: ${error.message}`);
}

/**
 * Delete a venue. The server checks that no events reference it —
 * if they do, the RPC throws with a message the UI can surface.
 * No cascade deletion.
 */
export async function deleteVenue(id: string): Promise<void> {
  const { error } = await supabase
    .from("venues")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`Failed to delete venue: ${error.message}`);
}

/** Count events referencing a venue — used by the delete safeguard. */
export async function countVenueEvents(venueId: string): Promise<number> {
  const { count, error } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("venue_id", venueId);
  if (error) throw new Error(`Failed to count venue events: ${error.message}`);
  return count ?? 0;
}

/** Search venues for the event-form combobox (fuzzy name match). */
export async function searchVenues(query: string, limit = 10): Promise<VenueRow[]> {
  if (!query.trim()) return [];
  const { data, error } = await supabase.rpc("admin_venue_search", {
    p_query: query.trim(),
    p_limit: limit,
  });
  if (error) throw new Error(`Failed to search venues: ${error.message}`);
  return (data ?? []) as VenueRow[];
}

/** Fetch audit log entries for a venue (ordered newest-first). */
export async function fetchVenueAuditLog(venueId: string, limit = 50): Promise<AuditLogRow[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity_type", "venue")
    .eq("entity_id", venueId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load venue audit log: ${error.message}`);
  return (data as AuditLogRow[]) ?? [];
}