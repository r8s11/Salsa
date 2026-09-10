import { useId, useRef, useState } from "react";
import { useAccessibleDialog } from "../../shared/a11y/useAccessibleDialog";
import "./AdminConfirmDialog.css";

interface AdminConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  /** Confirm label while the mutation runs, e.g. "Deleting…". */
  busyLabel?: string;
  isBusy: boolean;
  tone?: "danger" | "neutral";
  /**
   * Danger confirmations always start on Cancel: a dangerous action must never
   * be one stray Enter away. Neutral confirmations default to Confirm and
   * honour an explicit override.
   */
  initialFocus?: "cancel" | "confirm";
  reasonField?: { label: string; placeholder?: string; required?: boolean };
  error?: string | null;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

export default function AdminConfirmDialog({
  title,
  body,
  confirmLabel,
  busyLabel = "Working…",
  isBusy,
  tone = "danger",
  initialFocus,
  reasonField,
  error,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const reasonId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState("");
  const [showRequiredError, setShowRequiredError] = useState(false);

  const focusesConfirm = tone === "danger" ? false : initialFocus !== "cancel";
  const { onKeyDown, onBackdropClick, onDialogClick } = useAccessibleDialog({
    dialogRef,
    onDismiss: onCancel,
    isBusy,
    initialFocusRef: focusesConfirm ? confirmRef : cancelRef,
  });

  const handleConfirm = () => {
    if (!reasonField) {
      onConfirm();
      return;
    }
    const trimmed = reason.trim();
    if (reasonField.required && trimmed === "") {
      setShowRequiredError(true);
      textareaRef.current?.focus();
      return;
    }
    setShowRequiredError(false);
    onConfirm(trimmed === "" ? undefined : trimmed);
  };

  return (
    <div className="admin-confirm-dialog__overlay" onClick={onBackdropClick}>
      <div
        className="admin-confirm-dialog admin-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        ref={dialogRef}
        onKeyDown={onKeyDown}
        onClick={onDialogClick}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={bodyId}>{body}</p>
        {reasonField && (
          <div className="admin-field">
            <label htmlFor={reasonId}>{reasonField.label}</label>
            <textarea
              id={reasonId}
              ref={textareaRef}
              className="admin-textarea"
              placeholder={reasonField.placeholder}
              required={reasonField.required}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            {reasonField.required && showRequiredError && (
              <p className="admin-field__error" role="alert">
                A reason is required.
              </p>
            )}
          </div>
        )}
        {error && (
          <p className="admin-field__error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-confirm-dialog__actions">
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            ref={cancelRef}
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={
              tone === "danger" ? "admin-btn admin-btn--danger" : "admin-btn admin-btn--primary"
            }
            onClick={handleConfirm}
            disabled={isBusy}
          >
            {isBusy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
