import { useId, useRef } from "react";
import { useAccessibleDialog } from "../../../shared/a11y/useAccessibleDialog";
import "./AdminApproveDialog.css";

interface AdminApproveDialogProps {
  requestId: string;
  isBusy: boolean;
  onConfirm: (requestId: string) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export default function AdminApproveDialog({
  requestId,
  isBusy,
  onConfirm,
  onCancel,
  isOpen,
}: AdminApproveDialogProps) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const { onKeyDown, onBackdropClick, onDialogClick } = useAccessibleDialog({
    dialogRef,
    onDismiss: onCancel,
    isBusy,
    initialFocusRef: confirmRef,
  });

  if (!isOpen) return null;

  return (
    <div className="admin-approve-dialog__overlay" onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="admin-approve-dialog admin-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        onClick={onDialogClick}
      >
        <h2 id={titleId}>Approve & Send Invitation?</h2>

        <p id={descId} className="approve-message">
          This will approve the request <strong>and automatically send</strong> a founder invitation email.
        </p>

        <p className="approve-note">
          <strong>Note:</strong> The invitation email will be sent immediately after approval.
          If the email fails, the approval will still be saved and you can resend the invitation later.
        </p>

        <div className="admin-approve-dialog__actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn-primary"
            onClick={() => onConfirm(requestId)}
            disabled={isBusy}
          >
            {isBusy ? "Approving & Sending…" : "Approve & Send Invitation"}
          </button>
        </div>
      </div>
    </div>
  );
}
