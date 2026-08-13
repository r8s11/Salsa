import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/useAuth";
import {
  fetchOrganizerRequests,
  fetchOrganizerRequest,
  approveOrganizerRequest,
  rejectOrganizerRequest,
  revokeOrganizerAccess,
  fetchPendingOrganizerRequestCount,
} from "../api/organizerRequestsRepo";
import type {
  OrganizerRequestRow,
  RequestStatus,
  RejectionReasonCode,
} from "../model/organizerRequestsQuery";

/**
 * Admin-level organizer-request data + mutations.
 *
 * The directory query (`["admin", "organizer-requests"]`) is the source of truth
 * for the queue page. The single-request query (`["admin", "organizer-request", id]`)
 * powers the review page. Both share the same invalidate target so any
 * approve/reject/revocation refresh both.
 */
export function useOrganizerRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const directoryQuery = useQuery({
    queryKey: ["admin", "organizer-requests"],
    queryFn: fetchOrganizerRequests,
  });

  const pendingCountQuery = useQuery({
    queryKey: ["admin", "organizer-requests", "pending-count"],
    queryFn: fetchPendingOrganizerRequestCount,
    staleTime: 60_000, // 1 min — cheap, but don't hammer the RPC
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "organizer-requests"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "organizer-requests", "pending-count"] });
  };

  const approveMutation = useMutation({
    mutationFn: ({
      id,
      internal_note,
    }: { id: string; internal_note?: string | null }) =>
      approveOrganizerRequest(id, {
        reviewer_id: user!.id,
        internal_note,
      }),
    onSuccess: () => invalidate(),
  });

  const rejectMutation = useMutation({
    mutationFn: ({
      id,
      reason_code,
      reason_message,
      internal_note,
    }: {
      id: string;
      reason_code: RejectionReasonCode;
      reason_message?: string | null;
      internal_note?: string | null;
    }) =>
      rejectOrganizerRequest(id, {
        reviewer_id: user!.id,
        reason_code,
        reason_message,
        internal_note,
      }),
    onSuccess: () => invalidate(),
  });

  const revokeMutation = useMutation({
    mutationFn: ({
      organizer_id,
      reason,
    }: { organizer_id: string; reason?: string | null }) =>
      revokeOrganizerAccess({
        organizer_id,
        reviewer_id: user!.id,
        reason,
      }),
    onSuccess: () => invalidate(),
  });

  return {
    requests: directoryQuery.data,
    isLoading: directoryQuery.isPending,
    error: directoryQuery.error ? directoryQuery.error.message : null,
    refetch: directoryQuery.refetch,

    pendingCount: pendingCountQuery.data,
    pendingCountLoading: pendingCountQuery.isPending,
    pendingCountError: pendingCountQuery.error ? pendingCountQuery.error.message : null,

    approve: approveMutation.mutate,
    isApproving: approveMutation.isPending,
    approveErrorId: approveMutation.isError ? (approveMutation.variables?.id ?? null) : null,
    approveError: approveMutation.error ? approveMutation.error.message : null,

    reject: rejectMutation.mutate,
    isRejecting: rejectMutation.isPending,
    rejectErrorId: rejectMutation.isError ? (rejectMutation.variables?.id ?? null) : null,
    rejectError: rejectMutation.error ? rejectMutation.error.message : null,

    revoke: revokeMutation.mutate,
    isRevoking: revokeMutation.isPending,
    revokeError: revokeMutation.error ? revokeMutation.error.message : null,
  };
}

/**
 * Single-request query for the review page. Reads from the directory result
 * in the TanStack cache when available; falls back to a dedicated fetch when
 * the page is opened directly via URL (no directory in cache yet).
 */
export function useOrganizerRequest(id: string | null) {
  const query = useQuery({
    queryKey: ["admin", "organizer-request", id ?? "null"],
    queryFn: () => fetchOrganizerRequest(id!),
    enabled: id !== null,
  });

  return {
    request: query.data ?? null,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}

/** Re-exported so page-level files import types from one place. */
export type { RequestStatus, RejectionReasonCode, OrganizerRequestRow };
