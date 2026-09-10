import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import {
  ROLE_LABEL,
  ACCOUNT_STATUS_LABEL,
  type UserFilters,
  type UserRole,
  type AccountStatus,
  type SortDir,
  type UserSortKey,
} from "../../features/admin/model/usersQuery";
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
  // Search: the input echoes every keystroke instantly; the filter itself
  // applies 200ms after typing stops.
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

  const [roleOpen, setRoleOpen] = useState(false);
  const roleWrapRef = useRef<HTMLDivElement>(null);
  useEscapeKey(() => {
    if (roleOpen) setRoleOpen(false);
  });
  useEffect(() => {
    if (!roleOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (roleWrapRef.current && !roleWrapRef.current.contains(event.target as Node)) {
        setRoleOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [roleOpen]);

  const toggleRole = (value: UserRole) => {
    const next = filters.role.includes(value)
      ? filters.role.filter((role) => role !== value)
      : [...filters.role, value];
    onFiltersChange({ ...filters, role: next });
  };

  const roleSummary =
    filters.role.length === 0
      ? "Role"
      : filters.role.length === 1
        ? ROLE_OPTIONS.find((option) => option.value === filters.role[0])?.label
        : `Role (${filters.role.length})`;

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

  const toggleStatus = (value: AccountStatus) => {
    const next = filters.status.includes(value)
      ? filters.status.filter((status) => status !== value)
      : [...filters.status, value];
    onFiltersChange({ ...filters, status: next });
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
            onClick={() => setRoleOpen((value) => !value)}
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
            onClick={() => setStatusOpen((value) => !value)}
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
          {sort.dir === "asc" ? "↑" : "↓"}
        </button>
      </div>
    </div>
  );
}
