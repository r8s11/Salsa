// Purpose: Presentational desktop filter sidebar for the Calendar page —
// no internal state, driven entirely by Calendar.tsx's filter state.

import { EventType } from "../../events/model/types";
import { TypeFilter } from "../../../utils/filterEvents";

interface TypeOption {
  value: EventType;
  label: string;
  count: number;
}

interface Props {
  periodLabel: string;
  typeOptions: TypeOption[];
  typeFilter: TypeFilter;
  onTypeFilterChange: (next: TypeFilter) => void;
  styleOptions: string[];
  styleFilter: string;
  onStyleFilterChange: (next: string) => void;
  eventCountLabel: string;
}

export default function CalendarSidebar({
  periodLabel,
  typeOptions,
  typeFilter,
  onTypeFilterChange,
  styleOptions,
  styleFilter,
  onStyleFilterChange,
  eventCountLabel,
}: Props) {
  const handleTypeClick = (value: EventType) => {
    const isExclusivelySelected = typeFilter === value;
    onTypeFilterChange(isExclusivelySelected ? "all" : value);
  };

  return (
    <aside className="calendar-sidebar" aria-label="Calendar filters">
      <div className="sidebar-period">
        <p className="sidebar-section-label">Dates</p>
        <p className="sidebar-period-label">{periodLabel}</p>
      </div>

      <div className="sidebar-group" role="group" aria-label="What's on">
        <p className="sidebar-section-label">What's on</p>
        <div className="sidebar-rows">
          {typeOptions.map((option) => {
            const pressed = typeFilter === "all" || typeFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`sidebar-row ${pressed ? "sidebar-row-active" : ""}`}
                aria-pressed={pressed}
                aria-label={`${option.label} ${option.count}`}
                onClick={() => handleTypeClick(option.value)}
              >
                <span className="sidebar-row-label" aria-hidden="true">
                  {option.label}
                </span>
                <span className="sidebar-row-count" aria-hidden="true">
                  {option.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {styleOptions.length > 0 && (
        <div className="sidebar-group" role="group" aria-label="Dance style">
          <p className="sidebar-section-label">Dance style</p>
          <div className="sidebar-rows">
            <button
              type="button"
              className={`sidebar-row ${styleFilter === "all" ? "sidebar-row-active" : ""}`}
              aria-pressed={styleFilter === "all"}
              onClick={() => onStyleFilterChange("all")}
            >
              <span className="sidebar-row-label">Every style</span>
            </button>
            {styleOptions.map((style) => (
              <button
                key={style}
                type="button"
                className={`sidebar-row ${styleFilter === style ? "sidebar-row-active" : ""}`}
                aria-pressed={styleFilter === style}
                onClick={() => onStyleFilterChange(style)}
              >
                <span className="sidebar-row-label">{style}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="sidebar-footer">{eventCountLabel}</p>
    </aside>
  );
}
