import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import type { City, DatabaseEvent } from "../../features/events/model/types";
import {
  CITY_LABEL,
  DANCE_STYLES,
  SOURCE_TYPE_LABEL,
  type EventFilters,
} from "../../features/admin/model/eventsQuery";
import "./AdminEventsFilterDrawer.css";

const CITIES: City[] = ["boston", "new-york-city"];
const SOURCES: DatabaseEvent["source_type"][] = [
  "admin",
  "user_submission",
  "organizer",
  "moderator",
  "imported",
];

const EMPTY_FILTERS: Pick<EventFilters, "organizer" | "venue" | "style" | "city" | "source"> = {
  organizer: null,
  venue: null,
  style: null,
  city: null,
  source: null,
};

interface AdminEventsFilterDrawerProps {
  open: boolean;
  events: DatabaseEvent[];
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  onClose: () => void;
}

export default function AdminEventsFilterDrawer({
  open,
  events,
  filters,
  onFiltersChange,
  onClose,
}: AdminEventsFilterDrawerProps) {
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

  const organizers = useMemo(
    () =>
      Array.from(
        new Set(
          events.map((event) => event.host).filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [events]
  );
  const venues = useMemo(
    () =>
      Array.from(
        new Set(
          events.map((event) => event.location).filter((value): value is string => Boolean(value))
        )
      ).sort(),
    [events]
  );

  if (!open) return null;

  return (
    <div className="admin-events-filter-drawer__overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="admin-events-filter-drawer admin-card"
        role="dialog"
        aria-modal="true"
        aria-label="More filters"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="admin-events-filter-drawer__header">
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

        <div className="admin-events-filter-drawer__body">
          <div className="admin-field">
            <label htmlFor="admin-filter-organizer">Organizer</label>
            <select
              id="admin-filter-organizer"
              className="admin-select"
              value={filters.organizer ?? ""}
              onChange={(event) =>
                onFiltersChange({ ...filters, organizer: event.target.value || null })
              }
            >
              <option value="">Any organizer</option>
              {organizers.map((organizer) => (
                <option key={organizer} value={organizer}>
                  {organizer}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="admin-filter-venue">Venue</label>
            <select
              id="admin-filter-venue"
              className="admin-select"
              value={filters.venue ?? ""}
              onChange={(event) =>
                onFiltersChange({ ...filters, venue: event.target.value || null })
              }
            >
              <option value="">Any venue</option>
              {venues.map((venue) => (
                <option key={venue} value={venue}>
                  {venue}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="admin-filter-style">Dance Style</label>
            <select
              id="admin-filter-style"
              className="admin-select"
              value={filters.style ?? ""}
              onChange={(event) =>
                onFiltersChange({ ...filters, style: event.target.value || null })
              }
            >
              <option value="">Any style</option>
              {DANCE_STYLES.map((style) => (
                <option key={style.value} value={style.value}>
                  {style.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="admin-filter-city">City</label>
            <select
              id="admin-filter-city"
              className="admin-select"
              value={filters.city ?? ""}
              onChange={(event) =>
                onFiltersChange({ ...filters, city: (event.target.value as City) || null })
              }
            >
              <option value="">Any city</option>
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {CITY_LABEL[city]}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="admin-filter-source">Source</label>
            <select
              id="admin-filter-source"
              className="admin-select"
              value={filters.source ?? ""}
              onChange={(event) =>
                onFiltersChange({
                  ...filters,
                  source: (event.target.value as DatabaseEvent["source_type"]) || null,
                })
              }
            >
              <option value="">Any source</option>
              {SOURCES.map((source) => (
                <option key={source} value={source}>
                  {SOURCE_TYPE_LABEL[source]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-events-filter-drawer__footer">
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
