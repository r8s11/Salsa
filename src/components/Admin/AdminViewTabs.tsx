import { useRef, type KeyboardEvent } from "react";
import "./AdminViewTabs.css";

interface AdminViewTabsProps<V extends string> {
  views: { view: V; label: string }[];
  active: V;
  counts: Record<V, number>;
  panelId: string;
  ariaLabel: string;
  selectId: string;
  selectLabel: string;
  onChange: (view: V) => void;
}

export default function AdminViewTabs<V extends string>({
  views,
  active,
  counts,
  panelId,
  ariaLabel,
  selectId,
  selectLabel,
  onChange,
}: AdminViewTabsProps<V>) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const count = views.length;
    const next = ((index % count) + count) % count;
    tabRefs.current[next]?.focus();
    onChange(views[next].view);
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
      focusTab(views.length - 1);
    }
  };

  return (
    <>
      <div className="admin-view-tabs" role="tablist" aria-label={ariaLabel}>
        {views.map(({ view, label }, index) => {
          const isActive = view === active;
          const count = counts[view];
          return (
            <button
              key={view}
              type="button"
              role="tab"
              id={`admin-view-tab-${view}`}
              aria-selected={isActive}
              aria-controls={panelId}
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

      <label className="admin-view-tabs__select-label" htmlFor={selectId}>
        {selectLabel}
      </label>
      <select
        id={selectId}
        className="admin-select admin-view-tabs__select"
        value={active}
        onChange={(event) => onChange(event.target.value as V)}
      >
        {views.map(({ view, label }) => (
          <option key={view} value={view}>
            {label} ({counts[view]})
          </option>
        ))}
      </select>
    </>
  );
}
