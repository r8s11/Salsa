import { useEffect, useRef, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import {
  ORGANIZER_TYPE_LABEL,
  type OrganizerType,
  type RequestFilters,
} from "../../features/admin/model/organizerRequestsQuery";
import {
  ACCOUNT_STATUS_LABEL,
  type AccountStatus,
} from "../../features/admin/model/usersQuery";
import "./AdminOrganizerRequestsFilterDrawer.css";

const EMPTY_FILTERS: Pick<RequestFilters, "type" | "accountStatus" | "from" | "to"> = {
  type: [],
  accountStatus: [],
  from: null,
  to: null,
};

interface AdminOrganizerRequestsFilterDrawerProps {
  open: boolean;
  filters: RequestFilters;
  onFiltersChange: (filters: RequestFilters) => void;
  onClose: () => void;
}

export default function AdminOrganizerRequestsFilterDrawer({
  open,
  filters,
  onFiltersChange,
  onClose,
}: AdminOrganizerRequestsFilterDrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEscapeKey(() => {
    if (open) onClose();
  });

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  // Keeps Tab/Shift+Tab cycling within the drawer while it's open.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], select, input, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
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

  const toggleType = (value: OrganizerType) => {
    const next = filters.type.includes(value)
      ? filters.type.filter((t) => t !== value)
      : [...filters.type, value];
    onFiltersChange({ ...filters, type: next });
  };

  const toggleStatus = (value: AccountStatus) => {
    const next = filters.accountStatus.includes(value)
      ? filters.accountStatus.filter((s) => s !== value)
      : [...filters.accountStatus, value];
    onFiltersChange({ ...filters, accountStatus: next });
  };

  const typeOptions: OrganizerType[] = [
    "promoter",
    "dance-studio",
    "dj",
    "venue",
    "dance-company",
    "festival",
    "independent",
    "other",
  ];

  const statusOptions: AccountStatus[] = ["active", "flagged", "suspended", "banned"];

  if (!open) return null;

  return (
    <div className="admin-organizer-requests-filter-drawer__overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="admin-organizer-requests-filter-drawer admin-card"
        role="dialog"
        aria-modal="true"
        aria-label="More filters"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="admin-organizer-requests-filter-drawer__header">
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

        <div className="admin-organizer-requests-filter-drawer__body">
          <fieldset className="admin-organizer-requests-filter-drawer__type-group">
            <legend>Organizer Type</legend>
            {typeOptions.map((option) => (
              <label
                key={option}
                className="admin-organizer-requests-filter-drawer__type-option"
              >
                <input
                  type="checkbox"
                  checked={filters.type.includes(option)}
                  onChange={() => toggleType(option)}
                />
                {ORGANIZER_TYPE_LABEL[option]}
              </label>
            ))}
          </fieldset>

          <fieldset className="admin-organizer-requests-filter-drawer__status-group">
            <legend>Account Status</legend>
            {statusOptions.map((option) => (
              <label
                key={option}
                className="admin-organizer-requests-filter-drawer__status-option"
              >
                <input
                  type="checkbox"
                  checked={filters.accountStatus.includes(option)}
                  onChange={() => toggleStatus(option)}
                />
                {ACCOUNT_STATUS_LABEL[option]}
              </label>
            ))}
          </fieldset>

          <div className="admin-field">
            <label htmlFor="admin-organizer-requests-filter-from">Requested after</label>
            <input
              id="admin-organizer-requests-filter-from"
              type="date"
              className="admin-input"
              value={filters.from ?? ""}
              onChange={(event) => onFiltersChange({ ...filters, from: event.target.value || null })}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="admin-organizer-requests-filter-to">Requested before</label>
            <input
              id="admin-organizer-requests-filter-to"
              type="date"
              className="admin-input"
              value={filters.to ?? ""}
              onChange={(event) => onFiltersChange({ ...filters, to: event.target.value || null })}
            />
          </div>
        </div>

        <div className="admin-organizer-requests-filter-drawer__footer">
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
