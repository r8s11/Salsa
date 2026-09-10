import ButtonLink from "../../../components/ui/ButtonLink";

interface Props {
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  hasNoMatches: boolean;
  cityLabel: string;
  onRetry: () => void;
  onClearFilter: () => void;
}

export default function CalendarStatus({
  loading,
  error,
  isEmpty,
  hasNoMatches,
  cityLabel,
  onRetry,
  onClearFilter,
}: Props) {
  if (loading) {
    return (
      <div className="calendar-status" role="status">
        Loading events…
      </div>
    );
  }

  if (error) {
    return (
      <div className="calendar-status calendar-error" role="alert">
        <p>Failed to load events: {error}</p>
        <button onClick={onRetry}>Retry</button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="calendar-status" role="status">
        <p>No upcoming events in {cityLabel} yet.</p>
        <ButtonLink to="/submit" variant="primary">
          Submit an Event
        </ButtonLink>
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
