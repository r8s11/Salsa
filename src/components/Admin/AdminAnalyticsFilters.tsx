import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import {
  TIME_RANGE_OPTIONS,
  GRANULARITY_OPTIONS,
  type TimeRange,
  type Granularity,
  type DateRange,
} from "../../features/admin/model/analyticsQuery";
import "./AdminAnalyticsFilters.css";

interface AdminAnalyticsFiltersProps {
  range: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  granularity: Granularity;
  onGranularityChange: (granularity: Granularity) => void;
  dateRange: DateRange;
  fromDate: string;
  toDate: string;
  onCustomRangeChange: (from: string, to: string) => void;
}

export default function AdminAnalyticsFilters({
  range,
  onRangeChange,
  granularity,
  onGranularityChange,
  dateRange,
  fromDate,
  toDate,
  onCustomRangeChange,
}: AdminAnalyticsFiltersProps) {
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (dropdownOpen) listboxRef.current?.focus();
  }, [dropdownOpen]);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const handleRadioKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const currentIndex = TIME_RANGE_OPTIONS.findIndex((o) => o.value === range);
      let nextIndex = currentIndex;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % TIME_RANGE_OPTIONS.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + TIME_RANGE_OPTIONS.length) % TIME_RANGE_OPTIONS.length;
      } else {
        return;
      }
      event.preventDefault();
      onRangeChange(TIME_RANGE_OPTIONS[nextIndex].value);
    },
    [range, onRangeChange]
  );

  const handleListboxKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const currentIndex = GRANULARITY_OPTIONS.findIndex((o) => o.value === granularity);
      let nextIndex = currentIndex;
      if (event.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % GRANULARITY_OPTIONS.length;
      } else if (event.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + GRANULARITY_OPTIONS.length) % GRANULARITY_OPTIONS.length;
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setDropdownOpen(false);
        return;
      } else if (event.key === "Escape") {
        setDropdownOpen(false);
        return;
      } else {
        return;
      }
      event.preventDefault();
      onGranularityChange(GRANULARITY_OPTIONS[nextIndex].value);
    },
    [granularity, onGranularityChange]
  );

  return (
    <div className="admin-analytics-filters">
      <div className="admin-analytics-filters__row">
        {/* Time range pills */}
        <div
          className="admin-analytics-filters__pills"
          role="radiogroup"
          aria-label="Time range"
          onKeyDown={handleRadioKeyDown}
        >
          {TIME_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={range === option.value}
              className={
                "admin-analytics-filters__pill " +
                (range === option.value ? "admin-analytics-filters__pill--active" : "")
              }
              onClick={() => onRangeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Custom date range — shown when a quick pill is used, allows override */}
        <div className="admin-analytics-filters__dates">
          <label htmlFor="admin-analytics-from" className="admin-analytics-filters__date-label">
            From
          </label>
          <input
            id="admin-analytics-from"
            ref={fromRef}
            type="date"
            className="admin-input admin-analytics-filters__date-input"
            value={fromDate}
            onChange={(event) => onCustomRangeChange(event.target.value, toDate)}
            aria-label="From date"
          />
          <label htmlFor="admin-analytics-to" className="admin-analytics-filters__date-label">
            To
          </label>
          <input
            id="admin-analytics-to"
            ref={toRef}
            type="date"
            className="admin-input admin-analytics-filters__date-input"
            value={toDate}
            onChange={(event) => onCustomRangeChange(fromDate, event.target.value)}
            aria-label="To date"
          />
        </div>

        {/* Granularity selector (dropdown) */}
        <div className="admin-analytics-filters__granularity" ref={dropdownRef}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            aria-controls="admin-analytics-granularity-listbox"
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setDropdownOpen((prev) => !prev);
              }
            }}
          >
            {GRANULARITY_OPTIONS.find((g) => g.value === granularity)?.label ?? "Weekly"}
            <ChevronDown size={16} />
          </button>
          {dropdownOpen && (
            <div
              id="admin-analytics-granularity-listbox"
              ref={listboxRef}
              className="admin-analytics-filters__granularity-panel"
              role="listbox"
              aria-label="Analytics granularity"
              tabIndex={-1}
              onKeyDown={handleListboxKeyDown}
            >
              {GRANULARITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  tabIndex={0}
                  aria-selected={granularity === option.value}
                  className={
                    "admin-analytics-filters__granularity-option " +
                    (granularity === option.value
                      ? "admin-analytics-filters__granularity-option--selected"
                      : "")
                  }
                  onClick={() => {
                    onGranularityChange(option.value);
                    setDropdownOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="admin-analytics-filters__range-hint">
        Showing {dateRange.from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} —{" "}
        {dateRange.to.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </p>
    </div>
  );
}
