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

export type EngagementSort = "detail_views" | "rsvp_clicks" | "ticket_clicks" | "shares";
export interface EventEngagementRow {
  id: string;
  title: string;
  event_date: string | null;
  city_slug: string | null;
  city: string;
  status: string;
  detail_views: number;
  rsvp_clicks: number;
  ticket_clicks: number;
  shares: number;
}
export interface EventEngagementSummary {
  detail_views: number;
  rsvp_clicks: number;
  ticket_clicks: number;
  shares: number;
  outbound_clicks: number;
  click_to_view_ratio: number | null;
}
export interface MetroEngagement {
  slug: string | null;
  city: string;
  detail_views: number;
  rsvp_clicks: number;
  ticket_clicks: number;
  shares: number;
}
export interface StyleEngagement {
  slug: string | null;
  style: string;
  detail_views: number;
  rsvp_clicks: number;
  shares: number;
}
export interface AnalyticsEngagement {
  asOf: string | null;
  firstRecordedAt: string | null;
  summary: EventEngagementSummary | null;
  events: EventEngagementRow[] | null;
  metros: MetroEngagement[] | null;
  styles: StyleEngagement[] | null;
  savesAvailable: false;
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

export type Granularity = "daily" | "weekly" | "monthly";
export interface EventGrowth {
  current: number;
  previous: number | null;
  series: { period: string; created: number; approved: number; pending_draft: number }[];
}
export interface UserGrowth {
  current: number;
  previous: number | null;
  total_accounts: number;
  series: { period: string; count: number }[];
}
export interface SubmissionPerformance {
  received: number;
  approved: number;
  rejected: number;
  pending: number;
  needs_information: number;
  withdrawn: number;
  series: { period: string; count: number }[];
}
export interface GeographyInsights {
  active_metros: number;
  scheduled: (CityCount & { period: string })[];
  emerging: { slug: string; city: string; first_created_at: string; upcoming: number }[];
  inventory_history_available: false;
}
export interface StyleInsights {
  upcoming_total: number;
  distribution: { slug: string | null; style: string; count: number }[];
  scheduled: { period: string; slug: string | null; style: string; count: number }[];
}
export interface AnalyticsInsights {
  granularity: Granularity;
  asOf: string | null;
  events: EventGrowth | null;
  users: UserGrowth | null;
  submissions: SubmissionPerformance | null;
  geography: GeographyInsights | null;
  styles: StyleInsights | null;
}

export function granularityFor(range: TimeRange): Granularity {
  return range === "all" ? "monthly" : range === "90d" ? "weekly" : "daily";
}

export function growthPercentage(current: number, previous: number | null): number | null {
  return previous === null || previous === 0 ? null : ((current - previous) / previous) * 100;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function period(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try { return Temporal.PlainDate.from(value).toString() === value; } catch { return false; }
}
function instant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { Temporal.Instant.from(value); return true; } catch { return false; }
}
function rows<T>(value: unknown, parse: (row: Record<string, unknown>) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const result: T[] = [];
  for (const item of value) {
    const raw = record(item);
    const parsed = raw && parse(raw);
    if (parsed === null) return null;
    result.push(parsed);
  }
  return result;
}
function countSeries(value: unknown): UserGrowth["series"] | null {
  return rows(value, (row) => {
    const count = parseCount(row.count);
    return period(row.period) && count !== null ? { period: row.period, count } : null;
  });
}
function eventGrowth(value: unknown): EventGrowth | null {
  const raw = record(value);
  if (!raw) return null;
  const current = parseCount(raw.current);
  const previous = raw.previous === null ? null : parseCount(raw.previous);
  const series = rows(raw.series, (row) => {
    const created = parseCount(row.created), approved = parseCount(row.approved), pending_draft = parseCount(row.pending_draft);
    return period(row.period) && created !== null && approved !== null && pending_draft !== null
      ? { period: row.period, created, approved, pending_draft } : null;
  });
  return current !== null && (raw.previous === null || previous !== null) && series !== null
    ? { current, previous, series } : null;
}
function userGrowth(value: unknown): UserGrowth | null {
  const raw = record(value);
  if (!raw) return null;
  const current = parseCount(raw.current), total_accounts = parseCount(raw.total_accounts);
  const previous = raw.previous === null ? null : parseCount(raw.previous);
  const series = countSeries(raw.series);
  return current !== null && total_accounts !== null && (raw.previous === null || previous !== null) && series !== null
    ? { current, previous, total_accounts, series } : null;
}
function submissions(value: unknown): SubmissionPerformance | null {
  const raw = record(value);
  if (!raw) return null;
  const received = parseCount(raw.received), approved = parseCount(raw.approved), rejected = parseCount(raw.rejected),
    pending = parseCount(raw.pending), needs_information = parseCount(raw.needs_information), withdrawn = parseCount(raw.withdrawn);
  const series = countSeries(raw.series);
  return received !== null && approved !== null && rejected !== null && pending !== null
    && needs_information !== null && withdrawn !== null && series !== null
    ? { received, approved, rejected, pending, needs_information, withdrawn, series } : null;
}
function geography(value: unknown): GeographyInsights | null {
  const raw = record(value);
  if (!raw || raw.inventory_history_available !== false) return null;
  const active_metros = parseCount(raw.active_metros);
  const scheduled = rows(raw.scheduled, (row) => {
    const city = parseCities([row])?.[0];
    return city && period(row.period) ? { ...city, period: row.period } : null;
  });
  const emerging = rows(raw.emerging, (row) => {
    const upcoming = parseCount(row.upcoming);
    return text(row.slug) && text(row.city) && instant(row.first_created_at) && upcoming !== null
      ? { slug: row.slug, city: row.city, first_created_at: row.first_created_at, upcoming } : null;
  });
  return active_metros !== null && scheduled !== null && emerging !== null
    ? { active_metros, scheduled, emerging, inventory_history_available: false } : null;
}
function styles(value: unknown): StyleInsights | null {
  const raw = record(value);
  if (!raw) return null;
  const upcoming_total = parseCount(raw.upcoming_total);
  const parseStyle = (row: Record<string, unknown>) => {
    const count = parseCount(row.count);
    return (row.slug === null || text(row.slug)) && text(row.style) && count !== null
      ? { slug: row.slug, style: row.style, count } : null;
  };
  const distribution = rows(raw.distribution, parseStyle);
  const scheduled = rows(raw.scheduled, (row) => {
    const style = parseStyle(row);
    return style && period(row.period) ? { ...style, period: row.period } : null;
  });
  return upcoming_total !== null && distribution !== null && scheduled !== null
    ? { upcoming_total, distribution, scheduled } : null;
}

/** Malformed or failed sources remain unavailable independently; never invent zero counts. */
export function parseInsights(raw: Record<string, unknown>): AnalyticsInsights {
  return {
    granularity: raw.granularity === "weekly" || raw.granularity === "monthly" ? raw.granularity : "daily",
    asOf: instant(raw.as_of) ? raw.as_of : null,
    events: eventGrowth(raw.events), users: userGrowth(raw.users),
    submissions: submissions(raw.submissions), geography: geography(raw.geography), styles: styles(raw.styles),
  };
}

function engagementCounts(raw: Record<string, unknown>, fields: readonly string[]): Record<string, number> | null {
  const counts: Record<string, number> = {};
  for (const field of fields) {
    const value = parseCount(raw[field]);
    if (value === null) return null;
    counts[field] = value;
  }
  return counts;
}

export function parseEventEngagement(raw: Record<string, unknown>): AnalyticsEngagement {
  const summary = (() => {
    const source = record(raw.summary);
    if (!source) return null;
    const counts = engagementCounts(source, ["detail_views", "rsvp_clicks", "ticket_clicks", "shares", "outbound_clicks"]);
    const ratio = source.click_to_view_ratio;
    if (!counts || counts.outbound_clicks !== counts.rsvp_clicks + counts.ticket_clicks
      || (ratio !== null && (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio < 0))
      || (counts.detail_views === 0 ? ratio !== null : typeof ratio !== "number"
        || Math.abs(ratio - Math.round(counts.outbound_clicks / counts.detail_views * 100 * 100) / 100) > 1e-9)) return null;
    return { ...counts, click_to_view_ratio: ratio as number | null } as EventEngagementSummary;
  })();
  const events = rows(raw.events, (row) => {
    const counts = engagementCounts(row, ["detail_views", "rsvp_clicks", "ticket_clicks", "shares"]);
    if (!counts || !text(row.id) || !text(row.title) || !text(row.city) || !text(row.status)
      || (row.city_slug !== null && !text(row.city_slug))
      || (row.event_date !== null && !instant(row.event_date))) return null;
    return {
      id: row.id, title: row.title, event_date: row.event_date, city_slug: row.city_slug,
      city: row.city, status: row.status, detail_views: counts.detail_views,
      rsvp_clicks: counts.rsvp_clicks, ticket_clicks: counts.ticket_clicks, shares: counts.shares,
    };
  });
  const metros = rows(raw.metros, (row) => {
    const counts = engagementCounts(row, ["detail_views", "rsvp_clicks", "ticket_clicks", "shares"]);
    return counts && text(row.city) && (row.slug === null || text(row.slug))
      ? {
        slug: row.slug, city: row.city, detail_views: counts.detail_views,
        rsvp_clicks: counts.rsvp_clicks, ticket_clicks: counts.ticket_clicks, shares: counts.shares,
      } : null;
  });
  const styles = rows(raw.styles, (row) => {
    const counts = engagementCounts(row, ["detail_views", "rsvp_clicks", "shares"]);
    return counts && text(row.style) && (row.slug === null || text(row.slug))
      ? { slug: row.slug, style: row.style, detail_views: counts.detail_views, rsvp_clicks: counts.rsvp_clicks, shares: counts.shares }
      : null;
  });
  return {
    asOf: instant(raw.as_of) ? raw.as_of : null,
    firstRecordedAt: instant(raw.first_recorded_at) ? raw.first_recorded_at : null,
    summary, events, metros, styles, savesAvailable: false,
  };
}

export type OrganizerPerformanceSort = "upcoming_events" | "total_events" | "detail_views" | "rsvp_clicks" | "ticket_clicks";
export type VenuePerformanceSort = Exclude<OrganizerPerformanceSort, "ticket_clicks">;
export interface EntityPerformanceOptions {
  organizerSort: OrganizerPerformanceSort;
  venueSort: VenuePerformanceSort;
  organizerOffset: number;
  venueOffset: number;
}
export const DEFAULT_ENTITY_OPTIONS: EntityPerformanceOptions = {
  organizerSort: "upcoming_events", venueSort: "upcoming_events", organizerOffset: 0, venueOffset: 0,
};
export interface EntityPerformanceRow {
  id: string;
  name: string;
  city: string | null;
  status: string;
  total_events: number;
  upcoming_events: number;
  past_events: number;
  created_events: number;
  latest_scheduled_at: string | null;
  last_occurred_at: string | null;
  last_published_at: null;
  engagement: { detail_views: number; rsvp_clicks: number; ticket_clicks: number; shares: number } | null;
  related_total: number | null;
  related: { id: string; name: string; event_count: number }[] | null;
  metro_total: number | null;
  metros: { slug: string; name: string; upcoming_events: number }[] | null;
  style_total: number | null;
  styles: { slug: string; name: string; event_count: number }[] | null;
}
export interface EntityPerformance {
  total: number;
  active: number;
  created: number;
  offset: number;
  page_size: number;
  rows: EntityPerformanceRow[];
}
export interface CoverageIntelligence {
  active_metros: number;
  inventory_history_available: false;
  rows: { slug: string; city: string; upcoming_events: number; active_organizers: number; active_venues: number }[];
}
export const QUALITY_LABELS = {
  missing_venue: "Missing canonical venue",
  missing_organizer: "Missing organizer association",
  missing_flyer: "Missing flyer",
  missing_location: "Missing location",
  missing_address: "Missing address",
  missing_metro: "Missing canonical metro",
  inconsistent_city: "Potentially inconsistent city",
  missing_taxonomy: "Missing dance styles",
  invalid_required: "Invalid required title or schedule",
};
export interface QualityIssue {
  key: keyof typeof QUALITY_LABELS;
  severity: "optional" | "recommended" | "invalid";
  count: number;
  events: { id: string; title: string; event_date: string | null }[];
}
export interface EntityIntelligence {
  asOf: string | null;
  firstRecordedAt: string | null;
  engagementAvailable: boolean;
  organizers: EntityPerformance | null;
  venues: EntityPerformance | null;
  coverage: CoverageIntelligence | null;
  quality: QualityIssue[] | null;
}

function entityPerformance(value: unknown): EntityPerformance | null {
  const source = record(value);
  if (!source) return null;
  const counts = engagementCounts(source, ["total", "active", "created", "offset", "page_size"]);
  const parsed = rows(source.rows, (row): EntityPerformanceRow | null => {
    const metrics = engagementCounts(row, ["total_events", "upcoming_events", "past_events", "created_events"]);
    const activity = row.engagement === null ? null : record(row.engagement);
    const engagement = activity && engagementCounts(activity, ["detail_views", "rsvp_clicks", "ticket_clicks", "shares"]);
    const related = row.related === null ? null : rows(row.related, (item) => {
      const count = parseCount(item.event_count);
      return text(item.id) && text(item.name) && count !== null ? { id: item.id, name: item.name, event_count: count } : null;
    });
    const metros = row.metros === null ? null : rows(row.metros, (item) => {
      const count = parseCount(item.upcoming_events);
      return text(item.slug) && text(item.name) && count !== null ? { slug: item.slug, name: item.name, upcoming_events: count } : null;
    });
    const styles = row.styles === null ? null : rows(row.styles, (item) => {
      const count = parseCount(item.event_count);
      return text(item.slug) && text(item.name) && count !== null ? { slug: item.slug, name: item.name, event_count: count } : null;
    });
    const related_total = parseCount(row.related_total), metro_total = parseCount(row.metro_total), style_total = parseCount(row.style_total);
    if (!metrics || !text(row.id) || !text(row.name) || !text(row.status)
      || (row.city !== null && typeof row.city !== "string")
      || (row.latest_scheduled_at !== null && !instant(row.latest_scheduled_at))
      || (row.last_occurred_at !== null && !instant(row.last_occurred_at)) || row.last_published_at !== null
      || (row.engagement !== null && !engagement)
      || (row.related !== null && (related === null || related_total === null))
      || (row.metros !== null && (metros === null || metro_total === null))
      || (row.styles !== null && (styles === null || style_total === null))) return null;
    return {
      id: row.id, name: row.name, city: row.city, status: row.status,
      total_events: metrics.total_events, upcoming_events: metrics.upcoming_events,
      past_events: metrics.past_events, created_events: metrics.created_events,
      latest_scheduled_at: row.latest_scheduled_at, last_occurred_at: row.last_occurred_at, last_published_at: null,
      engagement: engagement as EntityPerformanceRow["engagement"], related_total, related, metro_total, metros, style_total, styles,
    };
  });
  return counts && parsed && counts.active <= counts.total && counts.created <= counts.total
    && counts.page_size > 0 && counts.page_size <= 100
    ? { total: counts.total, active: counts.active, created: counts.created, offset: counts.offset, page_size: counts.page_size, rows: parsed } : null;
}

/** Fail individual sources closed; never replace a missing inventory or history with zero. */
export function parseEntityPerformance(raw: Record<string, unknown>): EntityIntelligence {
  const source = record(raw.coverage);
  const active = parseCount(source?.active_metros);
  const coverageRows = source && rows(source.rows, (row) => {
    const counts = engagementCounts(row, ["upcoming_events", "active_organizers", "active_venues"]);
    return counts && text(row.slug) && text(row.city) ? {
      slug: row.slug, city: row.city, upcoming_events: counts.upcoming_events,
      active_organizers: counts.active_organizers, active_venues: counts.active_venues,
    } : null;
  });
  const quality = rows(raw.quality, (row): QualityIssue | null => {
    const count = parseCount(row.count);
    const events = rows(row.events, (item) => text(item.id) && typeof item.title === "string"
      && (item.event_date === null || instant(item.event_date))
      ? { id: item.id, title: item.title, event_date: item.event_date } : null);
    return typeof row.key === "string" && Object.prototype.hasOwnProperty.call(QUALITY_LABELS, row.key)
      && (row.severity === "optional" || row.severity === "recommended" || row.severity === "invalid")
      && count !== null && events !== null
      ? { key: row.key as QualityIssue["key"], severity: row.severity, count, events } : null;
  });
  return {
    asOf: instant(raw.as_of) ? raw.as_of : null, firstRecordedAt: instant(raw.first_recorded_at) ? raw.first_recorded_at : null,
    engagementAvailable: raw.engagement_available === true,
    organizers: entityPerformance(raw.organizers), venues: entityPerformance(raw.venues),
    coverage: source?.inventory_history_available === false && active !== null && coverageRows !== null
      ? { active_metros: active, inventory_history_available: false, rows: coverageRows } : null,
    quality,
  };
}
