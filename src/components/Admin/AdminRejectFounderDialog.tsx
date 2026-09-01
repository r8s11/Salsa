import { useState } from "react";
import "./AdminRejectFounderDialog.css";

const REASONS: { code: string; label: string }[] = [
  { code: "insufficient_information", label: "Insufficient information" },
  { code: "unable_to_verify_organizer", label: "Unable to verify organizer" },
  { code: "account_activity_concerns", label: "Account activity concerns" },
  { code: "duplicate_organizer_brand", label: "Duplicate organizer brand" },
  { code: "not_currently_eligible", label: "Not currently eligible" },
  { code: "other", label: "Other" },
] as const;
interface AdminRejectFounderDialogProps {
  requestId: string;
  isBusy: boolean;
  onConfirm: (requestId: string, reasonCode: string, message: string) => void;
  onCancel: () => void;
  isOpen: boolean;
}
export default function AdminRejectFounderDialog({
  requestId,
  isBusy,
  onConfirm,
  onCancel,
  isOpen,
}: AdminRejectFounderDialogProps) {
  const [reason, setReason] = useState<string>("insufficient_information");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");

  const confirmDisabled = isBusy || (reason === "other" && note.trim() === "");

  if (!isOpen) return null;

  return (
    <div className="admin-reject-dialog__overlay" onClick={onCancel}>
      <div
        className="admin-reject-dialog admin-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Reject founder request ${requestId}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Reject Founder Request?</h2>

        <p className="reject-message">
          This will mark the request as <strong>Rejected</strong>.
        </p>

        <div className="admin-field">
          <label htmlFor="reject-reason">Reason <span className="required" aria-hidden="true">*</span></label>
          <select
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isBusy}
            className="reason-select"
          >
            {REASONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {reason === "other" && (
          <div className="admin-field">
            <label htmlFor="reject-note">Details <span className="required" aria-hidden="true">*</span></label>
            <textarea
              id="reject-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Please explain why this request is not eligible..."
              rows={4}
              disabled={isBusy}
              className="reject-note"
              aria-describedby="reject-note-hint"
            />
            <span id="reject-note-hint" className="field-hint">
              Required when selecting "Other". Optional but encouraged for other reasons.
            </span>
          </div>
        )}

        <div className="admin-field">
          <label htmlFor="reject-message">Message to applicant (optional)</label>
          <textarea
            id="reject-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="A brief message shown to the applicant explaining the decision..."
            rows={3}
            disabled={isBusy}
            className="reject-message"
          />
        </div>

        <div className="admin-reject-dialog__actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => onConfirm(requestId, reason, message || note)}
            disabled={confirmDisabled}
          >
            {isBusy ? "Rejecting…" : "Reject Request"}
          </button>
        </div>
      </div>
    </div>
  );
}