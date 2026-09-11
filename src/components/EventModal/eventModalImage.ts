import type { ScheduleXEvent } from "../../types/events";

export const DEFAULT_EVENT_BANNER_URL = "/images/default-event-banner.png";

export function resolveEventModalImage(
  event: Pick<ScheduleXEvent, "id" | "imageUrl" | "calendarId">
): string {
  return event.imageUrl || DEFAULT_EVENT_BANNER_URL;
}
