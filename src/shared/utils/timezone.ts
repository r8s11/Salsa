// Purpose: One place that decides which IANA timezone an event (or a recurring
// series occurrence) lives in. Pure and DOM-free so forms, calendar rendering,
// calendar exports and recurrence generation all agree.
//
// Resolution priority (first valid wins):
//   1. the event's own explicitly selected timezone
//   2. the parent event-series timezone
//   3. the linked venue's timezone
//   4. the canonical metropolitan timezone
//   5. unresolved -> caller must ask for a manual selection
//
// A value that is present but not a real IANA zone is never skipped silently:
// it is reported as `invalid` so the user sees why, instead of the event quietly
// falling back to a different zone.

import "temporal-polyfill/global";

export type TimeZoneSource = "event" | "series" | "venue" | "metro";

export interface TimeZoneCandidates {
  event?: string | null;
  series?: string | null;
  venue?: string | null;
  /** Canonical metro slug (events.city / metros.slug), e.g. "los-angeles". */
  metro?: string | null;
}

export type TimeZoneResolution =
  | { ok: true; timeZone: string; source: TimeZoneSource }
  | { ok: false; reason: "missing" | "invalid"; message: string; invalidValue?: string };

/**
 * `metros` has no timezone column, so the canonical metro fallback is derived
 * from the slug here. It is rung 4 only: any explicit event, series or venue
 * zone wins. Unknown slugs are intentionally absent, not defaulted — an unmapped
 * metro resolves to "missing" and asks for a manual selection.
 */
const METRO_TIME_ZONES: Readonly<Record<string, string>> = {
  "new-york-city": "America/New_York",
  boston: "America/New_York",
  "washington-dc": "America/New_York",
  atlanta: "America/New_York",
  miami: "America/New_York",
  orlando: "America/New_York",
  chicago: "America/Chicago",
  texas: "America/Chicago",
  "los-angeles": "America/Los_Angeles",
  "san-francisco": "America/Los_Angeles",
  london: "Europe/London",
};

export function metroTimeZone(metroSlug: string | null | undefined): string | null {
  if (!metroSlug) return null;
  return METRO_TIME_ZONES[metroSlug.trim().toLowerCase()] ?? null;
}

/** Zones offered by the picker: every zone a supported metro maps to. */
export const TIME_ZONE_OPTIONS: readonly string[] = [...new Set(Object.values(METRO_TIME_ZONES))].sort();

/** True only for a canonical-resolvable IANA identifier ("America/New_York"). */
export function isValidIanaTimeZone(value: string | null | undefined): value is string {
  if (typeof value !== "string") return false;
  const candidate = value.trim();
  // Offsets ("-05:00") are legal Temporal identifiers but are not IANA zones and
  // do not follow DST, which would silently shift recurring local times.
  if (!candidate || /^[+-]\d/.test(candidate)) return false;
  try {
    Temporal.Now.zonedDateTimeISO(candidate);
    return true;
  } catch {
    return false;
  }
}

export function invalidTimeZoneMessage(value: string): string {
  return `"${value}" is not a valid time zone. Use an IANA name such as America/New_York, America/Chicago or America/Los_Angeles.`;
}

export const MISSING_TIME_ZONE_MESSAGE =
  "This event has no time zone. Choose one (for example America/New_York) or link a venue that has one.";

export function resolveEventTimeZone(candidates: TimeZoneCandidates): TimeZoneResolution {
  const explicit: ReadonlyArray<[TimeZoneSource, string | null | undefined]> = [
    ["event", candidates.event],
    ["series", candidates.series],
    ["venue", candidates.venue],
  ];

  for (const [source, value] of explicit) {
    if (value == null || value.trim() === "") continue;
    if (isValidIanaTimeZone(value)) return { ok: true, timeZone: value.trim(), source };
    return {
      ok: false,
      reason: "invalid",
      message: `${invalidTimeZoneMessage(value)} (set on the ${source}).`,
      invalidValue: value,
    };
  }

  const fromMetro = metroTimeZone(candidates.metro);
  if (fromMetro) return { ok: true, timeZone: fromMetro, source: "metro" };

  return { ok: false, reason: "missing", message: MISSING_TIME_ZONE_MESSAGE };
}

/**
 * For display and calendar placement of events that already exist, where
 * throwing would blank a whole page: never throws, falls back to the platform
 * default only when nothing at all resolves. New or edited events must use
 * `resolveEventTimeZone` and surface its error instead.
 */
export const PLATFORM_DEFAULT_TIME_ZONE = "America/New_York";

export function timeZoneForDisplay(candidates: TimeZoneCandidates): string {
  const resolution = resolveEventTimeZone(candidates);
  return resolution.ok ? resolution.timeZone : PLATFORM_DEFAULT_TIME_ZONE;
}
