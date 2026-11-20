import { useEffect } from "react";
import { posthog } from "../../../shared/analytics/posthog";
import { recordEventTouch } from "../api/eventsRepo";

/**
 * Records an event-detail "view" when the surface mounts (once per event id
 * per mount): a deduped touch via recordEventTouch, and a PostHog
 * `event_viewed` for the visit → view → RSVP funnel.
 * Fire-and-forget: telemetry never blocks or fails the page.
 */
export function useEventViewTouch(
  eventId: string | null | undefined,
  metro?: string | null,
  organizerId?: string | null
): void {
  useEffect(() => {
    if (!eventId) return;
    void recordEventTouch(eventId, "view", metro);
    posthog.capture("event_viewed", {
      event_id: eventId,
      city: metro ?? null,
      organizer_id: organizerId ?? null,
    });
  }, [eventId, metro, organizerId]);
}
