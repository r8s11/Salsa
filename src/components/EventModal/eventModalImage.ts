import { ScheduleXEvent } from "../../types/events";

const SALSA_FALLBACK_IMAGE = "/images/event-modal-salsa-party.webp";
const BACHATA_FALLBACK_IMAGE = "/images/event-modal-bachata-party.webp";

/**
 * Resolves the image to render in the event quick-look modal (header and
 * shared square poster). Returns the event's uploaded flyer when present;
 * otherwise deterministically selects a Salsa- or Bachata-party photo so the
 * same fallback is used across rerenders, browser sessions, and poster
 * capture for a given event.
 */
export function resolveEventModalImage(
  event: Pick<ScheduleXEvent, "id" | "imageUrl" | "calendarId">
): string {
  if (event.imageUrl) {
    return event.imageUrl;
  }

  const id = String(event.id);
  let charCodeSum = 0;
  for (let i = 0; i < id.length; i++) {
    charCodeSum += id.charCodeAt(i);
  }

  return charCodeSum % 2 === 0 ? SALSA_FALLBACK_IMAGE : BACHATA_FALLBACK_IMAGE;
}
