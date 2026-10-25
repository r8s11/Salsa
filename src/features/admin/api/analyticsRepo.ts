import { supabase } from "../../../lib/supabase";
import { parseCities, parseEventEngagement, parseInsights, parseMetrics, type AnalyticsData, type AnalyticsEngagement, type AnalyticsInsights, type DateRange, type EngagementSort, type Granularity } from "../model/analyticsQuery";
import { parseEntityPerformance, type EntityIntelligence, type EntityPerformanceOptions } from "../model/analyticsQuery";
import { parseOperations, parseReport, type AnalyticsReport, type OperationOffsets, type Operations, type ReportKind } from "../model/operationalAnalytics";
import { parseMonitoring, parsePreferences } from "../model/analyticsMonitoring";
import type { AnalyticsPreferences, Monitoring } from "../model/analyticsMonitoring";

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

/** Administrator-only grouped counts, independently available by data source. */
export async function fetchAnalyticsTrends(range: DateRange, granularity: Granularity): Promise<AnalyticsInsights> {
  const { data, error } = await supabase.rpc("admin_analytics_timeseries", {
    from_date: range.from,
    to_date: range.to,
    granularity,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Unable to load insights. Please try again.");
  }
  return parseInsights(data);
}

/** Aggregate-only engagement data; the RPC enforces administrator authorization. */
export async function fetchEventEngagement(range: DateRange, sortBy: EngagementSort): Promise<AnalyticsEngagement> {
  const { data, error } = await supabase.rpc("admin_event_engagement", {
    from_date: range.from,
    to_date: range.to,
    sort_by: sortBy,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Unable to load event engagement. Please try again.");
  }
  return parseEventEngagement(data);
}

/** Canonical entity inventory remains available independently of engagement history. */
export async function fetchEntityPerformance(range: DateRange, options: EntityPerformanceOptions): Promise<EntityIntelligence> {
  const { data, error } = await supabase.rpc("admin_analytics_entity_performance", {
    from_date: range.from, to_date: range.to,
    organizer_sort: options.organizerSort, venue_sort: options.venueSort,
    organizer_offset: options.organizerOffset, venue_offset: options.venueOffset, page_size: 25,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Unable to load entity intelligence. Please try again.");
  }
  return parseEntityPerformance(data);
}

/** Read-only operational snapshots. Authorization remains inside the database. */
export async function fetchOperations(range: DateRange, offsets: OperationOffsets): Promise<Operations> {
  const { data, error } = await supabase.rpc("admin_analytics_operations", {
    from_date: range.from, to_date: range.to, metro_offset: offsets.metro,
    organizer_offset: offsets.organizer, quality_offset: offsets.quality, engagement_offset: offsets.engagement,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Unable to load operational insights. Please try again.");
  }
  return parseOperations(data);
}

/** Full authorized aggregate reports, not the dashboard's first ranking page. */
export async function fetchAnalyticsReport(kind: ReportKind, range: DateRange, sort: string): Promise<AnalyticsReport> {
  const { data, error } = await supabase.rpc("admin_analytics_report", {
    report_name: kind, from_date: range.from, to_date: range.to, sort_by: sort,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Unable to export report. Its data source may be unavailable. Please try again.");
  }
  return parseReport(data);
}

/** Persisted automation results; optional-source failures never block earlier analytics. */
export async function fetchAnalyticsMonitoring(): Promise<Monitoring> {
  const { data, error } = await supabase.rpc("admin_analytics_monitoring");
  if (error) throw new Error("Analytics monitoring is unavailable. Try again.");
  return parseMonitoring(data);
}

export async function saveAnalyticsPreferences(preferences: AnalyticsPreferences): Promise<AnalyticsPreferences> {
  const { data, error } = await supabase.rpc("admin_analytics_save_preferences", {
    p_frequency: preferences.frequency, p_email: preferences.email_enabled,
    p_backlog: preferences.submission_backlog, p_metros: preferences.metro_inventory,
    p_quality: preferences.event_data_quality, p_health: preferences.analytics_data_health,
  });
  if (error) throw new Error("Your notification preferences were not saved. Refresh and try again.");
  return parsePreferences(data);
}
