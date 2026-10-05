// Purpose: Presentational desktop filter sidebar for the Calendar page —
// no internal state, driven entirely by Calendar.tsx's filter state.
// The "What's on" rows double as the grid's colour legend: each type wears
// its calendar colour and a share rail, so a style filter visibly
// re-proportions the week. Selection rides the calendar's RubberSegment thumb.

import type { CSSProperties } from "react";
import RubberSegment from "../../../components/ui/RubberSegment";
import { CALENDARS_CONFIG } from "../../events/model/calendarsConfig";
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
  const total = typeOptions.reduce((count, option) => count + option.count, 0);
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
        <RubberSegment
          className="sidebar-rows"
          items={["all", ...typeOptions.map((option) => option.value)]}
          value={typeFilter}
          itemSelector=".sidebar-row"
          fitHeight
        >
          <button
            type="button"
            className={`sidebar-row ${typeFilter === "all" ? "sidebar-row-active" : ""}`}
            aria-pressed={typeFilter === "all"}
            onClick={() => onTypeFilterChange("all")}
          >
            <span className="sidebar-row-label">All events</span>
            <span className="sidebar-row-count">{total}</span>
            <span className="sidebar-share sidebar-share-stack" aria-hidden="true">
              {typeOptions.map((option) => (
                <span
                  key={option.value}
                  className="sidebar-share-segment"
                  style={{
                    flexGrow: option.count,
                    background: CALENDARS_CONFIG[option.value].darkColors.main,
                  }}
                />
              ))}
            </span>
          </button>
          {typeOptions.map((option) => {
            const pressed = typeFilter === option.value;
            const share = total > 0 ? option.count / total : 0;
            return (
              <button
                key={option.value}
                type="button"
                className={`sidebar-row sidebar-type-row ${pressed ? "sidebar-row-active" : ""} ${
                  option.count === 0 ? "sidebar-row-empty" : ""
                }`}
                style={
                  {
                    "--type-color": CALENDARS_CONFIG[option.value].darkColors.main,
                    "--type-share": share,
                  } as CSSProperties
                }
                aria-pressed={pressed}
                aria-label={`${option.label} ${option.count}`}
                onClick={() => handleTypeClick(option.value)}
              >
                <span className="sidebar-row-label" aria-hidden="true">
                  <span className="sidebar-type-swatch" />
                  {option.label}
                </span>
                <span className="sidebar-row-count" aria-hidden="true">
                  {option.count}
                </span>
                <span className="sidebar-share" aria-hidden="true">
                  <span className="sidebar-share-fill" />
                </span>
              </button>
            );
          })}
        </RubberSegment>
      </div>

      {styleOptions.length > 0 && (
        <div className="sidebar-group" role="group" aria-label="Dance style">
          <p className="sidebar-section-label">Dance style</p>
          <RubberSegment
            className="sidebar-rows"
            items={["all", ...styleOptions]}
            value={styleFilter}
            itemSelector=".sidebar-row"
            fitHeight
          >
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
                className={`sidebar-row sidebar-style-row ${
                  styleFilter === style ? "sidebar-row-active" : ""
                }`}
                aria-pressed={styleFilter === style}
                onClick={() => onStyleFilterChange(style)}
              >
                <span className="sidebar-row-label">{style}</span>
              </button>
            ))}
          </RubberSegment>
        </div>
      )}

      <p className="sidebar-footer">{eventCountLabel}</p>
    </aside>
  );
}
