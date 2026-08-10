import "temporal-polyfill/global";
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

function formatSubmissionDate(isoDate: string): string {
  const zdt = Temporal.Instant.from(isoDate).toZonedDateTimeISO("America/New_York");
  return zdt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const { submissions, isLoading, error, refetch } = useMySubmissions(user?.id);

  return (
    <div className="profile-page">
      <header className="profile-page-header">
        <p className="eyebrow">Account</p>
        <h1>My Profile</h1>
        {user?.email && <p className="profile-page-email">{user.email}</p>}
        <button type="button" className="btn-secondary" onClick={() => signOut()}>
          Sign Out
        </button>
      </header>

      <section className="profile-page-submissions">
        <h2>My submissions</h2>

        {isLoading && <p className="profile-page-status">Loading your submissions...</p>}

        {error && (
          <div className="profile-page-status profile-page-error">
            <p>Couldn't load your submissions: {error}</p>
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && submissions && submissions.length === 0 && (
          <p className="profile-page-status">
            You haven't submitted any events yet. <Link to="/submit">Submit one</Link>.
          </p>
        )}

        {submissions && submissions.length > 0 && (
          <ul className="profile-submission-list">
            {submissions.map((event) => (
              <li key={event.id} className="profile-submission-row">
                <div>
                  <p className="profile-submission-title">{event.title}</p>
                  <p className="profile-submission-meta">
                    {formatSubmissionDate(event.event_date)} ·{" "}
                    {event.city === "boston" ? "Boston" : "New York City"}
                  </p>
                </div>
                <span className={`profile-submission-badge profile-submission-badge--${event.status}`}>
                  {STATUS_LABEL[event.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
