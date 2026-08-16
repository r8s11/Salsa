import { useState, useEffect, useRef, type KeyboardEvent } from "react";
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

  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    const handleKey = (event: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="admin-analytics-filters">
      <div className="admin-analytics-filters__row">
        {/* Time range pills */}
        <div className="admin-analytics-filters__pills" role="radiogroup" aria-label="Time range">
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
            className="admin-analytics-filters__granularity-btn admin-btn admin-btn--secondary"
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            onClick={() => setDropdownOpen((prev: boolean) => !prev)}
          >
            {GRANULARITY_OPTIONS.find((g) => g.value === granularity)?.label ?? "Weekly"}
            <ChevronDown size={16} />
          </button>
          {dropdownOpen && (
            <div
              className="admin-analytics-filters__granularity-panel"
              role="listbox"
              aria-label="Granularity"
            >
              {GRANULARITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
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
