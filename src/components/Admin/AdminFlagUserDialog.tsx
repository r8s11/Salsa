import { useEffect, useId, useRef, useState } from "react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import { displayNameFor, type AdminUserRow } from "../../features/admin/model/usersQuery";
import "./AdminFlagUserDialog.css";

interface AdminFlagUserDialogProps {
  user: AdminUserRow;
  isBusy: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

const REASONS = [
  "Spam",
  "Suspicious organizer activity",
  "Repeated inaccurate submissions",
  "Harassment",
  "Other",
];

export default function AdminFlagUserDialog({
  user,
  isBusy,
  error,
  onConfirm,
  onCancel,
}: AdminFlagUserDialogProps) {
  const titleId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState("");

  useEscapeKey(onCancel);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    selectRef.current?.focus();
    return () => {
      const previouslyFocused = previouslyFocusedRef.current;
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, []);

  const notesRequired = reason === "Other";
  const confirmDisabled = isBusy || (notesRequired && notes.trim() === "");

  const handleConfirm = () => {
    const trimmedNotes = notes.trim();
    onConfirm(trimmedNotes ? `${reason} — ${trimmedNotes}` : reason);
  };

  return (
    <div className="admin-flag-user-dialog__overlay" onClick={onCancel}>
      <div
        className="admin-flag-user-dialog admin-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>
          Flag {user.username ? `@${user.username}` : displayNameFor(user)} for review?
        </h2>
        <p>Flagging is an internal review state. It does not restrict the account.</p>

        <div className="admin-field">
          <label htmlFor="admin-flag-reason">Reason</label>
          <select
            id="admin-flag-reason"
            ref={selectRef}
            className="admin-select"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            {REASONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field">
          <label htmlFor="admin-flag-notes">
            {notesRequired ? "Notes (required)" : "Notes (optional)"}
          </label>
          <textarea
            id="admin-flag-notes"
            className="admin-textarea"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {error && (
          <p className="admin-field__error" role="alert">
            {error}
          </p>
        )}

        <div className="admin-flag-user-dialog__actions">
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {isBusy ? "Working…" : "Flag account"}
          </button>
        </div>
      </div>
    </div>
  );
}
