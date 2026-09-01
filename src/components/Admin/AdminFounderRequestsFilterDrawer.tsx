import type { ChangeEvent } from "react";
import {
  FOUNDER_REQUEST_SORT_OPTIONS,
  type FounderRequestFilters,
  type FounderRequestSort,
} from "../../features/admin/model/founderRequestsQuery";
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
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value });
  };

  const handleStatusChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({
      ...filters,
      status: e.target.value as FounderRequestFilters["status"],
    });
  };

  const handleSortChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const [key, dir] = e.target.value.split("|") as [FounderRequestSort["key"], FounderRequestSort["dir"]];
    onSortChange({ key, dir });
  };

  const handleClear = () => {
    onFiltersChange({ status: "all", search: "" });
  };

  if (!open) return null;

  return (
    <div className="filter-drawer-overlay" onClick={onClose}>
      <div className="filter-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="filter-drawer-header">
          <h2>Filters</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close filters">
            <span className="icon">✕</span>
          </button>
        </header>

        <div className="filter-drawer-content">
          <section className="filter-section">
            <label htmlFor="filter-search" className="filter-label">
              <span className="icon">🔍</span>
              Search
            </label>
            <input
              id="filter-search"
              type="text"
              placeholder="Search name, email, organization..."
              value={filters.search}
              onChange={handleSearchChange}
              className="filter-input"
            />
          </section>

          <section className="filter-section">
            <label htmlFor="filter-status" className="filter-label">
              <span className="icon">📋</span>
              Status
            </label>
            <select
              id="filter-status"
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
            <label htmlFor="filter-sort" className="filter-label">
              <span className="icon">🔽</span>
              Sort
            </label>
            <select
              id="filter-sort"
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
          <button className="apply-btn" onClick={onClose}>
            Apply
          </button>
        </footer>
      </div>
    </div>
  );
}
