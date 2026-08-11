import { Link } from "react-router-dom";
import type { DatabaseEvent } from "../../features/events/model/types";
import { fromEventDateInstant } from "../../features/events/model/eventDateTime";
import AdminStatusBadge from "./AdminStatusBadge";
import "./AdminUpcomingEvents.css";

interface AdminUpcomingEventsProps {
  events: DatabaseEvent[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function formatEventDate(iso: string): string {
  const { date } = fromEventDateInstant(iso);
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatEventTime(iso: string): string {
  const { time } = fromEventDateInstant(iso);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function DateTimeCell({ event }: { event: DatabaseEvent }) {
  return (
    <>
      {formatEventDate(event.event_date)}
      {event.event_time ? (
        `, ${formatEventTime(event.event_date)}`
      ) : (
        <span className="admin-upcoming__muted"> Time not set</span>
      )}
    </>
  );
}

function VenueCell({ event }: { event: DatabaseEvent }) {
  return event.location ? (
    <>{event.location}</>
  ) : (
    <span className="admin-upcoming__muted">Venue not set</span>
  );
}

export default function AdminUpcomingEvents({
  events,
  isLoading,
  error,
  onRetry,
}: AdminUpcomingEventsProps) {
  return (
    <section className="admin-card admin-upcoming" aria-labelledby="upcoming-events-heading">
      <div className="admin-upcoming__head">
        <h2 id="upcoming-events-heading">Upcoming events</h2>
        <Link to="/admin/events" className="admin-upcoming__view-all">
          View all →
        </Link>
      </div>

      {isLoading && (
        <div className="admin-upcoming__cards" aria-busy="true">
          {[1, 2, 3, 4, 5].map((key) => (
            <div
              key={key}
              className="admin-upcoming__card admin-upcoming__card--skeleton"
              aria-hidden
            >
              <span className="admin-skeleton admin-upcoming__row-skeleton" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn't load upcoming events.</p>
          {onRetry && (
            <button type="button" className="admin-btn admin-btn--secondary" onClick={onRetry}>
              Try Again
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && events.length === 0 && (
        <div className="admin-upcoming__empty">
          <p>No upcoming events scheduled.</p>
          <Link to="/admin/events?new=1" className="admin-btn admin-btn--secondary">
            + Create Event
          </Link>
        </div>
      )}

      {!isLoading && !error && events.length > 0 && (
        <>
          <div className="admin-upcoming__scroll">
            <table className="admin-upcoming__table">
              <caption className="admin-visually-hidden">Next 8 upcoming approved events</caption>
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Date &amp; Time</th>
                  <th scope="col">Venue</th>
                  <th scope="col" className="admin-upcoming__col--organizer">
                    Organizer
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <Link to={`/admin/events?edit=${event.id}`} className="admin-upcoming__title">
                        {event.title}
                      </Link>
                    </td>
                    <td>
                      <DateTimeCell event={event} />
                    </td>
                    <td>
                      <VenueCell event={event} />
                    </td>
                    <td className="admin-upcoming__col--organizer">
                      {event.host ?? event.submitter_name ?? "—"}
                    </td>
                    <td>
                      <AdminStatusBadge status={event.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="admin-upcoming__cards">
            {events.map((event) => (
              <li key={event.id} className="admin-upcoming__card">
                <div className="admin-upcoming__card-head">
                  <Link to={`/admin/events?edit=${event.id}`} className="admin-upcoming__title">
                    {event.title}
                  </Link>
                  <AdminStatusBadge status={event.status} />
                </div>
                <div className="admin-upcoming__card-row">
                  <span className="admin-upcoming__card-label">Date &amp; Time</span>
                  <span>
                    <DateTimeCell event={event} />
                  </span>
                </div>
                <div className="admin-upcoming__card-row">
                  <span className="admin-upcoming__card-label">Venue</span>
                  <span>
                    <VenueCell event={event} />
                  </span>
                </div>
                <div className="admin-upcoming__card-row">
                  <span className="admin-upcoming__card-label">Organizer</span>
                  <span>{event.host ?? event.submitter_name ?? "—"}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
