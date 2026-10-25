import { useEffect, useRef } from "react";
import Button from "../../../components/ui/Button";

interface Props {
  loading: boolean;
  /** The last load failed and there is nothing to show; holds through a retry. */
  loadFailed: boolean;
  retrying: boolean;
  isEmpty: boolean;
  hasNoMatches: boolean;
  /** Selected metro's name, or null when no metro is chosen. */
  cityLabel: string | null;
  onRetry: () => void;
  onClearFilter: () => void;
}

export default function CalendarStatus({
  loading,
  loadFailed,
  retrying,
  isEmpty,
  hasNoMatches,
  cityLabel,
  onRetry,
  onClearFilter,
}: Props) {
  // Retry disables its button while the request runs, which drops keyboard
  // focus to <body>. When the retry settles and the failure is still showing,
  // hand focus back so a keyboard user can try again from where they were.
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const retryPending = useRef(false);
  useEffect(() => {
    if (retrying || !retryPending.current) return;
    retryPending.current = false;
    retryButtonRef.current?.focus();
  }, [retrying]);

  if (loadFailed) {
    return (
      <div className="calendar-status calendar-error" role="alert">
        <p>
          {cityLabel
            ? `We couldn't load ${cityLabel}'s listings.`
            : "We couldn't load the listings."}{" "}
          The events didn&apos;t come through this time.
        </p>
        <Button
          ref={retryButtonRef}
          variant="secondary"
          loading={retrying}
          loadingLabel="Trying again…"
          onClick={() => {
            retryPending.current = true;
            onRetry();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="calendar-status" role="status">
        Loading events…
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="calendar-status" role="status">
        <p>
          {cityLabel
            ? `No upcoming events in ${cityLabel} yet.`
            : "Choose a city to see its dance calendar."}
        </p>
      </div>
    );
  }

  if (hasNoMatches) {
    return (
      <div className="calendar-status" role="status">
        <p>No events match this filter.</p>
        <button onClick={onClearFilter}>Show all events</button>
      </div>
    );
  }

  return null;
}
