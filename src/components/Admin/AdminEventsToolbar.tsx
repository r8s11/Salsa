import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import type { DatabaseEvent } from "../../features/events/model/types";
import type { EventFilters, SortDir, SortKey } from "../../features/admin/model/eventsQuery";
import "./AdminEventsToolbar.css";

const STATUS_OPTIONS: { value: DatabaseEvent["status"]; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending Approval" },
  { value: "approved", label: "Published" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "archived", label: "Archived" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "event_date", label: "Event Date" },
  { key: "created_at", label: "Created" },
  { key: "updated_at", label: "Updated" },
  { key: "title", label: "Event Name" },
];

type DatePreset = "any" | "today" | "next7" | "next30" | "past" | "custom";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Resolves a preset to the same from/to pair the Custom… date inputs would
// produce — one filtering mechanism, not two.
function resolvePreset(preset: DatePreset, now: Date): { from: string | null; to: string | null } {
  const today = toDateInputValue(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "next7":
      return {
        from: today,
        to: toDateInputValue(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)),
      };
    case "next30":
      return {
        from: today,
        to: toDateInputValue(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)),
      };
    case "past":
      return { from: null, to: toDateInputValue(new Date(now.getTime() - 24 * 60 * 60 * 1000)) };
    case "any":
    case "custom":
    default:
      return { from: null, to: null };
  }
}

interface AdminEventsToolbarProps {
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  sort: { key: SortKey; dir: SortDir };
  onSortChange: (sort: { key: SortKey; dir: SortDir }) => void;
  drawerFilterCount: number;
  onOpenDrawer: () => void;
}

export default function AdminEventsToolbar({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  drawerFilterCount,
  onOpenDrawer,
}: AdminEventsToolbarProps) {
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

  const [datePreset, setDatePreset] = useState<DatePreset>(() =>
    filters.from === null && filters.to === null ? "any" : "custom"
  );

  const handleDatePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "custom") return; // reveal custom inputs, keep current bounds
    const { from, to } = resolvePreset(preset, new Date());
    onFiltersChange({ ...filters, from, to });
  };

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

  const toggleStatus = (value: DatabaseEvent["status"]) => {
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

  return (
    <div className="admin-events-toolbar">
      <div className="admin-events-toolbar__row">
        <div className="admin-events-toolbar__search">
          <Search size={16} />
          <input
            type="search"
            className="admin-input"
            aria-label="Search events"
            placeholder="Search events, venues, organizers…"
            value={searchInput}
            onChange={(event) => handleSearchInput(event.target.value)}
          />
        </div>

        <div className="admin-field admin-events-toolbar__date">
          <div className="admin-select-wrap">
            <select
              className="admin-select admin-events-toolbar__select"
              aria-label="Date"
              value={datePreset}
              onChange={(event) => handleDatePresetChange(event.target.value as DatePreset)}
            >
              <option value="any">Any date</option>
              <option value="today">Today</option>
              <option value="next7">Next 7 days</option>
              <option value="next30">Next 30 days</option>
              <option value="past">Past events</option>
              <option value="custom">Custom…</option>
            </select>
            <ChevronDown size={16} />
          </div>
          {datePreset === "custom" && (
            <div className="admin-events-toolbar__date-range">
              <input
                type="date"
                className="admin-input"
                aria-label="From date"
                value={filters.from ?? ""}
                onChange={(event) =>
                  onFiltersChange({ ...filters, from: event.target.value || null })
                }
              />
              <input
                type="date"
                className="admin-input"
                aria-label="To date"
                value={filters.to ?? ""}
                onChange={(event) =>
                  onFiltersChange({ ...filters, to: event.target.value || null })
                }
              />
            </div>
          )}
        </div>

        <div className="admin-events-toolbar__status" ref={statusWrapRef}>
          <button
            type="button"
            className="admin-btn admin-btn--secondary admin-btn--sm"
            aria-haspopup="menu"
            aria-expanded={statusOpen}
            onClick={() => setStatusOpen((value) => !value)}
          >
            {statusSummary}
            <ChevronDown size={14} />
          </button>
          {statusOpen && (
            <ul
              className="admin-events-toolbar__status-panel"
              role="menu"
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((option) => (
                <li key={option.value} role="none">
                  <label className="admin-events-toolbar__status-option">
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
          className="admin-btn admin-btn--secondary admin-btn--sm admin-events-toolbar__more"
          onClick={onOpenDrawer}
        >
          <SlidersHorizontal size={14} />
          More Filters
          {drawerFilterCount > 0 && (
            <span className="admin-events-toolbar__more-count">{drawerFilterCount}</span>
          )}
        </button>
      </div>

      <div className="admin-events-toolbar__sort-row">
        <label className="admin-events-toolbar__sort-label" htmlFor="admin-events-sort">
          Sort:
        </label>
        <div className="admin-select-wrap">
          <select
            id="admin-events-sort"
            className="admin-select admin-events-toolbar__select"
            value={sort.key}
            onChange={(event) =>
              onSortChange({ key: event.target.value as SortKey, dir: sort.dir })
            }
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
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
