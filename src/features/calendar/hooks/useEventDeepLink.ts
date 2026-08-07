import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ScheduleXEvent } from "../../../types/events";

// Opens the event referenced by the `?event=` URL param once, as soon as
// `events` has been populated. Guarded by a one-shot ref so it never
// re-opens the modal after the user has closed it (e.g. on ESC).
export function useEventDeepLink(
  events: ScheduleXEvent[],
  onOpen: (event: ScheduleXEvent) => void
) {
  const [searchParams] = useSearchParams();
  const hasLoadedFromUrl = useRef(false);

  useEffect(() => {
    if (hasLoadedFromUrl.current) return;
    if (events.length === 0) return;

    const eventIdFromUrl = searchParams.get("event");
    if (!eventIdFromUrl) return;

    const event = events.find((e) => String(e.id) === eventIdFromUrl);
    if (event) {
      hasLoadedFromUrl.current = true;
      onOpen(event);
    }
  }, [events, searchParams, onOpen]);
}
