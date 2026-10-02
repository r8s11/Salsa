import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchPendingOrganizerRequestCount } from "../api/organizerRequestsRepo";
import { fetchPendingFounderRequestCount } from "../api/founderRequestsRepo";

/**
 * Pending-count queries, defined once so the count-only hooks below and the
 * full request hooks (useOrganizerRequests / useFounderRequests) share a
 * cache entry and the same invalidation prefix.
 */
export const organizerPendingCountOptions = queryOptions({
  queryKey: ["admin", "organizer-requests", "pending-count"],
  queryFn: () => fetchPendingOrganizerRequestCount(),
  staleTime: 60_000, // 1 min — cheap, but don't hammer the RPC
});

export const founderPendingCountOptions = queryOptions({
  queryKey: ["admin", "founder-requests", "pending-count"],
  queryFn: () => fetchPendingFounderRequestCount(),
  staleTime: 60_000,
});

/**
 * Count only: never loads the request directory. Pass `enabled: false` for
 * viewers who do not see the queue, so no admin RPC fires for them.
 */
export function usePendingOrganizerRequestCount(enabled: boolean): number {
  const { data } = useQuery({ ...organizerPendingCountOptions, enabled });
  return data ?? 0;
}

export function usePendingFounderRequestCount(enabled: boolean): number {
  const { data } = useQuery({ ...founderPendingCountOptions, enabled });
  return data ?? 0;
}
