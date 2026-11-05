import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/useAuth";
import { fetchAnalytics, fetchAnalyticsTrends, fetchCoverage, fetchEntityPerformance, fetchEventEngagement, fetchOperations } from "../api/analyticsRepo";
import { DEFAULT_ENTITY_OPTIONS, dateRangeFor, granularityFor, type EntityPerformanceOptions, type EngagementSort, type TimeRange } from "../model/analyticsQuery";
import { INITIAL_OFFSETS, type OperationOffsets } from "../model/operationalAnalytics";

export function useAdminAnalytics(period: TimeRange, engagementSort: EngagementSort = "detail_views", entityOptions: EntityPerformanceOptions = DEFAULT_ENTITY_OPTIONS, offsets: OperationOffsets = INITIAL_OFFSETS) {
  const { user, isAdmin, loading } = useAuth();
  const authorized = !loading && Boolean(user) && isAdmin;
  const range = dateRangeFor(period);
  const query = useQuery({
    queryKey: ["admin", "analytics", user?.id, range.from, range.to],
    queryFn: () => fetchAnalytics(range),
    enabled: authorized,
    staleTime: 5 * 60 * 1000,
  });
  const granularity = granularityFor(period);
  const trends = useQuery({
    queryKey: ["admin", "analytics", "trends", user?.id, range.from, range.to, granularity],
    queryFn: () => fetchAnalyticsTrends(range, granularity),
    enabled: authorized,
    staleTime: 5 * 60 * 1000,
  });
  const engagementQuery = useQuery({
    queryKey: ["admin", "analytics", "engagement", user?.id, range.from, range.to, engagementSort],
    queryFn: () => fetchEventEngagement(range, engagementSort),
    enabled: authorized,
    staleTime: 5 * 60 * 1000,
  });
  const entityQuery = useQuery({
    queryKey: ["admin", "analytics", "entities", user?.id, range.from, range.to,
      entityOptions.organizerSort, entityOptions.venueSort, entityOptions.organizerOffset, entityOptions.venueOffset],
    queryFn: () => fetchEntityPerformance(range, entityOptions),
    enabled: authorized,
    staleTime: 5 * 60 * 1000,
  });
  const operationsQuery = useQuery({
    queryKey: ["admin", "analytics", "operations", user?.id, range.from, range.to,
      offsets.metro, offsets.organizer, offsets.quality, offsets.engagement],
    queryFn: () => fetchOperations(range, offsets),
    enabled: authorized,
    staleTime: 5 * 60 * 1000,
  });
  const coverageQuery = useQuery({
    queryKey: ["admin", "analytics", "coverage", user?.id],
    queryFn: fetchCoverage,
    enabled: authorized,
    staleTime: 5 * 60 * 1000,
  });
  // Never present cached values as a successful refresh or under a different account.
  const data = authorized && !query.isError ? query.data : undefined;
  const insightData = authorized && !trends.isError ? trends.data : undefined;
  const engagement = authorized && !engagementQuery.isError ? engagementQuery.data : undefined;
  const entityPerformance = authorized && !entityQuery.isError ? entityQuery.data : undefined;
  return {
    metrics: data?.metrics ?? null,
    cities: data?.cities ?? null,
    asOf: data?.asOf ?? null,
    isLoading: authorized && query.isPending,
    insights: insightData ?? null,
    insightsLoading: authorized && trends.isPending,
    insightsError: authorized && trends.isError ? "Unable to load insights. Please try again." : null,
    engagement: engagement ?? null,
    engagementLoading: authorized && engagementQuery.isPending,
    engagementError: authorized && engagementQuery.isError ? "Unable to load event engagement. Please try again." : null,
    entityPerformance: entityPerformance ?? null,
    entitiesLoading: authorized && entityQuery.isPending,
    entitiesError: authorized && entityQuery.isError ? "Unable to load entity intelligence. Please try again." : null,
    operations: authorized && !operationsQuery.isError ? operationsQuery.data ?? null : null,
    operationsLoading: authorized && operationsQuery.isPending,
    operationsError: authorized && operationsQuery.isError ? "Unable to load operational insights. Please try again." : null,
    coverage: authorized && !coverageQuery.isError ? coverageQuery.data ?? null : null,
    coverageLoading: authorized && coverageQuery.isPending,
    coverageError: authorized && coverageQuery.isError ? "Unable to load recurring coverage. Please try again." : null,
    isFetching: authorized && (query.isFetching || trends.isFetching || engagementQuery.isFetching || entityQuery.isFetching || operationsQuery.isFetching || coverageQuery.isFetching),
    error: authorized && query.isError ? "Unable to load analytics. Please try again." : null,
    refetch: () => Promise.all([query.refetch(), trends.refetch(), engagementQuery.refetch(), entityQuery.refetch(), operationsQuery.refetch(), coverageQuery.refetch()]),
  };
}
