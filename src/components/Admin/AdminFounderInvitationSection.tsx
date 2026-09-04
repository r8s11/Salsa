import { useState } from "react";
import AdminConfirmDialog from "./AdminConfirmDialog";
import { useFounderInvitation } from "../../hooks/useFounderInvitation";
import {
  deriveInvitationDisplayStatus,
  deriveEmailDisplayStatus,
  canCreateFounderInvitation,
  canReissueFounderInvitation,
  canRevokeFounderInvitation,
  founderInvitationAcceptUrl,
  FOUNDER_INVITATION_DISPLAY_LABEL,
  FOUNDER_INVITATION_EMAIL_DISPLAY_LABEL,
} from "../../features/admin/model/founderInvitationQuery";

export default function AdminFounderInvitationSection({
  founderRequestId,
  isAdmin,
}: {
  founderRequestId: string;
  isAdmin: boolean;
}) {

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
    reissueInvitation,
    isReissuing,
    reissueError,
    reissuedInvitation,
    resetReissueResult,
    invitationHistory,
    deliveryAttemptsByInvitation,
    isHistoryLoading,
    historyError,
  } = useFounderInvitation(founderRequestId);
  const [copied, setCopied] = useState(false);
  const [reissueIdempotencyKey, setReissueIdempotencyKey] = useState<string | null>(null);

  const displayStatus = deriveInvitationDisplayStatus(invitation);
  const emailDisplayStatus = deriveEmailDisplayStatus(invitation);
  const canIssue = canCreateFounderInvitation(displayStatus);

  const handleSend = () => {
    resetCreatedInvitation();
    setCopied(false);
    sendInvitation(crypto.randomUUID());
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

  const handleOpenReissue = () => {
    resetReissueResult();
    setReissueIdempotencyKey(crypto.randomUUID());
  };

  const handleCloseReissue = () => {
    if (!isReissuing) setReissueIdempotencyKey(null);
  };

  const handleConfirmReissue = () => {
    if (!reissueIdempotencyKey) return;
    reissueInvitation(reissueIdempotencyKey, {
      onSuccess: () => setReissueIdempotencyKey(null),
    });
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
          {invitation && canReissueFounderInvitation(displayStatus) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleOpenReissue}
              disabled={isReissuing || isSending || isCreating}
            >
              Reissue Fresh Invitation
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
      {reissueError && !reissueIdempotencyKey && (
        <p className="invitation-error" role="alert">
          {reissueError instanceof Error ? reissueError.message : "Unable to reissue the invitation."}
        </p>
      )}

      {(sentInvitation || reissuedInvitation) && (
        <p className="invitation-success" role="status">
          {(sentInvitation ?? reissuedInvitation)?.deliveryStatus === "attempting"
            ? "Invitation delivery is already in progress."
            : `Invitation email sent to ${(sentInvitation ?? reissuedInvitation)?.email}.`}
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

      <section className="invitation-history" aria-labelledby="invitation-history-heading">
        <h3 id="invitation-history-heading">Invitation and email history</h3>
        {isHistoryLoading && <p role="status">Loading history…</p>}
        {historyError && (
          <p className="invitation-error" role="alert">
            Unable to load invitation history.
          </p>
        )}
        {!isHistoryLoading && !historyError && invitationHistory.length === 0 && (
          <p className="empty">No invitation history yet.</p>
        )}
        {invitationHistory.map((historyInvitation) => (
          <article className="invitation-history__item" key={historyInvitation.id}>
            <div className="invitation-history__heading">
              <strong>{FOUNDER_INVITATION_DISPLAY_LABEL[deriveInvitationDisplayStatus(historyInvitation)]}</strong>
              <span>{new Date(historyInvitation.created_at).toLocaleString()}</span>
            </div>
            {(deliveryAttemptsByInvitation[historyInvitation.id] ?? []).map((attempt) => (
              <div className="invitation-history__attempt" key={attempt.id}>
                <span>{FOUNDER_INVITATION_EMAIL_DISPLAY_LABEL[attempt.status]}</span>
                <span>Attempt {attempt.attempt_number}</span>
                <span>{new Date(attempt.attempted_at).toLocaleString()}</span>
                {attempt.error_code && <span>Error: {attempt.error_code.replace(/_/g, " ")}</span>}
              </div>
            ))}
          </article>
        ))}
      </section>

      {reissueIdempotencyKey && (
        <AdminConfirmDialog
          title="Reissue a fresh Founder invitation?"
          body="This invalidates the current invitation and sends a new single-use credential. The old email link will stop working."
          confirmLabel="Reissue Fresh Invitation"
          busyLabel="Reissuing…"
          isBusy={isReissuing}
          tone="danger"
          error={reissueError instanceof Error ? reissueError.message : null}
          onConfirm={handleConfirmReissue}
          onCancel={handleCloseReissue}
        />
      )}
    </section>
  );
}
