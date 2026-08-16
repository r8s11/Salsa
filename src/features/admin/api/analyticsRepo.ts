import { supabase } from "../../../lib/supabase";
import type { AnalyticsData, Granularity, DateRange } from "../model/analyticsQuery";
import { parseMetrics, parseSeries } from "../model/analyticsQuery";

export interface AnalyticsFetchParams {
  range: DateRange;
  granularity: Granularity;
}

/**
 * Fetches all analytics data in a single batch:
 *   1. admin_analytics_metrics RPC → metric card values + deltas
 *   2. admin_analytics_timeseries RPC → chart data (two series)
 *
 * Both RPCs are SECURITY DEFINER and admin-gated inside the function.
 * The page calls this once per range/granularity change; TanStack Query
 * handles caching and dedup.
 */
export async function fetchAnalytics(params: AnalyticsFetchParams): Promise<AnalyticsData> {
  const { range, granularity } = params;
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  // Metrics + time-series in parallel
  const [metricsResult, seriesResult] = await Promise.all([
    supabase.rpc("admin_analytics_metrics", {
      from_date: fromIso,
      to_date: toIso,
    }),
    supabase.rpc("admin_analytics_timeseries", {
      from_date: fromIso,
      to_date: toIso,
      granularity: granularity as string,
    }),
  ]);

  if (metricsResult.error) {
    throw new Error(`Failed to load analytics metrics: ${metricsResult.error.message}`);
  }
  if (seriesResult.error) {
    throw new Error(`Failed to load analytics time series: ${seriesResult.error.message}`);
  }

  return {
    metrics: parseMetrics(metricsResult.data),
    series: parseSeries(seriesResult.data),
  };
}
