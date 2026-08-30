import { createEventTitleImage } from "../../features/events/ui/eventTitleImage";
import { ScheduleXEvent } from "../../types/events";

/**
 * Resolves the image to render in the event quick-look modal (header and
 * shared square poster). Returns the event's uploaded flyer when present;
 * otherwise generates deterministic title art from the event metadata.
 */
export function resolveEventModalImage(
  event: Pick<ScheduleXEvent, "id" | "imageUrl" | "calendarId" | "title" | "city" | "start">
): string {
  if (event.imageUrl?.trim()) {
    return event.imageUrl;
  }

  return createEventTitleImage({
    id: event.id,
    title: event.title,
    eventType: event.calendarId,
    city: event.city,
    start: typeof event.start === "string" ? event.start : String(event.start),
  });
}
