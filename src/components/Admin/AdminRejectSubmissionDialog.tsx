import { useState } from "react";
import "./AdminRejectSubmissionDialog.css";

interface AdminRejectSubmissionDialogProps {
  submissionId: string;
  isBusy: boolean;
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
  isBusy,
  onConfirm,
  onCancel,
}: AdminRejectSubmissionDialogProps) {
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");

  const confirmDisabled = isBusy || (reason === "other" && note.trim() === "");

  return (
    <div className="admin-reject-submission-dialog__overlay" onClick={onCancel}>
      <div
        className="admin-reject-submission-dialog admin-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Reject submission ${submissionId}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Reject Submission {submissionId}?</h2>

        <div className="admin-field">
          <label htmlFor="reason">Reason for rejection *</label>
          <select
            id="reason"
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
          <button type="button" className="admin-btn admin-btn--secondary" onClick={onCancel}>
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
