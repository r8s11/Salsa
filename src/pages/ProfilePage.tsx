import "temporal-polyfill/global";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import { useMySubmissions } from "../hooks/useMySubmissions";
import type { DatabaseEvent } from "../features/events/model/types";
import "./ProfilePage.css";

function formatEventDate(isoDate: string): string {
  const zdt = Temporal.Instant.from(isoDate).toZonedDateTimeISO("America/New_York");
  return zdt.toLocaleString("en-US", { month: "short", day: "numeric" });
}

function formatEventMonth(isoDate: string): string {
  const zdt = Temporal.Instant.from(isoDate).toZonedDateTimeISO("America/New_York");
  return zdt.toLocaleString("en-US", { month: "short" }).toUpperCase();
}

function formatEventWeekday(isoDate: string): string {
  const zdt = Temporal.Instant.from(isoDate).toZonedDateTimeISO("America/New_York");
  return zdt.toLocaleString("en-US", { weekday: "short" }).toUpperCase();
}

function formatEventDay(isoDate: string): string {
  const zdt = Temporal.Instant.from(isoDate).toZonedDateTimeISO("America/New_York");
  return String(zdt.day);
}

function formatEventTime(event: DatabaseEvent): string {
  if (event.event_time) return event.event_time;
  const zdt = Temporal.Instant.from(event.event_date).toZonedDateTimeISO("America/New_York");
  return zdt.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
}

function eventTypeLabel(type: DatabaseEvent["event_type"]): string {
  switch (type) {
    case "social":
      return "Social";
    case "class":
      return "Class";
    case "workshop":
      return "Workshop";
    default:
      return type;
  }
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { submissions, approvedEvents, isLoading, error, refetch } = useMySubmissions(user?.id);

  const allEvents = useMemo(
    () => [...(submissions ?? []), ...(approvedEvents ?? [])],
    [submissions, approvedEvents]
  );

  const stats = useMemo(() => {
    const approved = allEvents.filter((e) => e.status === "approved");
    const pending = allEvents.filter((e) => e.status === "pending");
    return {
      eventsHosted: approved.length,
      pendingSubmissions: pending.length,
      total: allEvents.length,
    };
  }, [allEvents]);

  const userName =
    ((user?.user_metadata as Record<string, unknown> | null | undefined)?.full_name as
      | string
      | undefined) ||
    user?.email?.split("@")[0] ||
    "Dancer";

  const userInitial = userName.charAt(0).toUpperCase();
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;

  if (isLoading) {
    return (
      <main className="profile-page">
        <div className="profile-page-status" role="status">
          Loading profile…
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="profile-page">
        <div className="profile-page-status profile-page-error" role="alert">
          <p>Couldn't load your profile: {error}</p>
          <button type="button" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="profile-page">
      {/* Cover photo */}
      <div className="profile-cover">
        <div className="profile-cover-gradient" aria-hidden="true" />
      </div>

      {/* Profile header */}
      <div className="profile-header">
        <div className="profile-avatar-wrapper">
          <div className="profile-avatar-large" aria-hidden="true">
            {userInitial}
          </div>
        </div>

        <div className="profile-identity">
          <h1 className="profile-name">{userName}</h1>
          {memberSince && <p className="profile-member-since">Member since {memberSince}</p>}
        </div>

        <div className="profile-actions">
          <Link className="profile-action-btn profile-action-btn--primary" to="/submit">
            + Submit Event
          </Link>
          <Link className="profile-action-btn profile-action-btn--outline" to="/calendar">
            View Calendar
          </Link>
          <button
            type="button"
            className="profile-action-btn profile-action-btn--outline"
            onClick={() => signOut("global")}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="profile-stats-bar">
        <div className="profile-stat">
          <span className="profile-stat-num">{stats.eventsHosted}</span>
          <span className="profile-stat-label">Events Hosted</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-num">{stats.pendingSubmissions}</span>
          <span className="profile-stat-label">Pending</span>
        </div>
        <div className="profile-stat">
          <span className="profile-stat-num">{stats.total}</span>
          <span className="profile-stat-label">Total Submissions</span>
        </div>
      </div>

      {/* Submission management section */}
      <section className="profile-submissions" aria-labelledby="submissions-heading">
        <div className="profile-submissions-header">
          <div>
            <span className="profile-section-rule" aria-hidden="true" />
            <span className="profile-section-eyebrow">Activity</span>
            <h2 id="submissions-heading">My submissions</h2>
          </div>
        </div>

        {allEvents.length === 0 && !isLoading && (
          <p className="profile-empty">
            You haven't submitted any events yet. <Link to="/submit">Submit one</Link>.
          </p>
        )}

        {allEvents.length > 0 && (
          <div className="profile-submissions-list">
            {allEvents.map((event) => (
              <div key={event.id} className="profile-submission-row">
                <div className="profile-submission-date-block">
                  <span className="profile-submission-day">{formatEventDay(event.event_date)}</span>
                  <span className="profile-submission-month">
                    {formatEventMonth(event.event_date)}
                  </span>
                </div>
                <div className="profile-submission-info">
                  <h3 className="profile-submission-title">{event.title}</h3>
                  <p className="profile-submission-meta">
                    {eventTypeLabel(event.event_type)} · {formatEventWeekday(event.event_date)},{" "}
                    {formatEventDate(event.event_date)} · {formatEventTime(event)}
                  </p>
                  <p className="profile-submission-location">
                    {event.city === "boston" ? "Boston" : "New York City"}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
                <div className="profile-submission-right">
                  <span
                    className={`profile-submission-badge profile-submission-badge--${event.status}`}
                  >
                    {event.status}
                  </span>
                  <div className="profile-submission-links">
                    {event.status === "approved" && (
                      <Link
                        to={`/calendar?event=${event.id}&city=${event.city}`}
                        className="profile-submission-link"
                      >
                        View on calendar
                      </Link>
                    )}
                    {(event.status === "pending" || event.status === "rejected") && (
                      <Link to={`/profile/edit/${event.id}`} className="profile-submission-link">
                        Edit
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
