import { useRef, type KeyboardEvent } from "react";
import type { EventView } from "../../features/admin/model/eventsQuery";
import "./AdminViewTabs.css";

interface AdminViewTabsProps {
  active: EventView;
  counts: Record<EventView, number>;
  onChange: (view: EventView) => void;
}

// Order and labels are fixed by the spec.
const VIEWS: { view: EventView; label: string }[] = [
  { view: "all", label: "All Events" },
  { view: "upcoming", label: "Upcoming" },
  { view: "drafts", label: "Drafts" },
  { view: "pending", label: "Pending Review" },
  { view: "published", label: "Published" },
  { view: "cancelled", label: "Cancelled" },
  { view: "archived", label: "Archived" },
];

export default function AdminViewTabs({ active, counts, onChange }: AdminViewTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const count = VIEWS.length;
    const next = ((index % count) + count) % count;
    tabRefs.current[next]?.focus();
    onChange(VIEWS[next].view);
  };

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(VIEWS.length - 1);
    }
  };

  return (
    <>
      <div className="admin-view-tabs" role="tablist" aria-label="Event views">
        {VIEWS.map(({ view, label }, index) => {
          const isActive = view === active;
          const count = counts[view];
          return (
            <button
              key={view}
              type="button"
              role="tab"
              id={`admin-view-tab-${view}`}
              aria-selected={isActive}
              aria-controls="admin-events-tabpanel"
              tabIndex={isActive ? 0 : -1}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              className={`admin-view-tabs__tab${isActive ? " admin-view-tabs__tab--active" : ""}${count === 0 ? " admin-view-tabs__tab--empty" : ""}`}
              onClick={() => onChange(view)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {label}
              <span className="admin-view-tabs__count">{count}</span>
            </button>
          );
        })}
      </div>

      <label className="admin-view-tabs__select-label" htmlFor="admin-view-tabs-select">
        Event view
      </label>
      <select
        id="admin-view-tabs-select"
        className="admin-select admin-view-tabs__select"
        value={active}
        onChange={(event) => onChange(event.target.value as EventView)}
      >
        {VIEWS.map(({ view, label }) => (
          <option key={view} value={view}>
            {label} ({counts[view]})
          </option>
        ))}
      </select>
    </>
  );
}
