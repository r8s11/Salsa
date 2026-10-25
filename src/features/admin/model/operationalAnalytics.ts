import type { TimeRange } from "./analyticsQuery";

export const REPORTS = { overview: "Platform Overview", events: "Event Performance", organizers: "Organizer Performance", venues: "Venue Performance", metros: "Metro Coverage", quality: "Event Data Quality", submissions: "Submission Review Summary" };
export type ReportKind = keyof typeof REPORTS;
export const OPERATIONAL_ISSUES = { missing_venue: "Missing canonical venue", missing_organizer: "Missing canonical organizer", missing_flyer: "Missing usable flyer", missing_location: "Missing location or address", missing_metro: "Missing canonical metro", missing_taxonomy: "Missing dance styles", invalid_required: "Blank required title" };
export type IssueKey = keyof typeof OPERATIONAL_ISSUES;
export type Severity = "critical" | "attention" | "informational";
export const METRO_HEALTH = { healthy: "Healthy Inventory", limited: "Limited Inventory", critical: "Critical Inventory", none: "No Upcoming Events" };
export const METRO_ACTIVITY = { currently_active: "Currently active", newly_emerging: "Newly emerging — no recorded approved past events", previously_active: "Previously active" };
export const ORGANIZER_ACTIVITY = { active: "Active", no_upcoming: "No Upcoming Events", no_history: "No Event History", unpublished: "Associated events, none currently approved" };
export interface SubmissionHealth { pending: number; average_hours: number | null; oldest_hours: number | null; over_24: number; over_48: number; over_7d: number; under_24: number; hours_24_48: number; days_2_7: number }
export interface MetroHealth { id: string; slug: string; name: string; upcoming_events: number; events_7d: number; events_30d: number; active_organizers: number; active_venues: number; past_events: number; last_event_at: string | null; health: keyof typeof METRO_HEALTH; activity: keyof typeof METRO_ACTIVITY }
export interface OrganizerActivity { id: string; name: string; total_events: number; upcoming_events: number; past_events: number; last_event_at: string | null; activity: keyof typeof ORGANIZER_ACTIVITY; previously_frequent: boolean }
export interface QualityRow { id: string; title: string; event_date: string; key: IssueKey; severity: Severity }
export interface Opportunity { id: string; title: string; event_date: string; detail_views: number; rsvp_clicks: number; ticket_clicks: number; shares: number; ratio: number }
export interface Page<T> { total: number; rows: T[] }
export interface Operations {
  asOf: string | null;
  firstRecordedAt: string | null;
  submissions: SubmissionHealth | null;
  metros: (Page<MetroHealth> & { active: number; limited: number; critical: number; previously_active: number; low_inventory: number }) | null;
  organizers: (Page<OrganizerActivity> & { active: number; no_upcoming: number; no_history: number; past_only: number; previously_frequent: number }) | null;
  quality: (Page<QualityRow> & { affected_events: number; critical_events: number; counts: Record<IssueKey, number> }) | null;
  opportunities: Page<Opportunity> | null;
  activity: Record<"events" | "accounts" | "submissions" | "organizers" | "venues" | "new_metros", number | null> | null;
  thresholds: { minimum_views: number; maximum_ratio: number; healthy_inventory: number; limited_inventory: number } | null;
}
export interface OperationOffsets { metro: number; organizer: number; quality: number; engagement: number }
export const INITIAL_OFFSETS: OperationOffsets = { metro: 0, organizer: 0, quality: 0, engagement: 0 };

