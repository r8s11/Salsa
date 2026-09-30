import Button from "../../../components/ui/Button";

interface Props {
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  hasNoMatches: boolean;
  cityLabel: string;
  onRetry: () => void;
  onClearFilter: () => void;
  onSubmit: () => void;
}

export default function CalendarStatus({
  loading,
  error,
  isEmpty,
  hasNoMatches,
  cityLabel,
  onRetry,
  onClearFilter,
  onSubmit,
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
        <Button onClick={onSubmit}>Submit an Event</Button>
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
