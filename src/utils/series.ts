// Purpose: Derive upcoming recurring-series occurrences from an event's start.
//
// Occurrences are generated in wall-clock time and only then anchored to the
// series' IANA zone, so "Saturday 20:00" stays 20:00 across a daylight-saving
// change (the UTC instant moves, the local time does not). Adding a fixed number
// of hours/UTC days instead would drift by an hour at the boundary.

import "temporal-polyfill/global";
import { isValidIanaTimeZone, invalidTimeZoneMessage, MISSING_TIME_ZONE_MESSAGE } from "../shared/utils/timezone";

export type Recurrence = "weekly" | "monthly";

export interface SeriesOccurrence {
  /** Local wall-clock start, no zone attached. */
  local: Temporal.PlainDateTime;
  /** Same moment anchored to the series zone. */
  zoned: Temporal.ZonedDateTime;
  timeZone: string;
}

/** Wall-clock occurrences after `start`; zone-less, used for display lists. */
export function getUpcomingSeriesDates(
  start: string,
  count = 3,
  recurrence: Recurrence = "weekly"
): Temporal.PlainDateTime[] {
  const base = Temporal.PlainDateTime.from(start.replace(" ", "T"));
  return Array.from({ length: count }, (_, i) =>
    recurrence === "monthly" ? base.add({ months: i + 1 }) : base.add({ weeks: i + 1 })
  );
}

/**
 * Occurrences anchored to a resolved IANA zone. Throws a user-readable Error for
 * a missing or invalid zone rather than falling back to UTC or another zone.
 *
 * `disambiguation: "compatible"` (the Temporal default, stated for clarity):
 * a wall time skipped by spring-forward moves to the next valid instant; a wall
 * time repeated by fall-back takes the earlier one.
 */
export function generateSeriesOccurrences(
  start: string,
  timeZone: string | null | undefined,
  count = 3,
  recurrence: Recurrence = "weekly"
): SeriesOccurrence[] {
  if (timeZone == null || timeZone.trim() === "") throw new Error(MISSING_TIME_ZONE_MESSAGE);
  if (!isValidIanaTimeZone(timeZone)) throw new Error(invalidTimeZoneMessage(timeZone));
  const zone = timeZone.trim();

  return getUpcomingSeriesDates(start, count, recurrence).map((local) => ({
    local,
    zoned: local.toZonedDateTime(zone, { disambiguation: "compatible" }),
    timeZone: zone,
  }));
}