function object(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function number(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
function text(value: unknown): value is string { return typeof value === "string"; }
function instant(value: unknown): value is string { return text(value) && Number.isFinite(Date.parse(value)); }
function nullableInstant(value: unknown): boolean { return value === null || instant(value); }
function member<T extends object>(value: unknown, values: T): value is keyof T { return typeof value === "string" && Object.prototype.hasOwnProperty.call(values, value); }
function counts<T extends string>(source: Record<string, unknown>, keys: readonly T[]): Record<T, number> | null {
  if (!keys.every((key) => number(source[key]) && Number.isSafeInteger(source[key]))) return null;
  return Object.fromEntries(keys.map((key) => [key, source[key]])) as Record<T, number>;
}
function page<T>(raw: unknown, parse: (row: Record<string, unknown>) => T | null): Page<T> | null {
  const source = object(raw);
  if (!source || !number(source.total) || !Number.isSafeInteger(source.total) || !Array.isArray(source.rows)) return null;
  const rows: T[] = [];
  for (const value of source.rows) { const row = object(value); const parsed = row && parse(row); if (!parsed) return null; rows.push(parsed); }
  return rows.length <= source.total ? { total: source.total, rows } : null;
}
/** Strict source-level availability: malformed responses never become false zero counts. */
export function parseOperations(raw: Record<string, unknown>): Operations {
  const s = object(raw.submissions), m = object(raw.metros), o = object(raw.organizers), q = object(raw.quality);
  const sc = s && counts(s, ["pending", "over_24", "over_48", "over_7d", "under_24", "hours_24_48", "days_2_7"]);
  const mc = m && counts(m, ["active", "limited", "critical", "previously_active", "low_inventory"]);
  const oc = o && counts(o, ["active", "no_upcoming", "no_history", "past_only", "previously_frequent"]);
  const qc = q && counts(q, ["affected_events", "critical_events"]);
  const issueCounts = q && object(q.counts); const issues = issueCounts && counts(issueCounts, Object.keys(OPERATIONAL_ISSUES) as IssueKey[]);
  const metros = page(raw.metros, (r): MetroHealth | null => {
    const c = counts(r, ["upcoming_events", "events_7d", "events_30d", "active_organizers", "active_venues", "past_events"]);
    return c && text(r.id) && text(r.slug) && text(r.name) && nullableInstant(r.last_event_at) && member(r.health, METRO_HEALTH) && member(r.activity, METRO_ACTIVITY)
      ? { ...c, id: r.id, slug: r.slug, name: r.name, last_event_at: r.last_event_at as string | null, health: r.health, activity: r.activity } : null;
  });
  const organizers = page(raw.organizers, (r): OrganizerActivity | null => {
    const c = counts(r, ["total_events", "upcoming_events", "past_events"]);
    return c && text(r.id) && text(r.name) && nullableInstant(r.last_event_at) && member(r.activity, ORGANIZER_ACTIVITY) && typeof r.previously_frequent === "boolean"
      ? { ...c, id: r.id, name: r.name, last_event_at: r.last_event_at as string | null, activity: r.activity, previously_frequent: r.previously_frequent } : null;
  });
  const quality = page(raw.quality, (r): QualityRow | null => text(r.id) && text(r.title) && instant(r.event_date) && member(r.key, OPERATIONAL_ISSUES) && ["critical", "attention", "informational"].includes(String(r.severity))
    ? { id: r.id, title: r.title, event_date: r.event_date, key: r.key, severity: r.severity as Severity } : null);
  const opportunities = page(raw.opportunities, (r): Opportunity | null => {
    const c = counts(r, ["detail_views", "rsvp_clicks", "ticket_clicks", "shares"]);
    return c && text(r.id) && text(r.title) && instant(r.event_date) && number(r.ratio) ? { ...c, id: r.id, title: r.title, event_date: r.event_date, ratio: r.ratio } : null;
  });
  const a = object(raw.activity), t = object(raw.thresholds);
  const keys = ["events", "accounts", "submissions", "organizers", "venues", "new_metros"] as const;
  return {
    asOf: instant(raw.as_of) ? raw.as_of : null, firstRecordedAt: instant(raw.first_recorded_at) ? raw.first_recorded_at : null,
    submissions: sc && s && (s.average_hours === null || number(s.average_hours)) && (s.oldest_hours === null || number(s.oldest_hours))
      ? { ...sc, average_hours: s.average_hours as number | null, oldest_hours: s.oldest_hours as number | null } : null,
    metros: metros && mc ? { ...metros, ...mc } : null, organizers: organizers && oc ? { ...organizers, ...oc } : null,
    quality: quality && qc && issues ? { ...quality, ...qc, counts: issues } : null, opportunities,
    activity: a && keys.every((key) => a[key] === null || (number(a[key]) && Number.isSafeInteger(a[key]))) ? Object.fromEntries(keys.map((key) => [key, a[key]])) as Operations["activity"] : null,
    thresholds: t && number(t.minimum_views) && number(t.maximum_ratio) && number(t.healthy_inventory) && number(t.limited_inventory)
      ? { minimum_views: t.minimum_views, maximum_ratio: t.maximum_ratio, healthy_inventory: t.healthy_inventory, limited_inventory: t.limited_inventory } : null,
  };
}

export interface AnalyticsReport { headers: string[]; rows: (string | number | null)[][]; total: number; limit: number; asOf: string; from: string | null; to: string | null; scope: string; engagementAvailable: boolean }
export function parseReport(raw: Record<string, unknown>): AnalyticsReport {
  if (!Array.isArray(raw.headers) || !raw.headers.every(text) || !Array.isArray(raw.rows)
    || !number(raw.total) || !Number.isSafeInteger(raw.total) || !number(raw.limit) || !Number.isSafeInteger(raw.limit) || raw.limit < 1
    || !instant(raw.as_of) || !nullableInstant(raw.from_date) || !nullableInstant(raw.to_date) || !text(raw.scope)
    || !raw.rows.every((row) => Array.isArray(row) && row.length === (raw.headers as unknown[]).length && row.every((cell: unknown) => cell === null || text(cell) || (typeof cell === "number" && Number.isFinite(cell))))
    || raw.rows.length !== Math.min(raw.total, raw.limit)) throw new Error("Unable to export report. Please try again.");
  return { headers: raw.headers, rows: raw.rows, total: raw.total, limit: raw.limit, asOf: raw.as_of, from: raw.from_date as string | null, to: raw.to_date as string | null, scope: raw.scope, engagementAvailable: raw.engagement_available === true };
}
export function operationalDate(value: string | null): string {
  if (!value) return "Unavailable";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short" }).formatToParts(new Date(value));
  const part = (key: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === key)?.value;
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")} ${part("timeZoneName")}`;
}
function csvCell(value: string | number | null): string {
  if (value === null) return "Unavailable";
  if (typeof value === "number") return String(value);
  // Leading whitespace/control characters can conceal a formula from spreadsheet importers.
  let start = 0;
  while (start < value.length && (value.charCodeAt(start) <= 32 || /\s/.test(value[start]))) start++;
  const safe = /^[=+\-@]/.test(value.slice(start)) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
export function reportCsv(report: AnalyticsReport): string {
  const row = (values: (string | number | null)[]) => values.map(csvCell).join(",");
  const metadata = [["Report scope", report.scope], ["Data as of", operationalDate(report.asOf)], ["Period from (inclusive)", report.from ? operationalDate(report.from) : "All time"], ["Period to (exclusive)", report.to ? operationalDate(report.to) : "All time"], ["Export coverage", `${report.rows.length} of ${report.total} rows; ${report.rows.length < report.total ? "PARTIAL" : "complete"}`], ["Applied row limit", report.limit], ["Engagement definition", "Recorded interactions, not completed registrations or purchases. Saves unavailable."]];
  return "\ufeff" + [...metadata.map(row), "", row(report.headers), ...report.rows.map((values) => row(values.map((value, index) => typeof value === "string" && /date$/i.test(report.headers[index]) && instant(value) ? operationalDate(value) : value)))].join("\r\n") + "\r\n";
}
export function reportFilename(kind: ReportKind, period: TimeRange, report: AnalyticsReport, now = new Date()): string {
  return `salsasegura-analytics-${kind}-${period}-${operationalDate(now.toISOString()).slice(0, 10)}${report.rows.length < report.total ? "-partial" : ""}.csv`;
}
