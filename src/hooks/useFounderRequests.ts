import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/useAuth";
import {
  fetchFounderRequests,
  fetchFounderRequest,
  fetchFounderHostState,
  reviewFounderRequest,
  fetchPendingFounderRequestCount,
} from "../features/admin/api/founderRequestsRepo";
import type { FounderAccessRequestRow } from "../features/admin/model/founderRequestsQuery";

/**
 * Admin-level founder-request data + mutations.
 *
 * The directory query (`["admin", "founder-requests"]`) is the source of truth
 * for the queue page. The single-request query (`["admin", "founder-request", id]`)
 * powers the review page. Both share the same invalidate target so any
 * approve/reject refreshes both.
 */
export function useFounderRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.app_metadata?.role === "admin";

  const directoryQuery = useQuery({
    queryKey: ["admin", "founder-requests"],
    queryFn: () => fetchFounderRequests(),
    staleTime: 30_000,
  });

  const pendingCountQuery = useQuery({
    queryKey: ["admin", "founder-requests", "pending-count"],
    queryFn: () => fetchPendingFounderRequestCount(),
    staleTime: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "founder-requests"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "founder-request"] });
  };

  const approveMutation = useMutation({
    mutationFn: (requestId: string) =>
      reviewFounderRequest({
        requestId,
        decision: "approve",
      }),
    onSuccess: () => {
      invalidate();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (params: {
      requestId: string;
      reasonCode: string;
      message?: string;
    }) =>
      reviewFounderRequest({
        requestId: params.requestId,
        decision: "reject",
        reasonCode: params.reasonCode,
        message: params.message,
      }),
    onSuccess: () => {
      invalidate();
    },
  });

  return {
    requests: (directoryQuery.data ?? []) as FounderAccessRequestRow[],
    isLoading: directoryQuery.isLoading,
    error: directoryQuery.error,
    pendingCount: pendingCountQuery.data ?? 0,
    isLoadingPendingCount: pendingCountQuery.isLoading,
    isAdmin,
    approveRequest: approveMutation.mutate,
    isApproving: approveMutation.isPending,
    approveError: approveMutation.error,
    rejectRequest: rejectMutation.mutate,
    isRejecting: rejectMutation.isPending,
    rejectError: rejectMutation.error,
    invalidate,
  };
}

/**
 * Single-request query for the review page. Reads from the directory result
 * in the TanStack cache when available; falls back to a dedicated fetch when
 * the page is opened directly via URL (no directory in cache yet).
 */
export function useFounderRequest(id: string | null) {

  return useQuery({
    queryKey: ["admin", "founder-request", id],
    enabled: !!id,
    queryFn: () => fetchFounderRequest(id!),
    staleTime: 0,
  });
}

export function useFounderHostState(id: string | null) {
  return useQuery({
    queryKey: ["admin", "founder-host-state", id],
    enabled: !!id,
    queryFn: () => fetchFounderHostState(id!),
    staleTime: 0,
  });
}