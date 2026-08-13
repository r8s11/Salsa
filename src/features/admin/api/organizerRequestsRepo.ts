import { supabase } from "../../../lib/supabase";
import type {
  OrganizerRequestRow,
  RequestStatus,
  RejectionReasonCode,
} from "../model/organizerRequestsQuery";

/**
 * Fetches the fully-enriched organizer-request directory (one row per request,
 * joined with the applicant profile + the existing organizer row when set).
 * Mirrors `fetchUserDirectory()` — a single admin-scoped RPC, no client-side
 * joins.
 */
export async function fetchOrganizerRequests(): Promise<OrganizerRequestRow[]> {
  const { data, error } = await supabase.rpc("admin_organizer_requests");
  if (error) throw new Error(error.message);
  return (data as OrganizerRequestRow[]) ?? [];
}

/**
 * Fetches a single request by id — used by the review page. Returns null
 * rather than throwing so the page can render its own "not found" empty state
 * (matching AdminEventsPage's `?edit=` unknown-id precedent).
 */
export async function fetchOrganizerRequest(id: string): Promise<OrganizerRequestRow | null> {
  const { data, error } = await supabase.rpc("admin_organizer_request_detail", { p_id: id });
  if (error) throw new Error(error.message);
  return (data?.[0] ?? null) as OrganizerRequestRow | null;
}

export async function approveOrganizerRequest(
  id: string,
  params: { reviewer_id: string; internal_note?: string | null }
): Promise<{ success: boolean }> {
  const { error } = await supabase.rpc("admin_approve_organizer_request", {
    p_request_id: id,
    p_reviewer_id: params.reviewer_id,
    p_internal_note: params.internal_note ?? null,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function rejectOrganizerRequest(
  id: string,
  params: {
    reviewer_id: string;
    reason_code: RejectionReasonCode;
    reason_message?: string | null;
    internal_note?: string | null;
  }
): Promise<{ success: boolean }> {
  const { error } = await supabase.rpc("admin_reject_organizer_request", {
    p_request_id: id,
    p_reviewer_id: params.reviewer_id,
    p_reason_code: params.reason_code,
    p_reason_message: params.reason_message ?? null,
    p_internal_note: params.internal_note ?? null,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function revokeOrganizerAccess(params: {
  organizer_id: string;
  reviewer_id: string;
  reason?: string | null;
}): Promise<{ success: boolean }> {
  const { error } = await supabase.rpc("admin_revoke_organizer_access", {
    p_organizer_id: params.organizer_id,
    p_reviewer_id: params.reviewer_id,
    p_reason: params.reason ?? null,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

/**
 * Returns the count of currently-pending requests — used for the sidebar
 * badge and the overview metric card. Cached separately from the directory
 * so the badge can refresh cheaply.
 */
export async function fetchPendingOrganizerRequestCount(): Promise<number> {
  const { count, error } = await supabase.rpc("admin_organizer_request_counts").select();
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Re-exported so the hook imports from one place. */
export type { RequestStatus };
