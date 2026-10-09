import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminEntityClaims,
  fetchAdminEntityMembers,
  fetchPendingEntityClaimCount,
  reviewEntityClaim,
} from "../../workspaces/api/workspacesRepo";
import type { AdminEntityClaim, ClaimStatus, ManagedKind } from "../../workspaces/model";

export const ADMIN_PENDING_CLAIMS_KEY = "admin-pending-entity-claims";
export const ADMIN_ENTITY_CLAIMS_KEY = "admin-entity-claims";
export const ADMIN_ENTITY_MEMBERS_KEY = "admin-entity-members";

export type ClaimView = "pending" | "approved" | "rejected" | "all";

/** Sidebar badge: pass `enabled: false` for viewers who do not see the queue. */
export function usePendingEntityClaimCount(enabled: boolean = true): number {
  const { data } = useQuery({
    queryKey: [ADMIN_PENDING_CLAIMS_KEY],
    queryFn: () => fetchPendingEntityClaimCount(),
    staleTime: 60_000,
    enabled,
  });
  return data ?? 0;
}

export interface ReviewClaimParams {
  claimId: string;
  approve: boolean;
  note?: string | null;
}

/**
 * Every claim is loaded once (the queue is small and the tabs need all four
 * counts); the status tab only filters the cached list, so a decided row
 * leaves the pending galley in place without a refetch flash.
 */
export function useAdminEntityClaims(status: ClaimStatus | "all" = "pending") {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [ADMIN_ENTITY_CLAIMS_KEY],
    queryFn: () => fetchAdminEntityClaims(null),
    staleTime: 30_000,
  });

  const allClaims = useMemo<AdminEntityClaim[]>(() => query.data ?? [], [query.data]);

  const counts = useMemo<Record<ClaimView, number>>(
    () => ({
      pending: allClaims.filter((claim) => claim.status === "pending").length,
      approved: allClaims.filter((claim) => claim.status === "approved").length,
      rejected: allClaims.filter((claim) => claim.status === "rejected").length,
      all: allClaims.length,
    }),
    [allClaims],
  );

  const claims = useMemo(
    () => (status === "all" ? allClaims : allClaims.filter((claim) => claim.status === status)),
    [allClaims, status],
  );

  const reviewMutation = useMutation({
    mutationFn: ({ claimId, approve, note }: ReviewClaimParams) =>
      reviewEntityClaim(claimId, approve, note ?? null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ADMIN_ENTITY_CLAIMS_KEY] });
      void queryClient.invalidateQueries({ queryKey: [ADMIN_PENDING_CLAIMS_KEY] });
      void queryClient.invalidateQueries({ queryKey: [ADMIN_ENTITY_MEMBERS_KEY] });
    },
  });

  return {
    claims,
    counts,
    isLoading: query.isPending,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    review: reviewMutation.mutateAsync,
    isReviewing: reviewMutation.isPending,
    reviewingClaimId: reviewMutation.isPending ? reviewMutation.variables?.claimId ?? null : null,
    reviewError: reviewMutation.error?.message ?? null,
    resetReviewError: reviewMutation.reset,
  };
}

/** Active team of one listing, for the admin detail pages. */
export function useAdminEntityMembers(kind: ManagedKind | null, id: string | null) {
  const query = useQuery({
    queryKey: [ADMIN_ENTITY_MEMBERS_KEY, kind, id],
    queryFn: () => fetchAdminEntityMembers(kind!, id!),
    enabled: kind !== null && id !== null,
  });
  return {
    members: query.data ?? [],
    isLoading: query.isPending && query.fetchStatus !== "idle",
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
