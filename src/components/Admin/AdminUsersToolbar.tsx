import { Search, SlidersHorizontal, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  ROLE_LABEL,
  ACCOUNT_STATUS_LABEL,
  type UserFilters,
  type UserRole,
  type AccountStatus,
  type SortDir,
  type UserSortKey,
} from "../../features/admin/model/usersQuery";
import { toggleArrayItem } from "../../shared/utils/toggleArrayItem";
import { useDebouncedSearch } from "../../shared/hooks/useDebouncedSearch";
import { useDropdown } from "../../shared/hooks/useDropdown";
import "./AdminUsersToolbar.css";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "user", label: ROLE_LABEL.user },
  { value: "moderator", label: ROLE_LABEL.moderator },
  { value: "organizer", label: ROLE_LABEL.organizer },
  { value: "admin", label: ROLE_LABEL.admin },
];

const STATUS_OPTIONS: { value: AccountStatus; label: string }[] = [
  { value: "active", label: ACCOUNT_STATUS_LABEL.active },
  { value: "flagged", label: ACCOUNT_STATUS_LABEL.flagged },
  { value: "suspended", label: ACCOUNT_STATUS_LABEL.suspended },
  { value: "banned", label: ACCOUNT_STATUS_LABEL.banned },
];

const SORT_OPTIONS: { value: string; key: UserSortKey; dir: SortDir; label: string }[] = [
  { value: "joined-desc", key: "joined", dir: "desc", label: "Newest" },
  { value: "joined-asc", key: "joined", dir: "asc", label: "Oldest" },
  { value: "name-asc", key: "name", dir: "asc", label: "Name" },
  { value: "contributions-desc", key: "contributions", dir: "desc", label: "Most Contributions" },
  { value: "active-desc", key: "active", dir: "desc", label: "Recently Active" },
];

interface AdminUsersToolbarProps {
  filters: UserFilters;
  onFiltersChange: (filters: UserFilters) => void;
  sort: { key: UserSortKey; dir: SortDir };
  onSortChange: (sort: { key: UserSortKey; dir: SortDir }) => void;
  drawerFilterCount: number;
  onOpenDrawer: () => void;
}

export default function AdminUsersToolbar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  drawerFilterCount,
  onOpenDrawer,
}: AdminUsersToolbarProps) {
  const { input: searchInput, handleInput: handleSearchInput } = useDebouncedSearch(
    filters.q,
    (q) => onFiltersChange({ ...filters, q })
  );

  const { open: roleOpen, toggle: toggleRoleDropdown, wrapRef: roleWrapRef } = useDropdown();

  const toggleRole = (value: UserRole) => {
    onFiltersChange({ ...filters, role: toggleArrayItem(filters.role, value) });
  };

  const roleSummary =
    filters.role.length === 0
      ? "Role"
      : filters.role.length === 1
        ? ROLE_OPTIONS.find((option) => option.value === filters.role[0])?.label
        : `Role (${filters.role.length})`;

  const { open: statusOpen, toggle: toggleStatusDropdown, wrapRef: statusWrapRef } = useDropdown();

  const toggleStatus = (value: AccountStatus) => {
    onFiltersChange({ ...filters, status: toggleArrayItem(filters.status, value) });
  };

  const statusSummary =
    filters.status.length === 0
      ? "Status"
      : filters.status.length === 1
        ? STATUS_OPTIONS.find((option) => option.value === filters.status[0])?.label
        : `Status (${filters.status.length})`;

  const matchedSortOption = SORT_OPTIONS.find(
    (option) => option.key === sort.key && option.dir === sort.dir
  );

  return (
    <div className="admin-users-toolbar">
      <div className="admin-users-toolbar__row">
        <div className="admin-users-toolbar__search">
          <Search size={16} />
          <input
            type="search"
            className="admin-input"
            aria-label="Search users"
            placeholder="Search users, usernames, or email…"
            value={searchInput}
            onChange={(event) => handleSearchInput(event.target.value)}
          />
        </div>

        <div className="admin-users-toolbar__role" ref={roleWrapRef}>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            aria-haspopup="menu"
            aria-expanded={roleOpen}
            onClick={toggleRoleDropdown}
          >
            {roleSummary}
            <ChevronDown size={14} />
          </button>
          {roleOpen && (
            <ul className="admin-users-toolbar__role-panel" role="menu" aria-label="Filter by role">
              {ROLE_OPTIONS.map((option) => (
                <li key={option.value} role="none">
                  <label className="admin-users-toolbar__role-option">
                    <input
                      type="checkbox"
                      checked={filters.role.includes(option.value)}
                      onChange={() => toggleRole(option.value)}
                    />
                    {option.label}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-users-toolbar__status" ref={statusWrapRef}>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            aria-haspopup="menu"
            aria-expanded={statusOpen}
            onClick={toggleStatusDropdown}
          >
            {statusSummary}
            <ChevronDown size={14} />
          </button>
          {statusOpen && (
            <ul
              className="admin-users-toolbar__status-panel"
              role="menu"
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((option) => (
                <li key={option.value} role="none">
                  <label className="admin-users-toolbar__status-option">
                    <input
                      type="checkbox"
                      checked={filters.status.includes(option.value)}
                      onChange={() => toggleStatus(option.value)}
                    />
                    {option.label}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="admin-btn admin-btn--secondary admin-users-toolbar__more"
          onClick={onOpenDrawer}
        >
          <SlidersHorizontal size={14} />
          More Filters
          {drawerFilterCount > 0 && (
            <span className="admin-users-toolbar__more-count">{drawerFilterCount}</span>
          )}
        </button>
      </div>

      <div className="admin-users-toolbar__sort-row">
        <label className="admin-users-toolbar__sort-label" htmlFor="admin-users-sort">
          Sort:
        </label>
        <div className="admin-select-wrap">
          <select
            id="admin-users-sort"
            className="admin-select"
            value={matchedSortOption?.value ?? ""}
            onChange={(event) => {
              const option = SORT_OPTIONS.find(
                (candidate) => candidate.value === event.target.value
              );
              if (option) onSortChange({ key: option.key, dir: option.dir });
            }}
          >
            {SORT_OPTIONS.map((option) => (
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
