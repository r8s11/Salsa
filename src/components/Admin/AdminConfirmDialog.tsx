import { useEffect, useId, useRef, useState } from "react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import "./AdminConfirmDialog.css";

interface AdminConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  isBusy: boolean;
  tone?: "danger" | "neutral";
  reasonField?: { label: string; placeholder?: string; required?: boolean };
  error?: string | null;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

export default function AdminConfirmDialog({
  title,
  body,
  confirmLabel,
  isBusy,
  tone = "danger",
  reasonField,
  error,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  const titleId = useId();
  const reasonId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const [reason, setReason] = useState("");
  const [showRequiredError, setShowRequiredError] = useState(false);

  useEscapeKey(onCancel);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    confirmRef.current?.focus();
    return () => {
      const previouslyFocused = previouslyFocusedRef.current;
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, []);

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
    <div className="admin-confirm-dialog__overlay" onClick={onCancel}>
      <div
        className="admin-confirm-dialog admin-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        <p>{body}</p>
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
            {isBusy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
