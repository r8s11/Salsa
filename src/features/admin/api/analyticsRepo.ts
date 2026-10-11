import { supabase } from "../../../lib/supabase";
import { parseCities, parseMetrics, type AnalyticsData, type DateRange } from "../model/analyticsQuery";

/** One administrator-gated aggregation snapshot; no private rows reach the browser. */
export async function fetchAnalytics(range: DateRange): Promise<AnalyticsData> {
  const { data, error } = await supabase.rpc("admin_analytics_metrics", {
    from_date: range.from,
    to_date: range.to,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Unable to load analytics. Please try again.");
  }
  return {
    metrics: parseMetrics(data),
    cities: parseCities(data.events_by_city),
    asOf: typeof data.as_of === "string" && Number.isFinite(Date.parse(data.as_of)) ? data.as_of : null,
  };
}
