import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import { useMySubmissions } from "../hooks/useMySubmissions";
import { deriveHostEventRows } from "../features/host/model/hostEvents";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import "./HostMyEventsPage.css";

type HostEventsView = "cards" | "table";

const VIEWS: { value: HostEventsView; label: string }[] = [
  { value: "cards", label: "Cards" },
  { value: "table", label: "Table" },
];

export default function HostMyEventsPage() {
  const { user } = useAuth();
  const { submissions, approvedEvents, isLoading, error, refetch } = useMySubmissions(user?.id);
  const [view, setView] = useState<HostEventsView>("cards");

  const rows = useMemo(() => {
    const byId = new Map(
      [...submissions, ...approvedEvents].map((event) => [event.id, event] as const)
    );
    return deriveHostEventRows([...byId.values()]);
  }, [submissions, approvedEvents]);

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

          {!isLoading && rows.length > 0 && view === "cards" && (
            <ul className="host-my-events__cards">
              {rows.map((row) => (
                <li key={row.event.id} className="admin-card host-my-events__card">
                  <h2 className="host-my-events__card-title">{row.event.title}</h2>
                  <dl className="host-my-events__facts">
                    <div>
                      <dt>Date</dt>
                      <dd>{row.dateLabel}</dd>
                    </div>
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
                  <Link className="host-my-events__action" to={row.action.to}>
                    {row.action.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {!isLoading && rows.length > 0 && view === "table" && (
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
                {rows.map((row) => (
                  <tr key={row.event.id}>
                    <td data-label="Event">{row.event.title}</td>
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
                      <Link className="host-my-events__action" to={row.action.to}>
                        {row.action.label}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}
