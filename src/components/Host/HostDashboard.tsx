import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ClipboardCheck, ListChecks, MapPin } from "lucide-react";
import { useAuth } from "../../contexts/useAuth";
import { useMySubmissions } from "../../hooks/useMySubmissions";
import {
  deriveHostEventRows,
  findNextHostEvent,
  isUpcomingHostEvent,
} from "../../features/host/model/hostEvents";
import AdminMetricCard from "../Admin/AdminMetricCard";
import AdminPageHeader from "../Admin/AdminPageHeader";
import "./HostDashboard.css";

export default function HostDashboard() {
  const { user } = useAuth();
  const { submissions, approvedEvents, isLoading, error, refetch } = useMySubmissions(user?.id);

  // `new Date()` stays inside useMemo — calling it in the render body trips
  // react-hooks/purity, the same constraint AdminOverviewPage documents.
  const { rows, nextRow, upcomingCount, pendingCount } = useMemo(() => {
    const now = new Date();
    const byId = new Map(
      [...submissions, ...approvedEvents].map((event) => [event.id, event] as const)
    );
    const owned = [...byId.values()];
    const derived = deriveHostEventRows(owned);
    const next = findNextHostEvent(owned, now);

    return {
      rows: derived,
      nextRow: next ? (derived.find((row) => row.event.id === next.id) ?? null) : null,
      upcomingCount: owned.filter((event) => isUpcomingHostEvent(event, now)).length,
      pendingCount: owned.filter((event) => event.status === "pending").length,
    };
  }, [submissions, approvedEvents]);

  const otherRows = rows.filter((row) => row.event.id !== nextRow?.event.id);

  return (
    <>
      <AdminPageHeader
        title="Host dashboard"
        description="Every event you submitted or published, in one place."
        actions={
          <Link to="/submit" className="admin-btn admin-btn--primary">
            Submit an event
          </Link>
        }
      />

      {error && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn&apos;t load your events.</p>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={refetch}>
            Try Again
          </button>
        </div>
      )}

      {!error && (
        <div className="admin-overview-page__body">
          <div className="admin-overview-page__metrics">
            <AdminMetricCard
              label="Upcoming Events"
              value={upcomingCount}
              subLabel="Your next dates"
              icon={CalendarDays}
              tone="informational"
              to="/host/events"
              actionLabel="View events"
              isLoading={isLoading}
            />
            <AdminMetricCard
              label="Awaiting Review"
              value={pendingCount}
              subLabel="Submitted, not yet published"
              icon={ClipboardCheck}
              tone="attention"
              to="/host/events"
              actionLabel="Review"
              isLoading={isLoading}
            />
            <AdminMetricCard
              label="Total Events"
              value={rows.length}
              subLabel="Submitted or published"
              icon={ListChecks}
              tone="informational"
              to="/host/events"
              actionLabel="Manage"
              isLoading={isLoading}
            />
          </div>

          {isLoading && (
            <p role="status" className="admin-overview-page__status">
              Loading your events…
            </p>
          )}

          {!isLoading && nextRow && (
            <section className="admin-card host-dashboard__next" aria-labelledby="host-next-event">
              <h2 id="host-next-event" className="host-dashboard__eyebrow">
                Next event
              </h2>
              <p className="host-dashboard__next-date">{nextRow.dateLabel}</p>
              <h3 className="host-dashboard__next-title">{nextRow.event.title}</h3>
              <p className="host-dashboard__next-venue">
                <MapPin size={15} aria-hidden />
                {nextRow.event.location || "Venue not set"}
              </p>
              <div className="host-dashboard__next-actions">
                <span className={`host-dashboard__status host-dashboard__status--${nextRow.event.status}`}>
                  {nextRow.statusLabel}
                </span>
                <Link className="admin-btn admin-btn--secondary" to={nextRow.action.to}>
                  {nextRow.action.label}
                </Link>
              </div>
            </section>
          )}

          {!isLoading && !nextRow && (
            <section className="admin-card host-dashboard__empty">
              <h2 className="host-dashboard__next-title">No upcoming events yet</h2>
              <p>Submit an event and it appears here once it is scheduled.</p>
              <Link className="admin-btn admin-btn--primary" to="/submit">
                Submit an event
              </Link>
            </section>
          )}

          {!isLoading && otherRows.length > 0 && (
            <section className="admin-card host-dashboard__events" aria-labelledby="host-events">
              <div className="host-dashboard__events-head">
                <h2 id="host-events" className="host-dashboard__eyebrow">
                  Your other events
                </h2>
                <Link className="host-dashboard__all" to="/host/events">
                  All my events →
                </Link>
              </div>
              <ul className="host-dashboard__list">
                {otherRows.map((row) => (
                  <li key={row.event.id} className="host-dashboard__row">
                    <div className="host-dashboard__row-main">
                      <h3 className="host-dashboard__row-title">{row.event.title}</h3>
                      <p className="host-dashboard__row-meta">
                        {row.dateLabel} · {row.event.location || "Venue not set"}
                      </p>
                    </div>
                    <span className={`host-dashboard__status host-dashboard__status--${row.event.status}`}>
                      {row.statusLabel}
                    </span>
                    <Link className="host-dashboard__row-action" to={row.action.to}>
                      {row.action.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
