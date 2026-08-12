import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useAdminEvents } from "../hooks/useAdminEvents";
import { applyFilters, type EventFilters } from "../features/admin/model/eventsQuery";
import {
  displayNameFor,
  identityLineFor,
  ROLE_LABEL,
  type AdminUserRow,
} from "../features/admin/model/usersQuery";
import AdminUserAvatar from "../components/Admin/AdminUserAvatar";
import AdminRoleBadge from "../components/Admin/AdminRoleBadge";
import AdminAccountStatusBadge from "../components/Admin/AdminAccountStatusBadge";
import AdminStatusBadge from "../components/Admin/AdminStatusBadge";
import "./AdminUserDetailPage.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { users: queriedUsers, isLoading, error, refetch } = useAdminUsers();

  const users = useMemo(() => queriedUsers ?? [], [queriedUsers]);
  const user = useMemo<AdminUserRow | undefined>(
    () => users.find((candidate) => candidate.id === id),
    [users, id]
  );

  const { events: queriedEvents } = useAdminEvents();
  const events = useMemo(() => queriedEvents ?? [], [queriedEvents]);

  const submitterValue = user?.kind === "guest" ? user.email : user?.user_id;

  const userEvents = useMemo(() => {
    if (!submitterValue) return [];
    const filters: EventFilters = {
      q: "",
      from: null,
      to: null,
      status: [],
      organizer: null,
      venue: null,
      city: null,
      style: null,
      source: null,
      incompleteOnly: false,
      submitter: submitterValue,
    };
    return applyFilters(events, filters, new Date())
      .slice()
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 5);
  }, [events, submitterValue]);

  const upcomingOrganizerEvents = useMemo(
    () => userEvents.filter((event) => new Date(event.event_date).getTime() >= Date.now()).length,
    [userEvents]
  );

  if (isLoading) {
    return (
      <div className="admin-user-detail-page__loading" aria-busy="true">
        <p role="status">Loading account…</p>
      </div>
    );
  }

  if (!isLoading && error) {
    return (
      <div className="admin-banner admin-banner--error" role="alert">
        <p>We couldn&apos;t load this account.</p>
        <button type="button" className="admin-btn admin-btn--secondary" onClick={() => refetch()}>
          Try Again
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-user-detail-page__empty">
        <h2>User not found</h2>
        <Link to="/admin/users" className="admin-btn admin-btn--secondary">
          Users
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-user-detail-page">
      <Link to="/admin/users" className="admin-user-detail-page__back">
        ← Users
      </Link>

      <header className="admin-user-detail-page__header">
        <AdminUserAvatar row={user} size={64} />
        <div className="admin-user-detail-page__header-body">
          <h1>{displayNameFor(user)}</h1>
          <p className="admin-user-detail-page__identity">{identityLineFor(user)}</p>
          <div className="admin-user-detail-page__badges">
            <AdminRoleBadge role={user.role} />
            <AdminAccountStatusBadge status={user.status} reason={user.status_reason} />
          </div>
          <p className="admin-user-detail-page__joined">
            {user.kind === "guest" ? "First activity" : "Joined"} {formatDate(user.created_at)}
          </p>
        </div>
      </header>

      <div className="admin-user-detail-page__body">
        <section className="admin-card admin-user-detail-page__overview">
          <h2>Account</h2>
          {user.kind === "profile" ? (
            <>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Email</span>
                <span>
                  {user.email}{" "}
                  <span className="admin-chip">
                    {user.email_confirmed_at ? "Verified" : "Unverified"}
                  </span>
                </span>
              </div>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Username</span>
                <span>{user.username ? `@${user.username}` : "No username set"}</span>
              </div>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Account Type</span>
                <span>Registered User</span>
              </div>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Role</span>
                <span>{ROLE_LABEL[user.role!]}</span>
              </div>
            </>
          ) : (
            <>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Username</span>
                <span>—</span>
              </div>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Public Profile</span>
                <span>None</span>
              </div>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Account Type</span>
                <span>Magic-Link Submitter</span>
              </div>
              <div className="admin-user-detail-page__field">
                <span className="admin-user-detail-page__label">Email</span>
                <span>
                  {user.email}{" "}
                  <span className="admin-chip">
                    {user.email_confirmed_at ? "Verified" : "Unverified"}
                  </span>
                </span>
              </div>
            </>
          )}
        </section>

        <section className="admin-card admin-user-detail-page__summary">
          <h2>Activity Summary</h2>
          <div className="admin-user-detail-page__field">
            <span className="admin-user-detail-page__label">Contributions</span>
            <span>{user.contributions}</span>
          </div>
          <div className="admin-user-detail-page__field">
            <span className="admin-user-detail-page__label">Pending</span>
            <span>{user.pending_count}</span>
          </div>
        </section>

        <section className="admin-card admin-user-detail-page__moderation">
          <h2>Moderation</h2>
          {user.status === "active" ? (
            <p>No moderation concerns.</p>
          ) : (
            <AdminAccountStatusBadge status={user.status} reason={user.status_reason} />
          )}
        </section>

        {user.role === "organizer" && (
          <section className="admin-card admin-user-detail-page__organizer">
            <h2>Organizer</h2>
            <p>
              {displayNameFor(user)} · {upcomingOrganizerEvents} upcoming events
            </p>
            <Link to={`/admin/events?submitter=${encodeURIComponent(submitterValue!)}`}>
              View Events
            </Link>
          </section>
        )}

        <section className="admin-card admin-user-detail-page__events">
          <h2>Events &amp; Contributions</h2>
          {userEvents.length === 0 ? (
            <p>No events yet.</p>
          ) : (
            <ul className="admin-user-detail-page__events-list">
              {userEvents.map((event) => (
                <li key={event.id}>
                  <Link to={`/admin/events?edit=${event.id}`}>{event.title}</Link>
                  <AdminStatusBadge status={event.status} />
                </li>
              ))}
            </ul>
          )}
          <Link to={`/admin/events?submitter=${encodeURIComponent(submitterValue ?? "")}`}>
            View all in Events →
          </Link>
        </section>
      </div>
    </div>
  );
}
