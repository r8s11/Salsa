import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import "./AdminConfirmDialog.css";

interface AdminConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  isBusy: boolean;
  tone?: "danger" | "neutral";
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
  isBusy,
  tone = "danger",
  initialFocus = "confirm",
  reasonField,
  error,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  const titleId = useId();
  const reasonId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const [reason, setReason] = useState("");
  const [showRequiredError, setShowRequiredError] = useState(false);

  useEscapeKey(onCancel);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    (initialFocus === "cancel" ? cancelRef : confirmRef).current?.focus();
    return () => {
      const previouslyFocused = previouslyFocusedRef.current;
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [initialFocus]);

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

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), textarea:not([disabled])"
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="admin-confirm-dialog__overlay" onClick={onCancel}>
      <div
        className="admin-confirm-dialog admin-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        onKeyDown={trapFocus}
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
            {isBusy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
