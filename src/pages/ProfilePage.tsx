import "temporal-polyfill/global";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import { useMySubmissions } from "../hooks/useMySubmissions";
import type { DatabaseEvent } from "../features/events/model/types";
import "./ProfilePage.css";

const STATUS_LABEL: Record<DatabaseEvent["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

type SubmissionFilter = "all" | DatabaseEvent["status"];

function formatSubmissionDate(isoDate: string): string {
  const zdt = Temporal.Instant.from(isoDate).toZonedDateTimeISO("America/New_York");
  return zdt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { submissions, isLoading, error, refetch } = useMySubmissions(user?.id);
  const [filter, setFilter] = useState<SubmissionFilter>("all");
  const events = submissions ?? [];
  const counts = useMemo(
    () => ({
      all: events.length,
      pending: events.filter((event) => event.status === "pending").length,
      approved: events.filter((event) => event.status === "approved").length,
      rejected: events.filter((event) => event.status === "rejected").length,
    }),
    [events]
  );
  const filteredSubmissions = useMemo(
    () => events.filter((event) => filter === "all" || event.status === filter),
    [events, filter]
  );
  const filters: readonly { value: SubmissionFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "pending", label: "Pending", count: counts.pending },
    { value: "approved", label: "Approved", count: counts.approved },
    { value: "rejected", label: "Rejected", count: counts.rejected },
  ];

  return (
    <main className="profile-page">
      <header className="profile-account-card">
        <div className="profile-account-identity">
          {user?.email && (
            <span className="profile-avatar" aria-hidden="true">
              {user.email.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <p className="eyebrow">Account</p>
            <h1>My Profile</h1>
            {user?.email && <p className="profile-page-email">{user.email}</p>}
          </div>
        </div>
        <div className="profile-account-actions">
          <Link className="btn-primary" to="/submit">Submit an Event</Link>
          <Link className="btn-secondary" to="/calendar">View Calendar</Link>
          <button type="button" className="btn-secondary" onClick={() => signOut()}>
            Sign Out
          </button>
        </div>
      </header>

      <section className="profile-page-submissions" aria-labelledby="submissions-heading">
        <div className="profile-submissions-heading">
          <div>
            <p className="eyebrow">Activity</p>
            <h2 id="submissions-heading">My submissions</h2>
          </div>
          {!isLoading && !error && events.length > 0 && (
            <div className="profile-metrics" aria-label="Submission status totals">
              {filters.map(({ value, label, count }) => (
                <div className="profile-metric" key={value}>
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {isLoading && <p className="profile-page-status" role="status">Loading your submissions...</p>}

        {error && (
          <div className="profile-page-status profile-page-error" role="alert">
            <p>Couldn't load your submissions: {error}</p>
            <button type="button" onClick={() => refetch()}>Retry</button>
          </div>
        )}

        {!isLoading && !error && events.length === 0 && (
          <p className="profile-page-status">
            You haven't submitted any events yet. <Link to="/submit">Submit one</Link>.
          </p>
        )}

        {!isLoading && !error && events.length > 0 && (
          <>
            <div className="profile-filter-row" role="group" aria-label="Filter submissions by status">
              {filters.map(({ value, label, count }) => (
                <button
                  type="button"
                  key={value}
                  className="profile-filter"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label} {count}
                </button>
              ))}
            </div>

            {filteredSubmissions.length === 0 ? (
              <p className="profile-page-status">No {filter} submissions.</p>
            ) : (
              <ul className="profile-submission-list">
                {filteredSubmissions.map((event) => (
                  <li key={event.id} className="profile-submission-row">
                    <div className="profile-submission-details">
                      <p className="profile-submission-title">{event.title}</p>
                      <p className="profile-submission-meta">
                        {event.event_type} · {formatSubmissionDate(event.event_date)} ·{" "}
                        {event.city === "boston" ? "Boston" : "New York City"}
                      </p>
                    </div>
                    <div className="profile-submission-actions">
                      <span className={`profile-submission-badge profile-submission-badge--${event.status}`}>
                        {STATUS_LABEL[event.status]}
                      </span>
                      {event.status === "approved" && (
                        <Link to={`/calendar?event=${event.id}&city=${event.city}`}>View on calendar</Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </main>
  );
}
