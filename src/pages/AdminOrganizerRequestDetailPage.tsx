import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useOrganizerRequests,
  useOrganizerRequest,
} from "../features/admin/hooks/useOrganizerRequests";
import { useAdminEvents } from "../hooks/useAdminEvents";
import { applyFilters, type EventFilters } from "../features/admin/model/eventsQuery";
import {
  displayNameFor,
  identityLineFor,
  ROLE_LABEL,
  type AdminUserRow,
} from "../features/admin/model/usersQuery";
import {
  ORGANIZER_TYPE_LABEL,
  REJECTION_REASON_LABEL,
  requestActionItems,
  type OrganizerRequestRow,
  type RejectionReasonCode,
  type RequestStatus,
  type RequestRowAction,
} from "../features/admin/model/organizerRequestsQuery";
import AdminUserAvatar from "../components/Admin/AdminUserAvatar";
import AdminRoleBadge from "../components/Admin/AdminRoleBadge";
import AdminAccountStatusBadge from "../components/Admin/AdminAccountStatusBadge";
import AdminRequestStatusBadge from "../components/Admin/AdminRequestStatusBadge";
import AdminStatusBadge from "../components/Admin/AdminStatusBadge";
import AdminActionMenu from "../components/Admin/AdminActionMenu";
import AdminConfirmDialog from "../components/Admin/AdminConfirmDialog";
import AdminRejectOrganizerDialog from "../components/Admin/AdminRejectOrganizerDialog";
import type { ActionMenuItem } from "../components/Admin/AdminActionMenu";
import "./AdminOrganizerRequestDetailPage.css";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function applicantRow(request: OrganizerRequestRow): AdminUserRow {
  return {
    kind: request.applicant_kind,
    id: request.applicant_id,
    user_id: request.applicant_user_id,
    email: request.applicant_email,
    display_name: request.applicant_display_name,
    username: request.applicant_username,
    avatar_url: request.applicant_avatar_url,
    role: request.applicant_role,
    status: request.applicant_status,
    status_reason: request.applicant_status_reason,
    created_at: request.applicant_created_at,
    last_active_at: "",
    contributions: request.applicant_contributions,
    pending_count: request.applicant_pending_count,
    email_confirmed_at: request.applicant_email_confirmed_at ?? null,
    approved_count: request.applicant_approved_count,
  };
}

type PendingAction = { kind: "approve" } | { kind: "reject" } | { kind: "revoke" } | null;

