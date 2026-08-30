import { ScheduleXEvent } from "../../types/events";

/**
 * Resolves the image URL for the event modal poster header.
 * Returns the event's uploaded flyer when present; otherwise undefined
 * (the modal renders SalsaSeguraFallbackImage component for the fallback).
 */
export function resolveEventModalImage(
  event: Pick<ScheduleXEvent, "id" | "imageUrl" | "calendarId">
): string | undefined {
  return event.imageUrl || undefined;
}
