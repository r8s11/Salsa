import { supabase } from "../../../lib/supabase";
import type {
  FounderAccessRequestRow,
  ReviewFounderRequestPayload,
  ReviewFounderRequestResponse,
} from "../model/founderRequestsQuery";

/**
 * Fetches the fully-enriched founder request directory (one row per request).
 * Mirrors `fetchOrganizerRequests()` — a single admin-scoped RPC, no client-side joins.
 */
export async function fetchFounderRequests(): Promise<FounderAccessRequestRow[]> {
  const { data, error } = await supabase.rpc("admin_founder_requests");
  if (error) throw new Error(error.message);
  return (data as FounderAccessRequestRow[]) ?? [];
}

/**
 * Fetches a single request by id — used by the review page.
 * Returns null rather than throwing so the page can render its own "not found" empty state.
 */
export async function fetchFounderRequest(id: string): Promise<FounderAccessRequestRow | null> {
  const { data, error } = await supabase.rpc("admin_founder_request_detail", { p_id: id });
  if (error) throw new Error(error.message);
  return (data?.[0] ?? null) as FounderAccessRequestRow | null;
}

/**
 * Submits a review decision (approve/reject) for a founder request.
 * Calls the `admin_review_founder_request` RPC which enforces:
 * - admin-only (via is_admin())
 * - request must be in 'pending' status
 * - decision must be 'approve' or 'reject'
 * - rejection reason code required for reject
 * - concurrency-safe (optimistic locking via status check)
 * - reviewed_by = authenticated user, reviewed_at = now()
 * - clears rejection fields on approve
 */
export async function reviewFounderRequest(
  payload: ReviewFounderRequestPayload
): Promise<ReviewFounderRequestResponse> {
  const { data, error } = await supabase.rpc("admin_review_founder_request", {
    p_request_id: payload.requestId,
    p_decision: payload.decision,
    p_reviewer_id: (await supabase.auth.getUser()).data.user?.id ?? "",
    p_reason_code: payload.reasonCode ?? null,
    p_reason_message: payload.message ?? null,
  });

  if (error) {
    // Handle concurrency conflict
    if (error.code === "55000" || error.message?.includes("already reviewed")) {
      throw new Error("This request was already reviewed by another admin. Refresh to see the latest status.");
    }
    if (error.code === "42501") {
      throw new Error("Admin role required to review founder requests.");
    }
    if (error.code === "22023") {
      throw new Error(error.message);
    }
    if (error.code === "P0002") {
      throw new Error("Request not found.");
    }
    throw new Error(error.message);
  }

  return data as ReviewFounderRequestResponse;
}

/**
 * Returns the count of currently-pending requests — used for the sidebar badge.
 */
export async function fetchPendingFounderRequestCount(): Promise<number> {
  const { count, error } = await supabase.rpc("admin_founder_request_counts").select();
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Type guard to check if a request is still pending (client-side).
 */
export function isRequestPending(request: { status: string }): boolean {
  return request.status === "pending";
}

/**
 * Type guard to check if a request is editable (pending + current user is admin).
 * Used for conditional rendering of action buttons.
 */
export function canEditRequest(
  request: { status: string },
  isAdmin: boolean
): boolean {
  return request.status === "pending" && isAdmin;
}