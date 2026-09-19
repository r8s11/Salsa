import { useRef } from "react";
import { X } from "lucide-react";
import { useAccessibleDialog } from "../../shared/a11y/useAccessibleDialog";
import { type AccountKind, type UserFilters } from "../../features/admin/model/usersQuery";
import "./AdminUsersFilterDrawer.css";

const EMPTY_FILTERS: Pick<UserFilters, "kind" | "from" | "to"> = {
  kind: null,
  from: null,
  to: null,
};

interface AdminUsersFilterDrawerProps {
  open: boolean;
  filters: UserFilters;
  onFiltersChange: (filters: UserFilters) => void;
  onClose: () => void;
}

export default function AdminUsersFilterDrawer({
  open,
  filters,
  onFiltersChange,
  onClose,
}: AdminUsersFilterDrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { onKeyDown, onBackdropClick, onDialogClick } = useAccessibleDialog({
    dialogRef,
    isOpen: open,
    onDismiss: onClose,
  });

  if (!open) return null;

  return (
    <div className="admin-users-filter-drawer__overlay" onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="admin-users-filter-drawer admin-card"
        role="dialog"
        aria-modal="true"
        aria-label="More filters"
        tabIndex={-1}
        onClick={onDialogClick}
        onKeyDown={onKeyDown}
      >
        <div className="admin-users-filter-drawer__header">
          <h2>More Filters</h2>
          <button
            type="button"
            className="admin-icon-btn"
            aria-label="Close filters"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="admin-users-filter-drawer__body">
          <div className="admin-field">
            <label htmlFor="admin-filter-account-type">Account Type</label>
            <select
              id="admin-filter-account-type"
              className="admin-select"
              value={filters.kind ?? ""}
              onChange={(event) =>
                onFiltersChange({ ...filters, kind: (event.target.value as AccountKind) || null })
              }
            >
              <option value="">Any account type</option>
              <option value="profile">Registered</option>
              <option value="guest">Magic-link only</option>
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="admin-filter-joined-after">Joined after</label>
            <input
              id="admin-filter-joined-after"
              type="date"
              className="admin-input"
              value={filters.from ?? ""}
              onChange={(event) =>
                onFiltersChange({ ...filters, from: event.target.value || null })
              }
            />
          </div>

          <div className="admin-field">
            <label htmlFor="admin-filter-joined-before">Joined before</label>
            <input
              id="admin-filter-joined-before"
              type="date"
              className="admin-input"
              value={filters.to ?? ""}
              onChange={(event) => onFiltersChange({ ...filters, to: event.target.value || null })}
            />
          </div>
        </div>

        <div className="admin-users-filter-drawer__footer">
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
