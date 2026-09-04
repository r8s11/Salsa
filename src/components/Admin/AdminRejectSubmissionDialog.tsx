import { useId, useRef, useState } from "react";
import { useAccessibleDialog } from "../../shared/a11y/useAccessibleDialog";
import "./AdminRejectSubmissionDialog.css";

interface AdminRejectSubmissionDialogProps {
  submissionId: string;
  /** Event title, so the heading names the target instead of a UUID. */
  submissionLabel?: string | null;
  isBusy: boolean;
  error?: string | null;
  onConfirm: (reason: string, message: string, note: string) => void;
  onCancel: () => void;
}

const REASONS = [
  "duplicate",
  "missing_information",
  "invalid_venue",
  "cannot_verify",
  "spam",
  "inappropriate",
  "out_of_scope",
  "other",
] as const;

export default function AdminRejectSubmissionDialog({
  submissionId,
  submissionLabel,
  isBusy,
  error,
  onConfirm,
  onCancel,
}: AdminRejectSubmissionDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const reasonRef = useRef<HTMLSelectElement>(null);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");

  const { onKeyDown, onBackdropClick, onDialogClick } = useAccessibleDialog({
    dialogRef,
    onDismiss: onCancel,
    isBusy,
    initialFocusRef: reasonRef,
  });

  const confirmDisabled = isBusy || (reason === "other" && note.trim() === "");

  return (
    <div className="admin-reject-submission-dialog__overlay" onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="admin-reject-submission-dialog admin-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={onDialogClick}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId}>
          {submissionLabel ? `Reject “${submissionLabel}”?` : `Reject Submission ${submissionId}?`}
        </h2>

        {error && (
          <div className="admin-banner admin-banner--error" role="alert">
            {error}
          </div>
        )}

        <div className="admin-field">
          <label htmlFor="reason">Reason for rejection *</label>
          <select
            id="reason"
            ref={reasonRef}
            className="admin-select"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field">
          <label htmlFor="message">Message to submitter</label>
          <textarea
            id="message"
            className="admin-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="admin-reject-submission-dialog__hint">Shared with the submitter.</p>
        </div>

        <div className="admin-field">
          <label htmlFor="note">Internal moderator note</label>
          <textarea
            id="note"
            className="admin-textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="admin-reject-submission-dialog__hint">
            Only visible to moderators and admins.
          </p>
        </div>

        <div className="admin-reject-submission-dialog__actions">
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            disabled={isBusy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--danger"
            disabled={confirmDisabled}
            onClick={() => onConfirm(reason, message, note)}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
