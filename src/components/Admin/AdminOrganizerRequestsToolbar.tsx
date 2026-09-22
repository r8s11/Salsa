import { Search, SlidersHorizontal, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  ORGANIZER_TYPE_LABEL,
  type OrganizerType,
  type RequestFilters,
  REQUEST_SORT_OPTIONS,
  type SortDir,
} from "../../features/admin/model/organizerRequestsQuery";
import { toggleArrayItem } from "../../shared/utils/toggleArrayItem";
import { useDebouncedSearch } from "../../shared/hooks/useDebouncedSearch";
import { useDropdown } from "../../shared/hooks/useDropdown";
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
  const { input: searchInput, handleInput: handleSearchInput } = useDebouncedSearch(
    filters.q,
    (q) => onFiltersChange({ ...filters, q })
  );

  const { open: typeOpen, toggle: toggleTypeDropdown, wrapRef: typeWrapRef } = useDropdown();

  const toggleType = (value: OrganizerType) => {
    onFiltersChange({ ...filters, type: toggleArrayItem(filters.type, value) });
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
            placeholder="Search applicants or brands"
            value={searchInput}
            onChange={(event) => handleSearchInput(event.target.value)}
          />
        </div>

        <div className="admin-organizer-requests-toolbar__type" ref={typeWrapRef}>
          <button
            type="button"
            className="admin-btn admin-btn--secondary admin-btn--sm"
            aria-haspopup="menu"
            aria-expanded={typeOpen}
            onClick={toggleTypeDropdown}
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
          className="admin-btn admin-btn--secondary admin-btn--sm admin-organizer-requests-toolbar__more"
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
          {sort.dir === "asc" ? (
            <ArrowUp size={16} aria-hidden="true" />
          ) : (
            <ArrowDown size={16} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
