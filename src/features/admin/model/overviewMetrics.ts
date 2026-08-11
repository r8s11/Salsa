import type { DatabaseEvent } from "../../events/model/types";

export const UPCOMING_WINDOW_DAYS = 30;
export const UPCOMING_LIST_LIMIT = 8;

export type MissingField = "venue" | "time" | "image";

export interface OverviewMetrics {
  upcomingCount: number;
  pendingCount: number;
  incompleteCount: number;
  totalCount: number;
}

function daysFromNow(now: Date, days: number): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function missingFields(event: DatabaseEvent): MissingField[] {
  const missing: MissingField[] = [];
  if (!event.location?.trim()) missing.push("venue");
  if (!event.event_time?.trim()) missing.push("time");
  if (!event.image_url?.trim()) missing.push("image");
  return missing;
}

export function deriveOverviewMetrics(events: DatabaseEvent[], now: Date): OverviewMetrics {
  const windowEnd = daysFromNow(now, UPCOMING_WINDOW_DAYS);

  const upcomingCount = events.filter((event) => {
    if (event.status !== "approved") return false;
    const eventDate = new Date(event.event_date);
    return eventDate >= now && eventDate <= windowEnd;
  }).length;

  const pendingCount = events.filter((event) => event.status === "pending").length;

  const incompleteCount = deriveIncompleteEvents(events, now).length;

  return { upcomingCount, pendingCount, incompleteCount, totalCount: events.length };
}

export function deriveUpcomingEvents(events: DatabaseEvent[], now: Date): DatabaseEvent[] {
  return events
    .filter((event) => event.status === "approved" && new Date(event.event_date) >= now)
    .sort((a, b) => Date.parse(a.event_date) - Date.parse(b.event_date))
    .slice(0, UPCOMING_LIST_LIMIT);
}

export function deriveIncompleteEvents(
  events: DatabaseEvent[],
  now: Date
): { event: DatabaseEvent; missing: MissingField[] }[] {
  return events
    .filter((event) => event.status === "approved" && new Date(event.event_date) >= now)
    .map((event) => ({ event, missing: missingFields(event) }))
    .filter(({ missing }) => missing.length > 0);
}
