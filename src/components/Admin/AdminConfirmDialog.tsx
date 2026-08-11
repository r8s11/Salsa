import { useEffect, useId, useRef } from "react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import "./AdminConfirmDialog.css";

interface AdminConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  isBusy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AdminConfirmDialog({
  title,
  body,
  confirmLabel,
  isBusy,
  onConfirm,
  onCancel,
}: AdminConfirmDialogProps) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEscapeKey(onCancel);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

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
        <div className="admin-confirm-dialog__actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={onCancel} disabled={isBusy}>
            Cancel
          </button>
          <button
            type="button"
            ref={confirmRef}
            className="admin-btn admin-btn--danger"
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
