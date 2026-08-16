// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimeRange = "7d" | "30d" | "90d" | "ytd";
export type Granularity = "daily" | "weekly" | "monthly";

export interface DateRange {
  from: Date;
  to: Date;
}

export interface MetricValue {
  current: number;
  previous: number;
  delta: number;
}

export interface AnalyticsMetrics {
  published_events: MetricValue;
  new_users: MetricValue;
  rsvps: MetricValue;
  submissions: MetricValue;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartSeries {
  events: ChartDataPoint[];
  submissions: ChartDataPoint[];
}

export interface AnalyticsData {
  metrics: AnalyticsMetrics;
  series: ChartSeries;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TIME_RANGE_LABEL: Record<TimeRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  ytd: "This year",
};

export const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "This year" },
];

export const GRANULARITY_LABEL: Record<Granularity, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Date range helpers
// ---------------------------------------------------------------------------

export function dateRangeFor(range: TimeRange, now = new Date()): DateRange {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);

  switch (range) {
    case "7d":
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "30d":
      start.setDate(end.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    case "90d":
      start.setDate(end.getDate() - 89);
      start.setHours(0, 0, 0, 0);
      break;
    case "ytd":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { from: start, to: end };
}

export function granularityForRange(range: TimeRange): Granularity {
  if (range === "7d") return "daily";
  if (range === "30d") return "weekly";
  if (range === "90d") return "weekly";
  return "monthly";
}

export function isGranularityOverridable(range: TimeRange): boolean {
  // Daily only makes sense for <= 31 days; monthly for larger ranges
  if (range === "7d") return true;
  if (range === "30d") return true;
  if (range === "90d") return true;
  if (range === "ytd") return true;
  return true;
}

// ---------------------------------------------------------------------------
// Delta formatting
// ---------------------------------------------------------------------------

export function formatDelta(delta: number): string {
  if (delta === 0) return "no change";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}`;
}

export function deltaTrend(delta: number): "up" | "down" | "flat" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

export function deltaLabel(delta: number): string {
  const trend = deltaTrend(delta);
  if (trend === "up") return "Increased";
  if (trend === "down") return "Decreased";
  return "No change";
}

// ---------------------------------------------------------------------------
// Raw RPC → typed model transform
// ---------------------------------------------------------------------------

/**
 * Transforms the raw JSON returned by admin_analytics_metrics RPC into
 * the typed AnalyticsMetrics structure.
 *
 * The RPC returns a flat JSON object with keys like:
 *   published_events, published_events_prev, published_events_delta, etc.
 */
export function parseMetrics(raw: Record<string, unknown> | null | undefined): AnalyticsMetrics {
  if (!raw) {
    return emptyMetrics();
  }

  const num = (key: string): number => {
    const val = raw[key];
    if (typeof val === "number") return val;
    if (typeof val === "string") return Number(val) || 0;
    return 0;
  };

  return {
    published_events: {
      current: num("published_events"),
      previous: num("published_events_prev"),
      delta: num("published_events_delta"),
    },
    new_users: {
      current: num("new_users"),
      previous: num("new_users_prev"),
      delta: num("new_users_delta"),
    },
    rsvps: {
      current: num("rsvps"),
      previous: num("rsvps_prev"),
      delta: num("rsvps_delta"),
    },
    submissions: {
      current: num("submissions"),
      previous: num("submissions_prev"),
      delta: num("submissions_delta"),
    },
  };
}

export function parseSeries(raw: Record<string, unknown> | null | undefined): ChartSeries {
  const arr = (key: string): ChartDataPoint[] => {
    const val = raw?.[key];
    if (Array.isArray(val)) {
      return val
        .map((p) => {
          if (p && typeof p === "object" && "label" in p && "value" in p) {
            return {
              label: String((p as { label: unknown }).label),
              value: Number((p as { value: unknown }).value) || 0,
            };
          }
          return null;
        })
        .filter((p): p is ChartDataPoint => p !== null);
    }
    return [];
  };

  return {
    events: arr("events_by_week"),
    submissions: arr("submissions_by_week"),
  };
}

function emptyMetrics(): AnalyticsMetrics {
  const zero: MetricValue = { current: 0, previous: 0, delta: 0 };
  return {
    published_events: { ...zero },
    new_users: { ...zero },
    rsvps: { ...zero },
    submissions: { ...zero },
  };
}
