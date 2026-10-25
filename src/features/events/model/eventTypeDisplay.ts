// Purpose: Presentation helpers for multi-category events. The primary category
// (`event_type` / `calendarId`) drives the single calendar colour; the ordered
// full selection (`event_types` / `eventTypes`) is what users see and filter by.

import { EVENT_TYPE_LABELS, getEventTypes, type EventType, type ScheduleXEvent } from "./types";

/** Full ordered categories of a Schedule-X event; falls back to the primary calendar id. */
export function scheduleXEventTypes(
  event: Pick<ScheduleXEvent, "calendarId" | "eventTypes">
): EventType[] {
  return getEventTypes({ event_type: event.calendarId, event_types: event.eventTypes });
}

/** Display labels in selection order, e.g. ["Social", "Concert"]. */
export function eventTypeLabels(types: readonly EventType[]): string[] {
  return types.map((type) => EVENT_TYPE_LABELS[type] ?? type);
}

/** Discovery cards and featured spotlight keep their longer incumbent "Social Dance" wording. */
export function eventTypeCardLabel(type: EventType): string {
  return type === "social" ? "Social Dance" : (EVENT_TYPE_LABELS[type] ?? type);
}
