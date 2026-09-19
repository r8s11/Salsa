import { useMemo, useRef } from "react";
import "./AdminSubmissionsFilterDrawer.css";

import { X } from "lucide-react";
import { useAccessibleDialog } from "../../shared/a11y/useAccessibleDialog";
import type { EventSubmission, SubmissionStatus } from "../../features/admin/model/submissions";

export interface SubmissionFilters {
  status: SubmissionStatus | null;
  submitter_name: string | null;
}

const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: "Pending",
  in_review: "In Review",
  needs_information: "Needs Information",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const STATUSES: SubmissionStatus[] = [
  "pending",
  "in_review",
  "needs_information",
  "approved",
  "rejected",
  "withdrawn",
];

const EMPTY_FILTERS: SubmissionFilters = {
  status: null,
  submitter_name: null,
};

interface AdminSubmissionsFilterDrawerProps {
  open: boolean;
  submissions: EventSubmission[];
  filters: SubmissionFilters;
  onFiltersChange: (filters: SubmissionFilters) => void;
  onClose: () => void;
}

export default function AdminSubmissionsFilterDrawer({
  open,
  submissions,
  filters,
  onFiltersChange,
  onClose,
}: AdminSubmissionsFilterDrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { onKeyDown, onBackdropClick, onDialogClick } = useAccessibleDialog({
    dialogRef,
    isOpen: open,
    onDismiss: onClose,
  });

  const submitters = useMemo(
    () =>
      Array.from(
        new Set(submissions.map((s) => s.submitter_name).filter((v): v is string => Boolean(v)))
      ).sort(),
    [submissions]
  );

  if (!open) return null;

  return (
    <div className="admin-submissions-filter-drawer__overlay" onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="admin-submissions-filter-drawer admin-card"
        role="dialog"
        aria-modal="true"
        aria-label="Filter submissions"
        tabIndex={-1}
        onClick={onDialogClick}
        onKeyDown={onKeyDown}
      >
        <div className="admin-submissions-filter-drawer__header">
          <h2>Filters</h2>
          <button
            type="button"
            className="admin-icon-btn"
            aria-label="Close filters"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="admin-submissions-filter-drawer__body">
          <div className="admin-field">
            <label htmlFor="admin-filter-status">Status</label>
            <select
              id="admin-filter-status"
              className="admin-select"
              value={filters.status ?? ""}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  status: (event.target.value as SubmissionStatus) || null,
                })
              }
            >
              <option value="">Any status</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {SUBMISSION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="admin-filter-submitter">Submitter</label>
            <select
              id="admin-filter-submitter"
              className="admin-select"
              value={filters.submitter_name ?? ""}
              onChange={(event) =>
                onFiltersChange({ ...filters, submitter_name: event.target.value || null })
              }
            >
              <option value="">Any submitter</option>
              {submitters.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-submissions-filter-drawer__footer">
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => onFiltersChange({ ...filters, ...EMPTY_FILTERS })}
          >
            Clear all
          </button>
          <button type="button" className="admin-btn admin-btn--primary" onClick={onClose}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
