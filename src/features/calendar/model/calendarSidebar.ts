// Purpose: Pure helpers for the desktop Calendar filter sidebar — period
// range/label computation, per-type and per-range event counts, and dance
// style filtering. No React, no Schedule-X dependency beyond ScheduleXEvent.

import "temporal-polyfill/global";
import { EventType, ScheduleXEvent } from "../../events/model/types";

export type CalendarSidebarView = "month-grid" | "week" | "list";

export interface PeriodRange {
  start: Temporal.PlainDate;
  end: Temporal.PlainDate;
}

export function calendarPeriodRange(
  visibleDate: Temporal.PlainDate,
  view: CalendarSidebarView,
  today: Temporal.PlainDate
): PeriodRange {
  if (view === "list") {
    return { start: today, end: today.add({ days: 6 }) };
  }

  if (view === "week") {
    const start = visibleDate.subtract({ days: visibleDate.dayOfWeek - 1 });
    return { start, end: start.add({ days: 6 }) };
  }

  const start = visibleDate.with({ day: 1 });
  const end = start.add({ months: 1 }).subtract({ days: 1 });
  return { start, end };
}

export function formatPeriodLabel(range: PeriodRange): string {
  const { start, end } = range;
  const sameYear = start.year === end.year;
  const sameMonth = sameYear && start.month === end.month;

  const startMonth = start.toLocaleString("en-US", { month: "short" });
  const endMonth = end.toLocaleString("en-US", { month: "short" });

  if (sameMonth) {
    return `${startMonth} ${start.day} – ${end.day}, ${end.year}`;
  }

  if (sameYear) {
    return `${startMonth} ${start.day} – ${endMonth} ${end.day}, ${end.year}`;
  }

  return `${startMonth} ${start.day}, ${start.year} – ${endMonth} ${end.day}, ${end.year}`;
}

export function countEventsByType(events: ScheduleXEvent[]): Record<EventType, number> {
  const counts: Record<EventType, number> = { social: 0, class: 0, workshop: 0 };
  for (const event of events) {
    counts[event.calendarId] = (counts[event.calendarId] ?? 0) + 1;
  }
  return counts;
}

export function availableDanceStyles(events: ScheduleXEvent[]): string[] {
  const styles = new Set<string>();
  for (const event of events) {
    for (const style of event.danceStyles ?? []) {
      styles.add(style);
    }
  }
  return Array.from(styles).sort((a, b) => a.localeCompare(b));
}

export function filterEventsByDanceStyle(
  events: ScheduleXEvent[],
  style: string | "all"
): ScheduleXEvent[] {
  if (style === "all") return events;
  return events.filter((event) => (event.danceStyles ?? []).includes(style));
}

export function countEventsInRange(
  events: ScheduleXEvent[],
  start: Temporal.PlainDate,
  end: Temporal.PlainDate
): number {
  let count = 0;
  for (const event of events) {
    const eventDate = Temporal.PlainDateTime.from(event.start.replace(" ", "T")).toPlainDate();
    if (
      Temporal.PlainDate.compare(eventDate, start) >= 0 &&
      Temporal.PlainDate.compare(eventDate, end) <= 0
    ) {
      count += 1;
    }
  }
  return count;
}

export function eventCountLabel(count: number): string {
  return `${count} ${count === 1 ? "event" : "events"} this week`;
}
