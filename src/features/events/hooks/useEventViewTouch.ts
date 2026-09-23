import { useEffect } from "react";
import { recordEventTouch } from "../api/eventsRepo";

/**
 * Records an event-detail "view" touch when the surface mounts (once per
 * event id per mount; the per-day dedupe lives inside recordEventTouch).
 * Fire-and-forget: telemetry never blocks or fails the page.
 */
export function useEventViewTouch(eventId: string | null | undefined): void {
  useEffect(() => {
    if (eventId) void recordEventTouch(eventId, "view");
  }, [eventId]);
}
