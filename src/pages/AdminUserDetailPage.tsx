import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAdminUsers } from "../hooks/useAdminUsers";
import { useAdminEvents } from "../hooks/useAdminEvents";
import { useUserAuditLog } from "../hooks/useUserAuditLog";
import { useAuth } from "../contexts/useAuth";
import { applyFilters, type EventFilters } from "../features/admin/model/eventsQuery";
import { auditLogLabelFor, actorLabelFor } from "../features/admin/model/auditLog";
import {
  displayNameFor,
  identityLineFor,
  rowActionItems,
  ROLE_LABEL,
  type AdminUserRow,
  type UserRowAction,
} from "../features/admin/model/usersQuery";
import AdminUserAvatar from "../components/Admin/AdminUserAvatar";
import AdminRoleBadge from "../components/Admin/AdminRoleBadge";
import AdminAccountStatusBadge from "../components/Admin/AdminAccountStatusBadge";
import AdminStatusBadge from "../components/Admin/AdminStatusBadge";
import AdminRoleChangeDialog from "../components/Admin/AdminRoleChangeDialog";
import AdminFlagUserDialog from "../components/Admin/AdminFlagUserDialog";
import AdminConfirmDialog from "../components/Admin/AdminConfirmDialog";
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
  const { user: authUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const {
    users: queriedUsers,
    isLoading,
    error,
    refetch,
    setRole,
    settingRoleId,
    roleErrorId,
    roleError,
    setStatus,
    settingStatusId,
    statusErrorId,
    statusError,
  } = useAdminUsers();

  const users = useMemo(() => queriedUsers ?? [], [queriedUsers]);
  const adminCount = useMemo(() => users.filter((u) => u.role === "admin").length, [users]);
  const user = useMemo<AdminUserRow | undefined>(
    () => users.find((candidate) => candidate.id === id),
    [users, id]
  );

  const { events: queriedEvents } = useAdminEvents();
  const events = useMemo(() => queriedEvents ?? [], [queriedEvents]);

  const {
    entries: auditEntries,
    isLoading: isAuditLoading,
    error: auditError,
    refetch: refetchAudit,
  } = useUserAuditLog(user?.kind === "profile" ? (user.id ?? null) : null);

  type PendingAction =
    | { kind: "role" }
    | { kind: "flag" }
    | { kind: "suspend" }
    | { kind: "ban" }
    | { kind: "restore" }
    | { kind: "unflag" }
    | null;
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

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
    () =>
      userEvents.filter((event) => new Date(event.event_date).getTime() >= new Date().getTime())
        .length,
    [userEvents]
  );

  const handleAction = (action: UserRowAction, targetUser = user) => {
    if (!targetUser) return;
    switch (action) {
      case "view-contributions": {
        const value = targetUser.kind === "guest" ? targetUser.email : (targetUser.user_id ?? "");
        navigate(`/admin/events?submitter=${encodeURIComponent(value)}`);
        break;
      }
      case "change-role":
        setPendingAction({ kind: "role" });
        break;
      case "flag":
        setPendingAction({ kind: "flag" });
        break;
      case "unflag":
        setPendingAction({ kind: "unflag" });
        break;
      case "suspend":
        setPendingAction({ kind: "suspend" });
        break;
      case "ban":
        setPendingAction({ kind: "ban" });
        break;
      case "restore":
        setPendingAction({ kind: "restore" });
        break;
    }
  };

  const closeDialog = () => setPendingAction(null);

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

  const isSelf = user.user_id === authUser?.id;
  const isLastAdmin = user.role === "admin" && adminCount <= 1;
  const onlyAdminBanner = isSelf && isLastAdmin;

  return (
    <div className="admin-user-detail-page">
      <Link to="/admin/users" className="admin-user-detail-page__back">
        ← Users
      </Link>

      <header className="admin-user-detail-page__header admin-card">
        <div className="admin-user-detail-page__eyebrow">User profile</div>
        <AdminUserAvatar row={user} size={64} />
        <div className="admin-user-detail-page__header-body">
          <h1>{displayNameFor(user)}</h1>
          <p className="admin-user-detail-page__identity">{identityLineFor(user)}</p>
          <div className="admin-user-detail-page__badges">
            <AdminRoleBadge role={user.role} />
            <AdminAccountStatusBadge status={user.status} reason={user.status_reason} />
          </div>
        </div>
      </header>

      <div className="admin-user-detail-page__layout">
        <main className="admin-user-detail-page__main">
          <section
            className="admin-card admin-user-detail-page__account-intelligence"
            aria-labelledby="account-activity-heading"
          >
            <h2 id="account-activity-heading">Account and activity</h2>
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
            <div className="admin-user-detail-page__field">
              <span className="admin-user-detail-page__label">Contributions</span>
              <span>{user.contributions}</span>
            </div>
            <div className="admin-user-detail-page__field">
              <span className="admin-user-detail-page__label">Pending</span>
              <span>{user.pending_count}</span>
            </div>
          </section>

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

          <section className="admin-card admin-user-detail-page__activity">
            <h2>Activity</h2>
            {isAuditLoading ? (
              <p role="status">Loading activity…</p>
            ) : auditError ? (
              <div>
                <p role="alert">We couldn&apos;t load account activity.</p>
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={() => refetchAudit()}
                >
                  Try Again
                </button>
              </div>
            ) : !auditEntries || auditEntries.length === 0 ? (
              <p>No activity recorded yet.</p>
            ) : (
              <ol className="admin-user-detail-page__timeline">
                {auditEntries.map((entry) => (
                  <li key={entry.id}>
                    <span className="admin-user-detail-page__timeline-date">
                      {formatDate(entry.created_at)}
                    </span>
                    <span>
                      {auditLogLabelFor(entry)} by {actorLabelFor(entry.actor_id, users)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </main>

        <aside className="admin-user-detail-page__side-rail" aria-label="Account operations">
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

          <section className="admin-card admin-user-detail-page__actions">
            <h2>Administrative Actions</h2>
            {onlyAdminBanner ? (
              <div className="admin-banner">
                <p>You are the only administrator.</p>
                <p>Add another Admin before removing your Admin role.</p>
              </div>
            ) : (
              <div className="admin-user-detail-page__action-buttons">
                {rowActionItems(user, authUser?.id ?? null, adminCount, isAdmin, handleAction).map(
                  (item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        item.tone === "danger"
                          ? "admin-btn admin-btn--danger"
                          : "admin-btn admin-btn--secondary"
                      }
                      onClick={item.onSelect}
                    >
                      {item.label}
                    </button>
                  )
                )}
              </div>
            )}
          </section>
        </aside>
      </div>

      {pendingAction?.kind === "role" && (
        <AdminRoleChangeDialog
          user={user}
          isBusy={settingRoleId === user.id}
          error={roleErrorId === user.id ? roleError : null}
          onConfirm={(role) => setRole({ id: user.id, role }, { onSuccess: closeDialog })}
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "flag" && (
        <AdminFlagUserDialog
          user={user}
          isBusy={settingStatusId === user.id}
          error={statusErrorId === user.id ? statusError : null}
          onConfirm={(reason) =>
            setStatus({ id: user.id, status: "flagged", reason }, { onSuccess: closeDialog })
          }
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "suspend" && (
        <AdminConfirmDialog
          title={`Suspend ${user.username ? `@${user.username}` : displayNameFor(user)}?`}
          body="This account will temporarily lose access to restricted platform actions, including submitting events. You can restore it at any time."
          confirmLabel="Suspend User"
          tone="danger"
          reasonField={{ label: "Reason (optional)", required: false }}
          isBusy={settingStatusId === user.id}
          error={statusErrorId === user.id ? statusError : null}
          onConfirm={(reason) =>
            setStatus({ id: user.id, status: "suspended", reason }, { onSuccess: closeDialog })
          }
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "ban" && (
        <AdminConfirmDialog
          title={`Ban ${user.username ? `@${user.username}` : displayNameFor(user)}?`}
          body="This user will lose access to SalsaSegura when their session next refreshes. Existing content will not automatically be deleted."
          confirmLabel="Ban User"
          tone="danger"
          reasonField={{ label: "Reason", required: true }}
          isBusy={settingStatusId === user.id}
          error={statusErrorId === user.id ? statusError : null}
          onConfirm={(reason) =>
            setStatus({ id: user.id, status: "banned", reason }, { onSuccess: closeDialog })
          }
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "restore" && (
        <AdminConfirmDialog
          title={`Restore access for ${user.username ? `@${user.username}` : displayNameFor(user)}?`}
          body="Access is restored immediately. Their role is unchanged."
          confirmLabel="Restore access"
          tone="neutral"
          isBusy={settingStatusId === user.id}
          error={statusErrorId === user.id ? statusError : null}
          onConfirm={() => setStatus({ id: user.id, status: "active" }, { onSuccess: closeDialog })}
          onCancel={closeDialog}
        />
      )}

      {pendingAction?.kind === "unflag" && (
        <AdminConfirmDialog
          title={`Remove the flag on ${user.username ? `@${user.username}` : displayNameFor(user)}?`}
          body="The account returns to Active. The flag reason is cleared."
          confirmLabel="Remove flag"
          tone="neutral"
          isBusy={settingStatusId === user.id}
          error={statusErrorId === user.id ? statusError : null}
          onConfirm={() => setStatus({ id: user.id, status: "active" }, { onSuccess: closeDialog })}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
