import { useId, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  REJECTION_REASON_LABEL,
  type RejectionReasonCode,
} from "../../features/admin/model/organizerRequestsQuery";
import { useAccessibleDialog } from "../../shared/a11y/useAccessibleDialog";
import "./AdminRejectOrganizerDialog.css";

const REJECTION_REASONS: RejectionReasonCode[] = [
  "insufficient_information",
  "unable_to_verify_organizer",
  "account_activity_concerns",
  "duplicate_organizer_brand",
  "not_currently_eligible",
  "other",
];

interface AdminRejectOrganizerDialogProps {
  open: boolean;
  isBusy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (params: {
    reason_code: RejectionReasonCode;
    reason_message?: string | null;
    internal_note?: string | null;
  }) => void;
}

export default function AdminRejectOrganizerDialog({
  open,
  isBusy,
  error,
  onCancel,
  onConfirm,
}: AdminRejectOrganizerDialogProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [reasonCode, setReasonCode] = useState<RejectionReasonCode>("insufficient_information");
  const [applicantMessage, setApplicantMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const { onKeyDown, onBackdropClick, onDialogClick } = useAccessibleDialog({
    dialogRef,
    onDismiss: onCancel,
    isBusy,
    initialFocusRef: cancelRef,
  });

  if (!open) return null;

  const handleSubmit = () => {
    onConfirm({
      reason_code: reasonCode,
      reason_message: applicantMessage.trim() || null,
      internal_note: internalNote.trim() || null,
    });
  };

  return (
    <div className="admin-reject-organizer-dialog__overlay" onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="admin-reject-organizer-dialog admin-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        onClick={onDialogClick}
      >
        <div className="admin-reject-organizer-dialog__header">
          <h2 id={titleId}>Reject Organizer Request</h2>
          <button
            type="button"
            className="admin-icon-btn"
            aria-label="Close"
            onClick={onCancel}
            disabled={isBusy}
          >
            <X size={18} />
          </button>
        </div>

        <div className="admin-reject-organizer-dialog__body">
          <p id={descId} className="admin-reject-organizer-dialog__explanation">
            Select a reason for rejection. The applicant will be notified.
          </p>

          <div className="admin-field">
            <label htmlFor="admin-reject-reason-select">Reason</label>
            <select
              id="admin-reject-reason-select"
              className="admin-select"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as RejectionReasonCode)}
              disabled={isBusy}
            >
              {REJECTION_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {REJECTION_REASON_LABEL[reason]}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="admin-reject-applicant-message">Message to Applicant (Optional)</label>
            <textarea
              id="admin-reject-applicant-message"
              className="admin-textarea"
              placeholder="This message will be shared with the applicant…"
              value={applicantMessage}
              onChange={(e) => setApplicantMessage(e.target.value)}
              disabled={isBusy}
              rows={3}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="admin-reject-internal-note">Internal Admin Note (Optional)</label>
            <textarea
              id="admin-reject-internal-note"
              className="admin-textarea"
              placeholder="Only visible to admins…"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              disabled={isBusy}
              rows={3}
            />
          </div>

          {error && (
            <p className="admin-field__error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="admin-reject-organizer-dialog__actions">
          <button
            ref={cancelRef}
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--danger"
            onClick={handleSubmit}
            disabled={isBusy}
          >
            {isBusy ? "Rejecting…" : "Reject Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
