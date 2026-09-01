import { useState } from "react";
import { useFounderInvitation } from "../../hooks/useFounderInvitation";
import {
  deriveInvitationDisplayStatus,
  deriveEmailDisplayStatus,
  canCreateFounderInvitation,
  canRevokeFounderInvitation,
  founderInvitationAcceptUrl,
  FOUNDER_INVITATION_DISPLAY_LABEL,
  FOUNDER_INVITATION_EMAIL_DISPLAY_LABEL,
} from "../../features/admin/model/founderInvitationQuery";

interface AdminFounderInvitationSectionProps {
  founderRequestId: string;
  isAdmin: boolean;
}

/**
 * Invitation status + email-delivery status + send/revoke controls for an
 * approved founder request. Only rendered by the parent detail page when
 * the request's status is "approved" (spec §4/§25).
 *
 * Invitation lifecycle (none/pending/expired/revoked/accepted) and email
 * lifecycle (not sent/sent/failed) are shown as two separate lines,
 * deliberately never merged into one status (spec §8/§20).
 *
 * The plaintext token from a Phase 4 no-email creation is shown exactly
 * once, in local component state only — it is never persisted, never
 * re-fetchable, and disappears on navigation/reload because the database
 * never stores it (spec §12/§26). The primary production action is
 * "Send Founder Invitation", which creates the invitation and emails it
 * server-side in one step — the admin never sees the token for that path.
 */
export default function AdminFounderInvitationSection({
  founderRequestId,
  isAdmin,
}: AdminFounderInvitationSectionProps) {
  const {
    invitation,
    isLoading,
    createInvitation,
    isCreating,
    createError,
    createdInvitation,
    resetCreatedInvitation,
    revokeInvitation,
    isRevoking,
    revokeError,
    sendInvitation,
    isSending,
    sendError,
    sentInvitation,
  } = useFounderInvitation(founderRequestId);
  const [copied, setCopied] = useState(false);

  const displayStatus = deriveInvitationDisplayStatus(invitation);
  const emailDisplayStatus = deriveEmailDisplayStatus(invitation);
  const canIssue = canCreateFounderInvitation(displayStatus);

  const handleSend = () => {
    resetCreatedInvitation();
    setCopied(false);
    sendInvitation();
  };

  const handleCreateWithoutEmail = () => {
    resetCreatedInvitation();
    setCopied(false);
    createInvitation();
  };

  const handleRevoke = () => {
    if (!invitation) return;
    revokeInvitation(invitation.id);
  };

  const handleCopy = async () => {
    if (!createdInvitation) return;
    const url = `${window.location.origin}${founderInvitationAcceptUrl(createdInvitation.token)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="detail-section invitation-section">
      <h2>Invitation</h2>

      {isLoading ? (
        <p className="empty">Loading invitation status…</p>
      ) : (
        <>
          <div className="invitation-status-row">
            <span className="invitation-display-status">
              {FOUNDER_INVITATION_DISPLAY_LABEL[displayStatus]}
            </span>
            {invitation && displayStatus === "pending" && (
              <span className="invitation-meta">
                Expires {new Date(invitation.expires_at).toLocaleString()}
              </span>
            )}
            {invitation && displayStatus === "revoked" && invitation.revoked_at && (
              <span className="invitation-meta">
                {invitation.revoked_by ? "Revoked" : "Superseded"} {new Date(invitation.revoked_at).toLocaleString()}
              </span>
            )}
            {invitation && displayStatus === "accepted" && invitation.accepted_at && (
              <span className="invitation-meta">
                Accepted {new Date(invitation.accepted_at).toLocaleString()}
              </span>
            )}
          </div>

          <div className="invitation-status-row">
            <span className={`invitation-email-status invitation-email-status--${emailDisplayStatus}`}>
              {FOUNDER_INVITATION_EMAIL_DISPLAY_LABEL[emailDisplayStatus]}
            </span>
            {invitation?.latest_delivery_attempted_at && (
              <span className="invitation-meta">
                {new Date(invitation.latest_delivery_attempted_at).toLocaleString()}
              </span>
            )}
          </div>
        </>
      )}

      {isAdmin && !isLoading && (
        <div className="invitation-actions">
          {canIssue && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleSend}
              disabled={isSending || isCreating}
            >
              {isSending ? "Sending…" : "Send Founder Invitation"}
            </button>
          )}
          {invitation && canRevokeFounderInvitation(displayStatus) && (
            <button
              type="button"
              className="btn-danger"
              onClick={handleRevoke}
              disabled={isRevoking}
            >
              {isRevoking ? "Revoking…" : "Revoke Invitation"}
            </button>
          )}
        </div>
      )}

      {isAdmin && canIssue && import.meta.env.DEV && (
        <button
          type="button"
          className="invitation-dev-link"
          onClick={handleCreateWithoutEmail}
          disabled={isCreating || isSending}
        >
          {isCreating ? "Creating…" : "Dev only: create invitation without sending email"}
        </button>
      )}

      {sendError && (
        <p className="invitation-error" role="alert">
          {sendError instanceof Error ? sendError.message : "Unable to send the invitation email."}
        </p>
      )}
      {createError && (
        <p className="invitation-error" role="alert">
          {createError instanceof Error ? createError.message : "Unable to create invitation."}
        </p>
      )}
      {revokeError && (
        <p className="invitation-error" role="alert">
          {revokeError instanceof Error ? revokeError.message : "Unable to revoke invitation."}
        </p>
      )}

      {sentInvitation && (
        <p className="invitation-success" role="status">
          Invitation email sent to {sentInvitation.email}.
        </p>
      )}

      {createdInvitation && (
        <div className="invitation-token-reveal">
          <p>
            <strong>Copy this link now</strong> — it will not be shown again. The database only
            stores a hash of the token, so it cannot be recovered after you leave this page. No
            email was sent for this link.
          </p>
          <div className="invitation-link-row">
            <code>{`${window.location.origin}${founderInvitationAcceptUrl(createdInvitation.token)}`}</code>
            <button type="button" className="btn-secondary" onClick={handleCopy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
