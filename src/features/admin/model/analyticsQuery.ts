import { Temporal } from "temporal-polyfill";

export type TimeRange = "7d" | "30d" | "90d" | "all";
export interface DateRange {
  from: string | null;
  to: string | null;
}
export interface AnalyticsMetrics {
  total_events: number | null;
  upcoming_events: number | null;
  registered_users: number | null;
  pending_submissions: number | null;
  active_organizers: number | null;
}
export interface CityCount {
  slug: string | null;
  city: string;
  count: number;
}
export interface AnalyticsData {
  metrics: AnalyticsMetrics;
  cities: CityCount[] | null;
  asOf: string | null;
}

export const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

/** Inclusive Eastern calendar start, exclusive next-day start; no browser-zone arithmetic. */
export function dateRangeFor(range: TimeRange, now = new Date()): DateRange {
  if (range === "all") return { from: null, to: null };
  const today = Temporal.Instant.from(now.toISOString())
    .toZonedDateTimeISO("America/New_York")
    .toPlainDate();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return {
    from: today.subtract({ days: days - 1 }).toZonedDateTime("America/New_York").toInstant().toString(),
    to: today.add({ days: 1 }).toZonedDateTime("America/New_York").toInstant().toString(),
  };
}

function parseCount(value: unknown): number | null {
  const count = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof count === "number" && Number.isSafeInteger(count) && count >= 0 ? count : null;
}

/** Missing or failed fields stay unavailable; a genuine zero remains zero. */
export function parseMetrics(raw: Record<string, unknown> | null | undefined): AnalyticsMetrics {
  return {
    total_events: parseCount(raw?.total_events),
    upcoming_events: parseCount(raw?.upcoming_events),
    registered_users: parseCount(raw?.registered_users),
    pending_submissions: parseCount(raw?.pending_submissions),
    active_organizers: parseCount(raw?.active_organizers),
  };
}

export function parseCities(raw: unknown): CityCount[] | null {
  if (!Array.isArray(raw)) return null;
  const cities: CityCount[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || typeof row.city !== "string" || !row.city.trim()) return null;
    if (row.slug !== null && (typeof row.slug !== "string" || !row.slug.trim())) return null;
    const count = parseCount(row.count);
    if (count === null) return null;
    cities.push({ slug: row.slug, city: row.city, count });
  }
  return cities;
}
