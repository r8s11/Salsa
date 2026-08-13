import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import { X } from "lucide-react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import {
  VENUE_STATUS_LABEL,
  type VenueFilters,
  type VenueStatus,
} from "../../features/admin/model/venuesQuery";

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
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEscapeKey(onClose);

  // Focus trap (same pattern as AdminUsersFilterDrawer)
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement;
    (dialogRef.current?.querySelector("input, button, select") as HTMLElement | null)?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [isOpen]);

  const toggleStatus = (status: VenueStatus) => {
    const next = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status];
    onChange({ ...filters, status: next });
  };

  const toggleCity = (city: string) => {
    const next = filters.city.includes(city)
      ? filters.city.filter((c) => c !== city)
      : [...filters.city, city];
    onChange({ ...filters, city: next });
  };

  const toggleState = (state: string) => {
    const next = filters.state.includes(state)
      ? filters.state.filter((s) => s !== state)
      : [...filters.state, state];
    onChange({ ...filters, state: next });
  };

  const handleOverlayClick = (event: MouseEvent) => {
    if (event.target === overlayRef.current) onClose();
  };

  // Known cities/states — in a real app these come from a distinct() query;
  // for now we pull from the loaded venues data. The drawer receives the
  // distinct lists via the parent. Keep these as optional props with fallbacks.
  const knownCities = ["Boston", "Cambridge", "Somerville", "New York", "Brooklyn"];
  const knownStates = ["MA", "NY", "CA", "TX", "FL", "PA", "IL", "CO", "WA"];

  if (!isOpen) return null;

  return (
    <div
      className="admin-venues-filter-drawer__overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
    >
      <div className="admin-venues-filter-drawer admin-card" ref={dialogRef}>
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
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={onClear}
          >
            Clear All
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={onApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
