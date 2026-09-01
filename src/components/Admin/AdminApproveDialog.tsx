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
  if (!isOpen) return null;

  return (
    <div className="admin-approve-dialog__overlay" onClick={onCancel}>
      <div
        className="admin-approve-dialog admin-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Approve founder request ${requestId}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Approve Founder Request?</h2>

        <p className="approve-message">
          This will mark the request as <strong>Approved</strong>.
        </p>

        <p className="approve-note">
          <strong>Note:</strong> No invitation email will be sent in this phase.
          The applicant will be granted access in a later onboarding step.
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
            type="button"
            className="btn-primary"
            onClick={() => onConfirm(requestId)}
            disabled={isBusy}
          >
            {isBusy ? "Approving…" : "Approve Request"}
          </button>
        </div>
      </div>
    </div>
  );
}