export default function AdminOrganizerRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { request, isLoading, error, refetch } = useOrganizerRequest(id ?? null);
  const {
    requests: directoryRequests,
    approve,
    isApproving,
    approveError,
    reject,
    isRejecting,
    rejectError,
    revoke,
    isRevoking,
    revokeError,
  } = useOrganizerRequests();
  const { events: queriedEvents } = useAdminEvents();
  const events = useMemo(() => queriedEvents ?? [], [queriedEvents]);

  // If the single-request query didn't fire (page opened directly via URL),
  // fall back to the directory result (already in cache if the admin came
  // from the queue page) — Phase 5/6 do the same "find in cache, else fetch".
  const resolvedRequest = useMemo(() => {
    if (request) return request;
    if (!directoryRequests) return null;
    return directoryRequests.find((candidate) => candidate.id === id) ?? null;
  }, [request, directoryRequests, id]);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [internalNote, setInternalNote] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const closeDialog = () => setPendingAction(null);

  const handleRowAction = (action: RequestRowAction, target: OrganizerRequestRow) => {
    if (action === "view") {
      navigate(`/admin/organizer-requests/${target.id}`);
    } else if (action === "approve") {
      setPendingAction({ kind: "approve" });
    } else if (action === "reject") {
      setPendingAction({ kind: "reject" });
    } else if (action === "revoke") {
      setPendingAction({ kind: "revoke" });
    }
  };

  const handleRejectConfirm = (params: {
    reason_code: RejectionReasonCode;
    reason_message?: string | null;
    internal_note?: string | null;
  }) => {
    if (!resolvedRequest) return;
    reject({
      id: resolvedRequest.id,
      reason_code: params.reason_code,
      reason_message: params.reason_message,
      internal_note: params.internal_note,
    });
    setPendingAction(null);
    setInternalNote("");
    setAnnouncement("Organizer request rejected.");
  };

  // --- Derived data for the review sections ---

  const applicant = resolvedRequest ? applicantRow(resolvedRequest) : null;

  // Events & Contributions: same submitter filter Phase 6 uses, applied to
  // the already-cached useAdminEvents() result.
  const applicantEvents = useMemo(() => {
    if (!resolvedRequest || !events.length) return [];
    const submitterValue = resolvedRequest.applicant_user_id ?? resolvedRequest.applicant_email;
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
  }, [resolvedRequest, events]);

  const approvedCount = useMemo(
    () => applicantEvents.filter((e) => e.status === "approved").length,
    [applicantEvents]
  );
  const pendingCount = useMemo(
    () => applicantEvents.filter((e) => e.status === "pending").length,
    [applicantEvents]
  );
  const rejectedCount = useMemo(
    () => applicantEvents.filter((e) => e.status === "rejected").length,
    [applicantEvents]
  );

  const requestHistory = useMemo(() => {
    if (!resolvedRequest || !directoryRequests) return [];
    return directoryRequests
      .filter(
        (r) =>
          r.id !== resolvedRequest.id &&
          (r.applicant_user_id === resolvedRequest.applicant_user_id ||
            r.applicant_email === resolvedRequest.applicant_email)
      )
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, 8);
  }, [resolvedRequest, directoryRequests]);

  const isDecisionBusy = isApproving || isRejecting || isRevoking;

  // --- Loading / error / not-found states ---

  const isFullyLoaded = !isLoading && !error && !!resolvedRequest;

  if (isLoading && !resolvedRequest) {
    return (
      <div className="admin-organizer-request-detail-page__loading" aria-busy="true">
        <p role="status">Loading organizer request…</p>
      </div>
    );
  }

  if (!isLoading && error) {
    return (
      <div className="admin-banner admin-banner--error" role="alert">
        <p>We couldn&apos;t load this organizer request.</p>
        <button type="button" className="admin-btn admin-btn--secondary" onClick={() => refetch()}>
          Try Again
        </button>
      </div>
    );
  }

  if (!isFullyLoaded) {
    return (
      <div className="admin-organizer-request-detail-page__empty">
        <h2>Organizer request not found</h2>
        <p>The request may have been deleted or the link is incorrect.</p>
        <Link to="/admin/organizer-requests" className="admin-btn admin-btn--secondary">
          Organizer Requests
        </Link>
      </div>
    );
  }

  const req = resolvedRequest!;
  const isPending = req.status === "pending";
  const isApproved = req.status === "approved";
  const isRejected = req.status === "rejected";
  const applicantStatus = req.applicant_status;
  const hasModerationConcern = applicantStatus !== "active";
  const isExistingBrand = req.proposed_organizer_id !== null;

  return (
    <div className="admin-organizer-request-detail-page">
      <p role="status" className="admin-visually-hidden">
        {announcement}
      </p>

      <Link to="/admin/organizer-requests" className="admin-organizer-request-detail-page__back">
        ← Organizer Requests
      </Link>

      <header className="admin-organizer-request-detail-page__header">
        <AdminUserAvatar row={applicant!} size={64} />
        <div className="admin-organizer-request-detail-page__header-body">
          <h1>{displayNameFor(applicant!)}</h1>
          <p className="admin-organizer-request-detail-page__identity">
            {identityLineFor(applicant!)}
          </p>
          <div className="admin-organizer-request-detail-page__badges">
            <AdminRoleBadge role={applicant!.role} />
            <AdminAccountStatusBadge status={applicant!.status} reason={applicant!.status_reason} />
            <AdminRequestStatusBadge status={req.status} />
          </div>
          <p className="admin-organizer-request-detail-page__joined">
            {applicant!.kind === "guest" ? "First activity" : "Joined"}{" "}
            {formatDate(applicant!.created_at)}
          </p>
          {hasModerationConcern && (
            <p className="admin-organizer-request-detail-page__moderation-banner">
              ⚠ This account is currently {applicantStatus}.
            </p>
          )}
        </div>
        <div className="admin-organizer-request-detail-page__header-menu">
          <AdminActionMenu
            label={`Actions for ${displayNameFor(applicant!)}`}
            items={requestActionItems(req, handleRowAction)}
          />
        </div>
      </header>

      <div className="admin-organizer-request-detail-page__body">
        {/* Applicant Identity */}
        <section className="admin-card admin-organizer-request-detail-page__overview">
          <h2>Applicant Identity</h2>
          <div className="admin-organizer-request-detail-page__field">
            <span className="admin-organizer-request-detail-page__label">Email</span>
            <span>
              {applicant!.email}{" "}
              <span className="admin-chip">
                {applicant!.email_confirmed_at ? "Verified" : "Unverified"}
              </span>
            </span>
          </div>
          <div className="admin-organizer-request-detail-page__field">
            <span className="admin-organizer-request-detail-page__label">Identity</span>
            <span>{identityLineFor(applicant!)}</span>
          </div>
          <div className="admin-organizer-request-detail-page__field">
            <span className="admin-organizer-request-detail-page__label">Account Type</span>
            <span>
              {applicant!.kind === "profile" ? "Registered User" : "Magic-Link Submitter"}
            </span>
          </div>
          <div className="admin-organizer-request-detail-page__field">
            <span className="admin-organizer-request-detail-page__label">Role</span>
            <span>{applicant!.role ? ROLE_LABEL[applicant!.role] : ROLE_LABEL.user}</span>
          </div>
        </section>

        {/* Organizer / Brand */}
        <section className="admin-card admin-organizer-request-detail-page__brand">
          <h2>Organizer / Brand</h2>
          {isExistingBrand && (
            <p className="admin-organizer-request-detail-page__existing-alert">
              This brand already exists ·{" "}
              <a
                href={`/admin/organizers/${req.proposed_organizer_id}`}
                onClick={(e) => e.preventDefault()}
                aria-label="View existing organizer (not yet built)"
              >
                View existing organizer →
              </a>
            </p>
          )}
          <div className="admin-organizer-request-detail-page__field">
            <span className="admin-organizer-request-detail-page__label">Brand Name</span>
            <span>{req.proposed_name || "No brand name provided"}</span>
          </div>
          <div className="admin-organizer-request-detail-page__field">
            <span className="admin-organizer-request-detail-page__label">Type</span>
            <span>
              {req.organizer_type ? ORGANIZER_TYPE_LABEL[req.organizer_type] : "Not specified"}
            </span>
          </div>
          <div className="admin-organizer-request-detail-page__field">
            <span className="admin-organizer-request-detail-page__label">Primary Area</span>
            <span>{req.primary_city || "Not specified"}</span>
          </div>
          {req.instagram && (
            <div className="admin-organizer-request-detail-page__field">
              <span className="admin-organizer-request-detail-page__label">Instagram</span>
              <span>
                <a
                  href={`https://instagram.com/${req.instagram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View ${req.proposed_name ?? "brand"} on Instagram (opens in new window)`}
                >
                  @{req.instagram.replace(/^@/, "")} ↗
                </a>
              </span>
            </div>
          )}
          {req.website && (
            <div className="admin-organizer-request-detail-page__field">
              <span className="admin-organizer-request-detail-page__label">Website</span>
              <span>
                <a
                  href={req.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View ${req.proposed_name ?? "brand"} website (opens in new window)`}
                >
                  {req.website} ↗
                </a>
              </span>
            </div>
          )}
          {req.description && (
            <div className="admin-organizer-request-detail-page__field">
              <span className="admin-organizer-request-detail-page__label">Description</span>
              <span>{req.description}</span>
            </div>
          )}
        </section>

        {/* Platform History */}
        <section className="admin-card admin-organizer-request-detail-page__summary">
          <h2>Platform History</h2>
          <div className="admin-organizer-request-detail-page__field">
            <span className="admin-organizer-request-detail-page__label">Member Since</span>
            <span>{formatDate(applicant!.created_at)}</span>
          </div>
          <div className="admin-organizer-request-detail-page__field">
            <span className="admin-organizer-request-detail-page__label">Events Submitted</span>
            <span>
              {applicant!.contributions} submission{applicant!.contributions === 1 ? "" : "s"}
            </span>
          </div>
          <div className="admin-organizer-request-detail-page__field">
            <span className="admin-organizer-request-detail-page__label">Approved</span>
            <span>{approvedCount}</span>
          </div>
          <div className="admin-organizer-request-detail-page__field">
            <span className="admin-organizer-request-detail-page__label">Pending</span>
            <span>{pendingCount}</span>
          </div>
          <div className="admin-organizer-request-detail-page__field">
            <span className="admin-organizer-request-detail-page__label">Rejected</span>
            <span>{rejectedCount}</span>
          </div>
          <div className="admin-organizer-request-detail-page__field">
            <span className="admin-organizer-request-detail-page__label">Open Flags</span>
            <span>0</span>
          </div>
        </section>

        {/* Previous Events */}
        <section className="admin-card admin-organizer-request-detail-page__events">
          <h2>Previous Events</h2>
          {applicantEvents.length === 0 ? (
            <p>No events submitted yet.</p>
          ) : (
            <ul className="admin-organizer-request-detail-page__events-list">
              {applicantEvents.map((event) => (
                <li key={event.id}>
                  <Link to={`/admin/events?edit=${event.id}`}>{event.title}</Link>
                  <AdminStatusBadge status={event.status} />
                </li>
              ))}
            </ul>
          )}
          <Link
            to={`/admin/events?submitter=${encodeURIComponent(applicant!.user_id ?? applicant!.email)}`}
          >
            View all in Events →
          </Link>
        </section>

        {/* Moderation Context */}
        <section className="admin-card admin-organizer-request-detail-page__moderation">
          <h2>Moderation Context</h2>
          {!hasModerationConcern ? (
            <p>No current moderation concerns.</p>
          ) : (
            <div>
              <p>⚠ This account is currently {applicantStatus}.</p>
              {applicant!.status_reason && (
                <p className="admin-organizer-request-detail-page__muted">
                  Reason: {applicant!.status_reason}
                </p>
              )}
              <Link to={`/admin/users/${applicant!.id}`}>View account moderation history →</Link>
            </div>
          )}
        </section>

        {/* Request Message */}
        <section className="admin-card admin-organizer-request-detail-page__message">
          <h2>Request Message</h2>
          {req.request_message ? (
            <blockquote className="admin-organizer-request-detail-page__blockquote">
              {req.request_message}
            </blockquote>
          ) : (
            <p className="admin-organizer-request-detail-page__muted">
              The applicant did not provide a message.
            </p>
          )}
        </section>

        {/* Request History — only when the applicant has prior requests */}
        {requestHistory.length > 0 && (
          <section className="admin-card admin-organizer-request-detail-page__history">
            <h2>Request History</h2>
            <table className="admin-organizer-request-detail-page__history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Brand</th>
                  <th>Status</th>
                  <th>Reviewed By</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {requestHistory.map((prior) => (
                  <tr key={prior.id}>
                    <td>{formatShortDate(prior.created_at)}</td>
                    <td>{prior.proposed_name || "—"}</td>
                    <td>
                      <AdminRequestStatusBadge status={prior.status} />
                    </td>
                    <td>{prior.reviewed_by ? `@${prior.reviewed_by}` : "—"}</td>
                    <td>
                      {prior.rejection_reason_code
                        ? REJECTION_REASON_LABEL[
                            prior.rejection_reason_code as RejectionReasonCode
                          ] || prior.rejection_reason_code
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>

      {/* Sticky Decision Panel — always rendered so focus management is stable */}
      <aside className="admin-organizer-request-detail-page__decision-panel" aria-label="Decision">
        <div className="admin-organizer-request-detail-page__decision-panel__card admin-card">
          <h3>Request Status</h3>
          <AdminRequestStatusBadge status={req.status} />

          <h3>Applicant Summary</h3>
          <p className="admin-organizer-request-detail-page__muted">
            {displayNameFor(applicant!)} · {identityLineFor(applicant!)}
          </p>

          <h3>Account Status</h3>
          <AdminAccountStatusBadge status={applicant!.status} reason={applicant!.status_reason} />
          {hasModerationConcern && (
            <p className="admin-organizer-request-detail-page__moderation-banner">
              ⚠ {applicantStatus}
            </p>
          )}

          <h3>Internal Notes</h3>
          <textarea
            className="admin-textarea"
            placeholder="Internal note visible only to admins…"
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            disabled={isDecisionBusy}
            rows={3}
          />

          <div className="admin-organizer-request-detail-page__decision-panel__actions">
            {isRejected && (
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => navigate(0)}
              >
                Re-review
              </button>
            )}
            {isPending && (
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => setPendingAction({ kind: "reject" })}
                disabled={isDecisionBusy}
              >
                {isDecisionBusy ? "Working…" : "Reject"}
              </button>
            )}
            {isPending && (
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => setPendingAction({ kind: "approve" })}
                disabled={isDecisionBusy}
              >
                {isDecisionBusy ? "Working…" : "Approve Organizer"}
              </button>
            )}
            {isApproved && (
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => setPendingAction({ kind: "revoke" })}
                disabled={isDecisionBusy}
              >
                Revoke Access
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* --- Approval confirmation dialog --- */}
      {pendingAction?.kind === "approve" && (
        <AdminConfirmDialog
          title={`Approve organizer access for ${applicant!.username ? `@${applicant!.username}` : displayNameFor(applicant!)}?`}
          body="This person will be able to create and publish their own events, edit and cancel them, and manage an organizer brand. They will NOT receive Moderator or Admin permissions."
          confirmLabel="Approve Organizer"
          isBusy={isApproving}
          tone="neutral"
          error={approveError}
          reasonField={{
            label: "Internal note (optional)",
            placeholder: "Visible only to other admins…",
          }}
          onConfirm={(reason) => {
            if (!resolvedRequest) return;
            approve({
              id: resolvedRequest.id,
              internal_note: reason ?? null,
            });
            setPendingAction(null);
            setInternalNote("");
            setAnnouncement("Organizer access granted.");
          }}
          onCancel={closeDialog}
        />
      )}

      {/* --- Rejection dialog (full form) --- */}
      {pendingAction?.kind === "reject" && (
        <AdminRejectOrganizerDialog
          open
          isBusy={isRejecting}
          error={rejectError}
          onCancel={closeDialog}
          onConfirm={handleRejectConfirm}
        />
      )}

      {/* --- Revoke dialog --- */}
      {pendingAction?.kind === "revoke" && (
        <AdminConfirmDialog
          title={`Remove organizer access from ${applicant!.username ? `@${applicant!.username}` : displayNameFor(applicant!)}?`}
          body="This will remove their ability to manage the organizer brand. Past events will not be deleted."
          confirmLabel="Revoke Access"
          isBusy={isRevoking}
          tone="danger"
          error={revokeError}
          reasonField={{
            label: "Internal note (optional)",
            placeholder: "Reason for revocation…",
          }}
          onConfirm={(reason) => {
            if (!resolvedRequest) return;
            revoke({
              organizer_id: resolvedRequest.proposed_organizer_id ?? "",
              reason: reason ?? null,
            });
            setPendingAction(null);
            setInternalNote("");
            setAnnouncement("Organizer access revoked.");
          }}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}

// Re-export for the page's type usage.
export type { RequestStatus, RequestRowAction, ActionMenuItem };
