import type { ScheduleXEvent } from "../../types/events";

export const DEFAULT_EVENT_BANNER_URL = "/images/default-event-banner.png";

const EVENT_FALLBACK_FLYERS = [
  DEFAULT_EVENT_BANNER_URL,
  "/images/event-fallbacks/salsa.svg",
  "/images/event-fallbacks/bachata.svg",
  "/images/event-fallbacks/social.svg",
  "/images/event-fallbacks/workshop.svg",
];

function stableEventHash(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export function resolveEventFlyer(
  event: Pick<ScheduleXEvent, "id" | "imageUrl" | "calendarId">
): string {
  if (event.imageUrl?.trim()) return event.imageUrl;
  return EVENT_FALLBACK_FLYERS[stableEventHash(String(event.id)) % EVENT_FALLBACK_FLYERS.length];
}
