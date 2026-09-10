import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import {
  VENUE_SORT_OPTIONS,
  VENUE_VIEWS,
  VENUE_STATUS_LABEL,
  type VenueView,
  type VenueSort,
  type VenueFilters,
  type VenueStatus,
} from "../../features/admin/model/venuesQuery";
import AdminViewTabs from "./AdminViewTabs";
import "./AdminVenuesToolbar.css";

interface AdminVenuesToolbarProps {
  view: VenueView;
  onViewChange: (view: VenueView) => void;
  sort: VenueSort;
  onSortChange: (sort: VenueSort) => void;
  filters: VenueFilters;
  onFiltersChange: (filters: VenueFilters) => void;
  drawerFilterCount: number;
  onOpenDrawer: () => void;
  counts: Record<VenueView, number>;
}

export default function AdminVenuesToolbar({
  view,
  onViewChange,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  drawerFilterCount,
  onOpenDrawer,
  counts,
}: AdminVenuesToolbarProps) {
  // Search: instant input echo, debounced filter update (same as AdminOrganizerRequestsToolbar)
  const [searchInput, setSearchInput] = useState(filters.q);
  const [syncedQ, setSyncedQ] = useState(filters.q);
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    setSearchInput(filters.q);
  }
  const debounceRef = useRef<number | null>(null);
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current ?? undefined);
    debounceRef.current = window.setTimeout(() => {
      onFiltersChange({ ...filters, q: value });
    }, 200);
  };
  useEffect(
    () => () => {
      clearTimeout(debounceRef.current ?? undefined);
    },
    []
  );

  const matchedSortOption = VENUE_SORT_OPTIONS.find(
    (option) => option.key === sort.key && option.dir === sort.dir
  );

  // --- Status quick-filter dropdown (mirrors the organizer type dropdown) ---
  const [statusOpen, setStatusOpen] = useState(false);
  const statusWrapRef = useRef<HTMLDivElement>(null);
  useEscapeKey(() => {
    if (statusOpen) setStatusOpen(false);
  });
  useEffect(() => {
    if (!statusOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (statusWrapRef.current && !statusWrapRef.current.contains(event.target as Node)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [statusOpen]);

  const toggleStatus = (status: VenueStatus) => {
    const next = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status];
    onFiltersChange({ ...filters, status: next });
  };

  const statusSummary =
    filters.status.length === 0
      ? "Status"
      : filters.status.length === 1
        ? VENUE_STATUS_LABEL[filters.status[0]]
        : `Status (${filters.status.length})`;

  return (
    <div className="admin-venues-toolbar">
      <div className="admin-venues-toolbar__row">
        <div className="admin-venues-toolbar__search">
          <Search size={16} />
          <input
            type="search"
            className="admin-input"
            aria-label="Search venues"
            placeholder="Search by venue name, address, city, or ZIP…"
            value={searchInput}
            onChange={(event) => handleSearchInput(event.target.value)}
          />
        </div>

        <div className="admin-venues-toolbar__status" ref={statusWrapRef}>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            aria-haspopup="menu"
            aria-expanded={statusOpen}
            onClick={() => setStatusOpen((value) => !value)}
          >
            {statusSummary}
            <ChevronDown size={14} />
          </button>
          {statusOpen && (
            <ul
              className="admin-venues-toolbar__status-panel"
              role="menu"
              aria-label="Filter by venue status"
            >
              {(Object.keys(VENUE_STATUS_LABEL) as VenueStatus[]).map((status) => (
                <li key={status} role="none">
                  <label className="admin-venues-toolbar__status-option">
                    <input
                      type="checkbox"
                      checked={filters.status.includes(status)}
                      onChange={() => toggleStatus(status)}
                    />
                    {VENUE_STATUS_LABEL[status]}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="admin-btn admin-btn--secondary admin-venues-toolbar__more"
          onClick={onOpenDrawer}
        >
          <SlidersHorizontal size={14} />
          More Filters
          {drawerFilterCount > 0 && (
            <span className="admin-venues-toolbar__more-count">{drawerFilterCount}</span>
          )}
        </button>
      </div>

      <AdminViewTabs
        views={VENUE_VIEWS}
        active={view}
        counts={counts}
        panelId="venues-panel"
        ariaLabel="Venue views"
        selectId="venues-view-select"
        selectLabel="Filter venues by"
        onChange={onViewChange}
      />

      {/* Sort row (same pattern as admin-organizer-requests-toolbar__sort-row) */}
      <div className="admin-venues-toolbar__sort-row">
        <label className="admin-venues-toolbar__sort-label" htmlFor="venue-sort">
          Sort:
        </label>
        <div className="admin-select-wrap">
          <select
            id="venue-sort"
            className="admin-select"
            value={matchedSortOption?.value ?? ""}
            onChange={(event) => {
              const option = VENUE_SORT_OPTIONS.find(
                (candidate) => candidate.value === event.target.value
              );
              if (option) onSortChange({ key: option.key, dir: option.dir });
            }}
          >
            {VENUE_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown size={16} />
        </div>
        <button
          type="button"
          className="admin-icon-btn"
          aria-label={sort.dir === "asc" ? "Sort ascending" : "Sort descending"}
          onClick={() =>
            onSortChange({
              key: sort.key,
              dir: sort.dir === "asc" ? "desc" : "asc",
            })
          }
        >
          {sort.dir === "asc" ? "↑" : "↓"}
        </button>
      </div>
    </div>
  );
}
