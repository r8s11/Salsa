import { useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Plus,
  Search,
  X,
} from "lucide-react";
import Button from "./Button";
import { LiquidMetalButton } from "./liquid-metal-button";
import { cn } from "@/lib/utils";

export type CalendarView = "month-grid" | "week" | "list" | "cards";

interface EventManagerProps {
  title: string;
  view: CalendarView;
  compact: boolean;
  onViewChange: (view: CalendarView) => void;
  onNavigate: (direction: -1 | 0 | 1) => void;
  onEventCreate: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: ReactNode;
  children: ReactNode;
  className?: string;
}

const views = [
  { value: "month-grid", label: "Month", icon: CalendarDays },
  { value: "week", label: "Week", icon: CalendarDays },
  { value: "list", label: "List", icon: List },
  { value: "cards", label: "Cards", icon: LayoutGrid },
] as const;

/** Controlled planner chrome. Approved events and moderation remain feature-owned. */
export function EventManager({
  title,
  view,
  compact,
  onViewChange,
  onNavigate,
  onEventCreate,
  searchQuery,
  onSearchChange,
  filters,
  children,
  className,
}: EventManagerProps) {
  const period = view === "week" ? "week" : "month";
  const searchInput = useRef<HTMLInputElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  return (
    <section className={cn("event-manager", className)} aria-label="Dance event planner">
      <div className="event-manager__heading">
        <div className="event-manager__period">
          <h2 aria-live="polite">{title}</h2>
          <div className="month-nav">
            <button
              type="button"
              className="nav-btn"
              aria-label={`Previous ${period}`}
              onClick={() => onNavigate(-1)}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button type="button" className="nav-btn today-btn" onClick={() => onNavigate(0)}>
              Today
            </button>
            <button
              type="button"
              className="nav-btn"
              aria-label={`Next ${period}`}
              onClick={() => onNavigate(1)}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
        </div>
        <Button onClick={onEventCreate}>
          <Plus size={18} aria-hidden />
          New event
        </Button>
      </div>
      <div className="event-manager__tools">
        <div className="calendar-search">
          <LiquidMetalButton
            mode="icon"
            label="Focus event search"
            icon={<Search size={18} aria-hidden />}
            active={searchFocused}
            onClick={() => searchInput.current?.focus()}
          />
          <input
            ref={searchInput}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            type="search"
            aria-label="Search events"
            placeholder="Search events or venues"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="calendar-search__clear"
              aria-label="Clear search"
              onClick={() => {
                onSearchChange("");
                searchInput.current?.focus();
              }}
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
        <div className="calendar-view-pills" role="group" aria-label="Calendar view">
          {views
            .filter((option) => !compact || option.value === "list" || option.value === "cards")
            .map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                key={value}
                className={`pill ${view === value ? "pill-active-view" : ""}`}
                aria-pressed={view === value}
                onClick={() => onViewChange(value)}
              >
                <Icon size={16} aria-hidden />
                {label}
              </button>
            ))}
        </div>
      </div>
      {filters && <div className="event-manager__filters">{filters}</div>}
      {children}
    </section>
  );
}
