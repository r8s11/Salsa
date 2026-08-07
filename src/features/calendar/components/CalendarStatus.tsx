interface Props {
  loading: boolean;
  error: string | null;
}

export default function CalendarStatus({ loading, error }: Props) {
  return (
    <>
      {loading && (
        <div className="calendar-status">
          <p>Loading events...</p>
        </div>
      )}
      {error && (
        <div className="calendar-status calendar-error">
          <p>Failed to load events: {error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}
    </>
  );
}
