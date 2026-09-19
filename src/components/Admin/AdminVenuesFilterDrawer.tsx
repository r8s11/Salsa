import { useRef } from "react";
import { X } from "lucide-react";
import { useAccessibleDialog } from "../../shared/a11y/useAccessibleDialog";
import {
  VENUE_STATUS_LABEL,
  type VenueFilters,
  type VenueStatus,
} from "../../features/admin/model/venuesQuery";
import { toggleArrayItem } from "../../shared/utils/toggleArrayItem";

interface AdminVenuesFilterDrawerProps {
  filters: VenueFilters;
  onChange: (filters: VenueFilters) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function AdminVenuesFilterDrawer({
  filters,
  onChange,
  onApply,
  onClear,
  onClose,
  isOpen,
}: AdminVenuesFilterDrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { onKeyDown, onBackdropClick, onDialogClick } = useAccessibleDialog({
    dialogRef,
    isOpen,
    onDismiss: onClose,
  });

  const toggleStatus = (status: VenueStatus) => {
    onChange({ ...filters, status: toggleArrayItem(filters.status, status) });
  };

  const toggleCity = (city: string) => {
    onChange({ ...filters, city: toggleArrayItem(filters.city, city) });
  };

  const toggleState = (state: string) => {
    onChange({ ...filters, state: toggleArrayItem(filters.state, state) });
  };

  // Known cities/states — in a real app these come from a distinct() query;
  // for now we pull from the loaded venues data. The drawer receives the
  // distinct lists via the parent. Keep these as optional props with fallbacks.
  const knownCities = ["Boston", "Cambridge", "Somerville", "New York", "Brooklyn"];
  const knownStates = ["MA", "NY", "CA", "TX", "FL", "PA", "IL", "CO", "WA"];

  if (!isOpen) return null;

  return (
    <div className="admin-venues-filter-drawer__overlay" onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="admin-venues-filter-drawer admin-card"
        role="dialog"
        aria-modal="true"
        aria-label="More Filters"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={onDialogClick}
      >
        <div className="admin-venues-filter-drawer__header">
          <h2>More Filters</h2>
          <button
            type="button"
            className="admin-icon-btn"
            aria-label="Close filters"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="admin-venues-filter-drawer__section">
          <h3>Status</h3>
          <div className="admin-venues-filter-drawer__checkbox-group">
            {(Object.keys(VENUE_STATUS_LABEL) as VenueStatus[]).map((status) => (
              <label key={status} className="admin-venues-filter-drawer__option">
                <input
                  type="checkbox"
                  checked={filters.status.includes(status)}
                  onChange={() => toggleStatus(status)}
                />
                {VENUE_STATUS_LABEL[status]}
              </label>
            ))}
          </div>
        </div>

        <div className="admin-venues-filter-drawer__section">
          <h3>City</h3>
          <div className="admin-venues-filter-drawer__checkbox-group">
            {knownCities.map((city) => (
              <label key={city} className="admin-venues-filter-drawer__option">
                <input
                  type="checkbox"
                  checked={filters.city.includes(city)}
                  onChange={() => toggleCity(city)}
                />
                {city}
              </label>
            ))}
          </div>
        </div>

        <div className="admin-venues-filter-drawer__section">
          <h3>State / Region</h3>
          <div className="admin-venues-filter-drawer__checkbox-group">
            {knownStates.map((state) => (
              <label key={state} className="admin-venues-filter-drawer__option">
                <input
                  type="checkbox"
                  checked={filters.state.includes(state)}
                  onChange={() => toggleState(state)}
                />
                {state}
              </label>
            ))}
          </div>
        </div>

        <div className="admin-venues-filter-drawer__section">
          <h3>Has Upcoming Events</h3>
          <div className="admin-venues-filter-drawer__checkbox-group">
            <label className="admin-venues-filter-drawer__option">
              <input
                type="radio"
                name="has_upcoming"
                checked={filters.has_upcoming === true}
                onChange={() => onChange({ ...filters, has_upcoming: true })}
              />
              Yes
            </label>
            <label className="admin-venues-filter-drawer__option">
              <input
                type="radio"
                name="has_upcoming"
                checked={filters.has_upcoming === false}
                onChange={() => onChange({ ...filters, has_upcoming: false })}
              />
              No
            </label>
            <label className="admin-venues-filter-drawer__option">
              <input
                type="radio"
                name="has_upcoming"
                checked={filters.has_upcoming === null}
                onChange={() => onChange({ ...filters, has_upcoming: null })}
              />
              Either
            </label>
          </div>
        </div>

        <div className="admin-venues-filter-drawer__actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={onClear}>
            Clear All
          </button>
          <button type="button" className="admin-btn admin-btn--primary" onClick={onApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
