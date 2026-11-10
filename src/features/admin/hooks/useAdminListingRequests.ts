import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminListingRequests,
  fetchPendingListingRequestCount,
  reviewListingRequest,
} from "../../listingRequests/api/listingRequestsRepo";
import type { AdminListingRequest } from "../../listingRequests/model";
import type { ManagedKind } from "../../workspaces/model";

export const ADMIN_LISTING_REQUESTS_KEY = "admin-listing-requests";
export const ADMIN_PENDING_LISTING_REQUESTS_KEY = "admin-pending-listing-requests";

export type ListingRequestView = "pending" | "approved" | "rejected" | "all";

/** Sidebar badge: pass `enabled: false` for viewers who do not see the queue. */
export function usePendingListingRequestCount(enabled: boolean = true): number {
  const { data } = useQuery({
    queryKey: [ADMIN_PENDING_LISTING_REQUESTS_KEY],
    queryFn: () => fetchPendingListingRequestCount(),
    staleTime: 60_000,
    enabled,
  });
  return data ?? 0;
}

export interface ReviewListingRequestParams {
  requestId: string;
  approve: boolean;
  note?: string | null;
  resultingEntityId?: string | null;
}

/**
 * Every request is loaded once (the queue is small and the tabs need all the
 * counts); the tab only filters the cached list. "All" includes withdrawn
 * requests, which have no tab of their own.
 */
export function useAdminListingRequests(view: ListingRequestView = "pending") {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [ADMIN_LISTING_REQUESTS_KEY],
    queryFn: () => fetchAdminListingRequests(null),
    staleTime: 30_000,
  });

  const all = useMemo<AdminListingRequest[]>(() => query.data ?? [], [query.data]);

  const counts = useMemo<Record<ListingRequestView, number>>(
    () => ({
      pending: all.filter((request) => request.status === "pending").length,
      approved: all.filter((request) => request.status === "approved").length,
      rejected: all.filter((request) => request.status === "rejected").length,
      all: all.length,
    }),
    [all],
  );

  const requests = useMemo(() => (view === "all" ? all : all.filter((request) => request.status === view)), [all, view]);

  const reviewMutation = useMutation({
    mutationFn: ({ requestId, approve, note, resultingEntityId }: ReviewListingRequestParams) =>
      reviewListingRequest(requestId, approve, note ?? null, resultingEntityId ?? null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ADMIN_LISTING_REQUESTS_KEY] });
      void queryClient.invalidateQueries({ queryKey: [ADMIN_PENDING_LISTING_REQUESTS_KEY] });
    },
  });

  return {
    requests,
    counts,
    isLoading: query.isPending,
    error: query.error?.message ?? null,
    refetch: query.refetch,
    review: reviewMutation.mutateAsync,
    isReviewing: reviewMutation.isPending,
    reviewingRequestId: reviewMutation.isPending ? reviewMutation.variables?.requestId ?? null : null,
    reviewError: reviewMutation.error?.message ?? null,
    resetReviewError: reviewMutation.reset,
  };
}

/** How many requests wait on one listing, for the admin detail pages. */
export function usePendingRequestsForListing(kind: ManagedKind, id: string): { count: number } {
  const { data } = useQuery({
    queryKey: [ADMIN_LISTING_REQUESTS_KEY, "pending", kind, id],
    queryFn: () => fetchAdminListingRequests("pending", { kind, id }),
    staleTime: 30_000,
  });
  return { count: data?.length ?? 0 };
}
