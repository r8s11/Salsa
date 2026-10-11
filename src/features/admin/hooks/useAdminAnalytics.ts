import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/useAuth";
import { fetchAnalytics } from "../api/analyticsRepo";
import { dateRangeFor, type TimeRange } from "../model/analyticsQuery";

export function useAdminAnalytics(period: TimeRange) {
  const { user, isAdmin, loading } = useAuth();
  const authorized = !loading && Boolean(user) && isAdmin;
  const range = dateRangeFor(period);
  const query = useQuery({
    queryKey: ["admin", "analytics", user?.id, range.from, range.to],
    queryFn: () => fetchAnalytics(range),
    enabled: authorized,
    staleTime: 5 * 60 * 1000,
  });
  // Never present cached values as a successful refresh or under a different account.
  const data = authorized && !query.isError ? query.data : undefined;
  return {
    metrics: data?.metrics ?? null,
    cities: data?.cities ?? null,
    asOf: data?.asOf ?? null,
    isLoading: authorized && query.isPending,
    isFetching: authorized && query.isFetching,
    error: query.isError ? "Unable to load analytics. Please try again." : null,
    refetch: query.refetch,
  };
}
