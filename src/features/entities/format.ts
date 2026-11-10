import "temporal-polyfill/global";
import {
  PLATFORM_DEFAULT_TIME_ZONE,
  isValidIanaTimeZone,
  timeZoneForDisplay,
} from "../../shared/utils/timezone";
import type { EventSummary, PublicEntityRef } from "./model";

/**
 * The zone a listing row's instant is displayed in: the same event > series >
 * venue > metro rule the event composer and calendar use (shared/utils/timezone).
 * The public payload carries the venue zone and the metro slug (`city`); events
 * and series have no stored zone. Never the viewer's zone.
 */
export function eventSummaryTimeZone(event: Pick<EventSummary, "city" | "venue_time_zone">): string {
  return timeZoneForDisplay({ venue: event.venue_time_zone, metro: event.city });
}

/** A missing or invalid zone falls back to the platform default instead of throwing. */
function displayZone(timeZone: string | null | undefined): string {
  return isValidIanaTimeZone(timeZone) ? timeZone.trim() : PLATFORM_DEFAULT_TIME_ZONE;
}

export function formatEventDate(value: string, timeZone: string | null | undefined): string {
  try {
    return Temporal.Instant.from(value)
      .toZonedDateTimeISO(displayZone(timeZone))
      .toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

export function entityLocation(entity: Pick<PublicEntityRef, "address" | "city" | "state_region" | "country">): string {
  return [entity.address, entity.city?.replace(/-/g, " "), entity.state_region, entity.country].filter(Boolean).join(", ");
}

export function eventDateParts(
  value: string,
  timeZone: string | null | undefined
): { day: string; month: string; weekday: string; time: string } | null {
  try {
    const zoned = Temporal.Instant.from(value).toZonedDateTimeISO(displayZone(timeZone));
    return {
      day: String(zoned.day),
      month: zoned.toLocaleString(undefined, { month: "short" }),
      weekday: zoned.toLocaleString(undefined, { weekday: "short" }),
      time: zoned.toLocaleString(undefined, { timeStyle: "short" }),
    };
  } catch {
    return null;
  }
}
