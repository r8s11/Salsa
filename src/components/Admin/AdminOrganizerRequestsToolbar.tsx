import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import {
  ORGANIZER_TYPE_LABEL,
  type OrganizerType,
  type RequestFilters,
  REQUEST_SORT_OPTIONS,
  type SortDir,
} from "../../features/admin/model/organizerRequestsQuery";
import "./AdminOrganizerRequestsToolbar.css";

interface AdminOrganizerRequestsToolbarProps {
  filters: RequestFilters;
  onFiltersChange: (filters: RequestFilters) => void;
  sort: { key: "requested" | "name" | "brand"; dir: SortDir };
  onSortChange: (sort: { key: "requested" | "name" | "brand"; dir: SortDir }) => void;
  drawerFilterCount: number;
  onOpenDrawer: () => void;
}

export default function AdminOrganizerRequestsToolbar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  drawerFilterCount,
  onOpenDrawer,
}: AdminOrganizerRequestsToolbarProps) {
  // Search: the input echoes every keystroke instantly; the filter itself
  // applies 200ms after typing stops. Same pattern as AdminUsersToolbar.
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

  const [typeOpen, setTypeOpen] = useState(false);
  const typeWrapRef = useRef<HTMLDivElement>(null);
  useEscapeKey(() => {
    if (typeOpen) setTypeOpen(false);
  });
  useEffect(() => {
    if (!typeOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (typeWrapRef.current && !typeWrapRef.current.contains(event.target as Node)) {
        setTypeOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [typeOpen]);

  const toggleType = (value: OrganizerType) => {
    const next = filters.type.includes(value)
      ? filters.type.filter((t) => t !== value)
      : [...filters.type, value];
    onFiltersChange({ ...filters, type: next });
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

  const typeSummary =
    filters.type.length === 0
      ? "Type"
      : filters.type.length === 1
        ? ORGANIZER_TYPE_LABEL[filters.type[0]]
        : `Type (${filters.type.length})`;

  const matchedSortOption = REQUEST_SORT_OPTIONS.find(
    (option) => option.key === sort.key && option.dir === sort.dir
  );

  return (
    <div className="admin-organizer-requests-toolbar">
      <div className="admin-organizer-requests-toolbar__row">
        <div className="admin-organizer-requests-toolbar__search">
          <Search size={16} />
          <input
            type="search"
            className="admin-input"
            aria-label="Search organizer requests"
            placeholder="Search by applicant or brand name…"
            value={searchInput}
            onChange={(event) => handleSearchInput(event.target.value)}
          />
        </div>

        <div className="admin-organizer-requests-toolbar__type" ref={typeWrapRef}>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            aria-haspopup="menu"
            aria-expanded={typeOpen}
            onClick={() => setTypeOpen((value) => !value)}
          >
            {typeSummary}
            <ChevronDown size={14} />
          </button>
          {typeOpen && (
            <ul
              className="admin-organizer-requests-toolbar__type-panel"
              role="menu"
              aria-label="Filter by organizer type"
            >
              {typeOptions.map((option) => (
                <li key={option} role="none">
                  <label className="admin-organizer-requests-toolbar__type-option">
                    <input
                      type="checkbox"
                      checked={filters.type.includes(option)}
                      onChange={() => toggleType(option)}
                    />
                    {ORGANIZER_TYPE_LABEL[option]}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="admin-btn admin-btn--secondary admin-organizer-requests-toolbar__more"
          onClick={onOpenDrawer}
        >
          <SlidersHorizontal size={14} />
          More Filters
          {drawerFilterCount > 0 && (
            <span className="admin-organizer-requests-toolbar__more-count">
              {drawerFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="admin-organizer-requests-toolbar__sort-row">
        <label
          className="admin-organizer-requests-toolbar__sort-label"
          htmlFor="admin-organizer-requests-sort"
        >
          Sort:
        </label>
        <div className="admin-select-wrap">
          <select
            id="admin-organizer-requests-sort"
            className="admin-select"
            value={matchedSortOption?.value ?? ""}
            onChange={(event) => {
              const option = REQUEST_SORT_OPTIONS.find(
                (candidate) => candidate.value === event.target.value
              );
              if (option) onSortChange({ key: option.key, dir: option.dir });
            }}
          >
            {REQUEST_SORT_OPTIONS.map((option) => (
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
          onClick={() => onSortChange({ key: sort.key, dir: sort.dir === "asc" ? "desc" : "asc" })}
        >
          {sort.dir === "asc" ? "↑" : "↓"}
        </button>
      </div>
    </div>
  );
}
