// Week math for itineraries. A "dance night" runs until NIGHT_CUTOFF_HOUR the
// next morning, so a Sunday 00:30 start belongs to Saturday night. Weeks run
// Monday 05:00 → Monday 05:00 in the itinerary's zone. Pure and DOM-free.
import "temporal-polyfill/global";
import { metroTimeZone, PLATFORM_DEFAULT_TIME_ZONE } from "../../../shared/utils/timezone";
import type { IsoWeekday } from "./types";

export const NIGHT_CUTOFF_HOUR = 5;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function itineraryTimeZone(city: string): string {
  return metroTimeZone(city) ?? PLATFORM_DEFAULT_TIME_ZONE;
}

export function danceNightOf(instantISO: string, timeZone: string): Temporal.PlainDate {
  return Temporal.Instant.from(instantISO)
    .toZonedDateTimeISO(timeZone)
    .subtract({ hours: NIGHT_CUTOFF_HOUR })
    .toPlainDate();
}

export function nightWeekday(instantISO: string, timeZone: string): IsoWeekday {
  return danceNightOf(instantISO, timeZone).dayOfWeek as IsoWeekday;
}

function mondayOf(date: Temporal.PlainDate): Temporal.PlainDate {
  return date.subtract({ days: date.dayOfWeek - 1 });
}

export function weekStartFor(date: string): string {
  try {
    return mondayOf(Temporal.PlainDate.from(date)).toString();
  } catch {
    return "";
  }
}

export function defaultWeekStart(now: Temporal.Instant, timeZone: string): string {
  return mondayOf(danceNightOf(now.toString(), timeZone)).add({ weeks: 1 }).toString();
}

export function weekBounds(weekStart: string, timeZone: string): { startISO: string; endISO: string } {
  const start = Temporal.PlainDate.from(weekStart);
  const at = (d: Temporal.PlainDate) =>
    d.toZonedDateTime({ timeZone, plainTime: `0${NIGHT_CUTOFF_HOUR}:00` }).toInstant().toString();
  return { startISO: at(start), endISO: at(start.add({ weeks: 1 })) };
}

export function weekNights(weekStart: string): string[] {
  const start = Temporal.PlainDate.from(weekStart);
  return Array.from({ length: 7 }, (_, i) => start.add({ days: i }).toString());
}

export function startTimeLabel(instantISO: string, timeZone: string): string {
  const zdt = Temporal.Instant.from(instantISO).toZonedDateTimeISO(timeZone);
  const hour12 = zdt.hour % 12 || 12;
  const minutes = zdt.minute ? `:${String(zdt.minute).padStart(2, "0")}` : "";
  const label = `${hour12}${minutes} ${zdt.hour < 12 ? "AM" : "PM"}`;
  const night = danceNightOf(instantISO, timeZone);
  return Temporal.PlainDate.compare(zdt.toPlainDate(), night) === 0
    ? label
    : `${label} (${WEEKDAYS[zdt.dayOfWeek - 1]})`;
}

export function formatWeekRange(weekStart: string): string {
  const start = Temporal.PlainDate.from(weekStart);
  const end = start.add({ days: 6 });
  const startLabel = `${MONTHS[start.month - 1]} ${start.day}`;
  return start.month === end.month
    ? `${startLabel}–${end.day}`
    : `${startLabel} – ${MONTHS[end.month - 1]} ${end.day}`;
}
