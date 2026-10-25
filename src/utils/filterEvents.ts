// Purpose: Filter Schedule-X events by event type for the calendar toolbar.

import { EventType, ScheduleXEvent } from "../types/events";
import { scheduleXEventTypes } from "../features/events/model/eventTypeDisplay";

export type TypeFilter = "all" | EventType;

/** Matches ANY of an event's categories, not only the primary calendar color. */
export function filterEventsByType(events: ScheduleXEvent[], filter: TypeFilter): ScheduleXEvent[] {
  return filter === "all"
    ? events
    : events.filter((e) => scheduleXEventTypes(e).includes(filter));
}
