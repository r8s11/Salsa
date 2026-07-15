// Purpose: Filter Schedule-X events by event type for the calendar toolbar.

import { EventType, ScheduleXEvent } from "../types/events";

export type TypeFilter = "all" | EventType;

export function filterEventsByType(
  events: ScheduleXEvent[],
  filter: TypeFilter
): ScheduleXEvent[] {
  return filter === "all" ? events : events.filter((e) => e.calendarId === filter);
}
