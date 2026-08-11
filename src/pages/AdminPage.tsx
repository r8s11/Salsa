import { Link } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import { usePendingEvents } from "../hooks/usePendingEvents";
import PendingEventCard from "../components/Admin/PendingEventCard";
import "./AdminPage.css";

export default function AdminPage() {
  const { user } = useAuth();
  const {
    pending,
    isLoading,
    error,
    refetch,
    decide,
    decidingId,
    decidingStatus,
    decideErrorId,
    decideError,
  } = usePendingEvents();
  const events = pending ?? [];
  const metrics = [
    { label: "Awaiting review", value: events.length },
    { label: "Boston", value: events.filter((event) => event.city === "boston").length },
    { label: "NYC", value: events.filter((event) => event.city === "new-york-city").length },
  ];

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <p className="eyebrow">Moderation workspace</p>
        <h1>Pending events</h1>
        {user?.email && <p className="admin-page-user">Signed in as {user.email}</p>}
      </header>

      {isLoading && <p className="admin-page-status" role="status">Loading pending events…</p>}
      {!isLoading && error && (
        <div className="admin-page-status admin-page-error" role="alert">
          <p>Couldn't load pending events: {error}</p>
          <button type="button" onClick={() => refetch()}>Retry</button>
        </div>
      )}
      {!isLoading && !error && (
        <>
          <section className="admin-page-metrics" aria-label="Pending event metrics">
            {metrics.map((metric) => (
              <div className="admin-page-metric" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </section>
          {events.length === 0 ? (
            <section className="admin-page-empty" aria-labelledby="admin-empty-heading">
              <h2 id="admin-empty-heading">No events waiting for review.</h2>
              <Link className="btn-secondary" to="/calendar">View calendar</Link>
            </section>
          ) : (
            <section className="admin-page-list" aria-label="Pending event queue">
              {events.map((event) => (
                <PendingEventCard
                  key={event.id}
                  event={event}
                  onApprove={(id) => decide({ id, status: "approved" })}
                  onReject={(id) => decide({ id, status: "rejected" })}
                  decision={decidingId === event.id ? decidingStatus : null}
                  error={decideErrorId === event.id ? decideError : null}
                />
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
