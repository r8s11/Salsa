import { useState } from "react";
import { Search, SlidersHorizontal, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import type { EventFilters, SortDir, SortKey } from "../../model/eventsQuery";
import { useDebouncedSearch } from "../../../../shared/hooks/useDebouncedSearch";
import "./AdminEventsToolbar.css";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "event_date", label: "Event Date" },
  { key: "created_at", label: "Created" },
  { key: "updated_at", label: "Updated" },
  { key: "title", label: "Event Name" },
];

type DatePreset = "any" | "today" | "next7" | "next30" | "past" | "custom";
type DateRange = { from: string | null; to: string | null };

// Events are dated in the calendar's zone (see eventDateTime), so "today" must
// be too: UTC would roll the date over mid-evening in Boston and New York.
const CALENDAR_ZONE = "America/New_York";
const zoneDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: CALENDAR_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function addDays(yyyyMmDd: string, days: number): string {
  const [year, month, day] = yyyyMmDd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function resolvePreset(preset: DatePreset, now: Date): DateRange {
  const today = zoneDate.format(now);
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "next7":
      return { from: today, to: addDays(today, 7) };
    case "next30":
      return { from: today, to: addDays(today, 30) };
    case "past":
      return { from: null, to: addDays(today, -1) };
    case "any":
    case "custom":
    default:
      return { from: null, to: null };
  }
}

const NAMED_PRESETS: DatePreset[] = ["today", "next7", "next30", "past"];

/** What the Date select shows is read off the filters, never remembered. */
function presetFor(filters: Pick<EventFilters, "from" | "to">, now: Date): DatePreset {
  if (filters.from === null && filters.to === null) return "any";
  return (
    NAMED_PRESETS.find((preset) => {
      const range = resolvePreset(preset, now);
      return range.from === filters.from && range.to === filters.to;
    }) ?? "custom"
  );
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
  const { input: searchInput, handleInput: handleSearchInput } = useDebouncedSearch(
    filters.q,
    (q) => onFiltersChange({ ...filters, q })
  );

  // "Custom…" is chosen before any date exists, so that one intent is local.
  // It lapses when the dates are cleared from elsewhere (chip, Clear all).
  const hasDates = filters.from !== null || filters.to !== null;
  const [customRequested, setCustomRequested] = useState(false);
  const [hadDates, setHadDates] = useState(hasDates);
  if (hasDates !== hadDates) {
    setHadDates(hasDates);
    if (!hasDates) setCustomRequested(false);
  }
  const derived = presetFor(filters, new Date());
  const datePreset: DatePreset = derived === "any" && customRequested ? "custom" : derived;

  const handleDatePresetChange = (preset: DatePreset) => {
    setCustomRequested(preset === "custom");
    if (preset === "custom") return;
    onFiltersChange({ ...filters, ...resolvePreset(preset, new Date()) });
  };

  const nextDir: SortDir = sort.dir === "asc" ? "desc" : "asc";

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
          aria-label={`Sorted ${sort.dir === "asc" ? "ascending" : "descending"}. Switch to ${nextDir === "asc" ? "ascending" : "descending"}`}
          onClick={() => onSortChange({ key: sort.key, dir: nextDir })}
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
