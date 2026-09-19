import { useId, useRef, type ChangeEvent } from "react";
import { ChevronDown, ClipboardList, Search, X } from "lucide-react";
import {
  FOUNDER_REQUEST_SORT_OPTIONS,
  type FounderRequestFilters,
  type FounderRequestSort,
} from "../../features/admin/model/founderRequestsQuery";
import { useAccessibleDialog } from "../../shared/a11y/useAccessibleDialog";
import "./AdminFounderRequestsFilterDrawer.css";

interface AdminFounderRequestsFilterDrawerProps {
  open: boolean;
  filters: FounderRequestFilters;
  onFiltersChange: (filters: FounderRequestFilters) => void;
  sort: FounderRequestSort;
  onSortChange: (sort: FounderRequestSort) => void;
  resultCount: number;
  onClose: () => void;
}

export default function AdminFounderRequestsFilterDrawer({
  open,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  resultCount,
  onClose,
}: AdminFounderRequestsFilterDrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const { onKeyDown, onBackdropClick, onDialogClick } = useAccessibleDialog({
    dialogRef,
    onDismiss: onClose,
  });

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value });
  };

  const handleStatusChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({ ...filters, status: e.target.value as FounderRequestFilters["status"] });
  };

  const handleSortChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const [key, dir] = e.target.value.split("|") as [
      FounderRequestSort["key"],
      FounderRequestSort["dir"],
    ];
    onSortChange({ key, dir });
  };

  const handleClear = () => onFiltersChange({ status: "all", search: "" });

  if (!open) return null;

  return (
    <div className="filter-drawer-overlay" onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="filter-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        tabIndex={-1}
        onClick={onDialogClick}
        onKeyDown={onKeyDown}
      >
        <header className="filter-drawer-header">
          <h2>Filters</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close filters">
            <X className="icon" size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="filter-drawer-content">
          <section className="filter-section">
            <label htmlFor={`${baseId}-search`} className="filter-label">
              <Search className="icon" size={14} aria-hidden="true" />
              Search
            </label>
            <input
              id={`${baseId}-search`}
              type="text"
              placeholder="Search name, email, organization..."
              value={filters.search}
              onChange={handleSearchChange}
              className="filter-input"
            />
          </section>
          <section className="filter-section">
            <label htmlFor={`${baseId}-status`} className="filter-label">
              <ClipboardList className="icon" size={14} aria-hidden="true" />
              Status
            </label>
            <select
              id={`${baseId}-status`}
              value={filters.status}
              onChange={handleStatusChange}
              className="filter-select"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </section>
          <section className="filter-section">
            <label htmlFor={`${baseId}-sort`} className="filter-label">
              <ChevronDown className="icon" size={14} aria-hidden="true" />
              Sort
            </label>
            <select
              id={`${baseId}-sort`}
              value={`${sort.key}|${sort.dir}`}
              onChange={handleSortChange}
              className="filter-select"
            >
              {FOUNDER_REQUEST_SORT_OPTIONS.flatMap((option) => [
                <option key={`${option.key}|asc`} value={`${option.key}|asc`}>
                  {option.label} (asc)
                </option>,
                <option key={`${option.key}|desc`} value={`${option.key}|desc`}>
                  {option.label} (desc)
                </option>,
              ])}
            </select>
          </section>
          <button type="button" className="clear-btn" onClick={handleClear}>
            Clear all filters
          </button>
        </div>
        <footer className="filter-drawer-footer">
          <span className="results-count">{resultCount} result(s)</span>
          <button type="button" className="apply-btn" onClick={onClose}>
            Apply
          </button>
        </footer>
      </div>
    </div>
  );
}
