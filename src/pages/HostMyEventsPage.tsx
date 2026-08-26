import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import { useMySubmissions } from "../hooks/useMySubmissions";
import { deriveHostEventRows, isUpcomingHostEvent } from "../features/host/model/hostEvents";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import EventShareControls from "../features/events/components/EventShareControls";
import "./HostMyEventsPage.css";

type HostEventsView = "cards" | "table";
type HostStatusFilter = "all" | "upcoming" | "pending" | "rejected" | "approved" | "past";

const VIEWS: { value: HostEventsView; label: string }[] = [
  { value: "cards", label: "Cards" },
  { value: "table", label: "Table" },
];

const STATUS_FILTERS: { value: HostStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
  { value: "approved", label: "Approved" },
  { value: "past", label: "Past" },
];

export default function HostMyEventsPage() {
  const { user } = useAuth();
  const { submissions, approvedEvents, isLoading, error, refetch } = useMySubmissions(user?.id);
  const [view, setView] = useState<HostEventsView>("cards");
  const [statusFilter, setStatusFilter] = useState<HostStatusFilter>("all");
  const [filterNow] = useState(() => new Date());

  const rows = useMemo(() => {
    const byId = new Map(
      [...submissions, ...approvedEvents].map((event) => [event.id, event] as const)
    );
    return deriveHostEventRows([...byId.values()]);
  }, [submissions, approvedEvents]);
  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    if (statusFilter === "upcoming") {
      return rows.filter((row) => isUpcomingHostEvent(row.event, filterNow));
    }
    if (statusFilter === "past") {
      return rows.filter((row) => {
        try {
          return Temporal.Instant.from(row.event.event_date).epochMilliseconds <= filterNow.getTime();
        } catch {
          return false;
        }
      });
    }
    return rows.filter((row) => row.event.status === statusFilter);
  }, [filterNow, rows, statusFilter]);

  return (
    <>
      <AdminPageHeader
        title="Host · My Events"
        description="Events you submitted or published."
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
        <>
          <div className="host-my-events__controls">
            <div className="host-my-events__filters" role="group" aria-label="Event status">
              {STATUS_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`host-my-events__filter${
                    statusFilter === option.value ? " host-my-events__filter--active" : ""
                  }`}
                  aria-pressed={statusFilter === option.value}
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="host-my-events__toolbar" role="group" aria-label="Event view">
              {VIEWS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`host-my-events__view${
                    view === option.value ? " host-my-events__view--active" : ""
                  }`}
                  aria-pressed={view === option.value}
                  onClick={() => setView(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading && (
            <p role="status" className="host-my-events__status">
              Loading your events…
            </p>
          )}

          {!isLoading && rows.length === 0 && (
            <div className="admin-card host-my-events__empty">
              <p>You haven&apos;t submitted any events yet.</p>
              <Link to="/submit" className="admin-btn admin-btn--primary">
                Submit an event
              </Link>
            </div>
          )}

          {!isLoading && filteredRows.length > 0 && view === "cards" && (
            <ul className="host-my-events__cards">
              {filteredRows.map((row) => (
                <li key={row.event.id} className="admin-card host-my-events__card">
                  <p className="host-my-events__date">{row.dateLabel}</p>
                  <h2 className="host-my-events__card-title">
                    <Link to={`/host/events/${row.event.id}`}>{row.event.title}</Link>
                  </h2>
                  <dl className="host-my-events__facts">
                    <div>
                      <dt>Venue</dt>
                      <dd>{row.event.location || "Venue not set"}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        <span
                          className={`host-dashboard__status host-dashboard__status--${row.event.status}`}
                        >
                          {row.statusLabel}
                        </span>
                      </dd>
                    </div>
                  </dl>
                  <div className="host-my-events__card-actions">
                    <Link className="host-my-events__action" to={row.action.to}>
                      {row.action.label}
                    </Link>
                    {row.event.status === "approved" && (
                      <EventShareControls
                        compact
                        eventId={row.event.id}
                        title={row.event.title}
                        dateLabel={row.dateLabel}
                        location={row.event.location}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!isLoading && filteredRows.length > 0 && view === "table" && (
            <table className="host-my-events__table">
              <caption className="admin-visually-hidden">Your events</caption>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Date</th>
                  <th scope="col">Venue</th>
                  <th scope="col">Status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.event.id}>
                    <td data-label="Event">
                      <Link to={`/host/events/${row.event.id}`}>{row.event.title}</Link>
                    </td>
                    <td data-label="Date">{row.dateLabel}</td>
                    <td data-label="Venue">{row.event.location || "Venue not set"}</td>
                    <td data-label="Status">
                      <span
                        className={`host-dashboard__status host-dashboard__status--${row.event.status}`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    <td data-label="Action">
                      <div className="host-my-events__table-actions">
                        <Link className="host-my-events__action" to={row.action.to}>
                          {row.action.label}
                        </Link>
                        {row.event.status === "approved" && (
                          <EventShareControls
                            compact
                            eventId={row.event.id}
                            title={row.event.title}
                            dateLabel={row.dateLabel}
                            location={row.event.location}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isLoading && rows.length > 0 && filteredRows.length === 0 && (
            <div className="admin-card host-my-events__empty">
              <p>No {statusFilter} events found.</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
