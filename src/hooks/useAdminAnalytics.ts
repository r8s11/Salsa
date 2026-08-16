import { useQuery } from "@tanstack/react-query";
import { fetchAnalytics } from "../features/admin/api/analyticsRepo";
import type { DateRange, Granularity } from "../features/admin/model/analyticsQuery";

/**
 * Admin analytics query.
 *
 * Fetches all metrics + chart data in a single batch via two RPCs.
 * Keyed by the date range ISO strings + granularity so each distinct
 * combination gets its own cache entry. 5-minute staleTime matches
 * the pattern used by useEventsQuery in the main app.
 */
export function useAdminAnalytics(range: DateRange, granularity: Granularity) {
  const query = useQuery({
    queryKey: ["admin", "analytics", range.from.toISOString(), range.to.toISOString(), granularity],
    queryFn: () =>
      fetchAnalytics({
        range,
        granularity,
      }),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  return {
    metrics: query.data?.metrics ?? null,
    series: query.data?.series ?? null,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
