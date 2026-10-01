import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ScheduleXEvent } from "../../../types/events";

// Honor each new URL request once; feed refreshes must not reopen a dismissed event.
export function useEventDeepLink(
  events: ScheduleXEvent[],
  onOpen: (event: ScheduleXEvent) => void
) {
  const [searchParams] = useSearchParams();
  const handledEventId = useRef<string | null>(null);

  useEffect(() => {
    const eventIdFromUrl = searchParams.get("event");
    if (!eventIdFromUrl) {
      handledEventId.current = null;
      return;
    }
    if (handledEventId.current === eventIdFromUrl) return;

    const event = events.find((e) => String(e.id) === eventIdFromUrl);
    if (event) {
      handledEventId.current = eventIdFromUrl;
      onOpen(event);
    }
  }, [events, searchParams, onOpen]);
}
