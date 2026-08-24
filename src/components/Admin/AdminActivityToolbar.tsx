import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, ChevronDown } from "lucide-react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import {
  ACTIVITY_VIEWS,
  CATEGORY_LABEL,
  type ActivityCategory,
  type ActivitySortKey,
  type ActivityView,
  type ActivityFilters,
} from "../../features/admin/model/auditActivityQuery";
import AdminViewTabs from "./AdminViewTabs";
import "./AdminActivityToolbar.css";

interface AdminActivityToolbarProps {
  view: ActivityView;
  onViewChange: (view: ActivityView) => void;
  sort: ActivitySortKey;
  onSortChange: (sort: ActivitySortKey) => void;
  filters: ActivityFilters;
  onFiltersChange: (filters: ActivityFilters) => void;
  drawerFilterCount: number;
  onOpenDrawer: () => void;
  counts: Record<ActivityView, number>;
}

export default function AdminActivityToolbar({
  view,
  onViewChange,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  drawerFilterCount,
  onOpenDrawer,
  counts,
}: AdminActivityToolbarProps) {
  // Search: instant input echo, debounced filter update (same as AdminVenuesToolbar)
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

  // Category dropdown (visible in toolbar)
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryWrapRef = useRef<HTMLDivElement>(null);
  useEscapeKey(() => {
    if (categoryOpen) setCategoryOpen(false);
  });
  useEffect(() => {
    if (!categoryOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (categoryWrapRef.current && !categoryWrapRef.current.contains(event.target as Node)) {
        setCategoryOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [categoryOpen]);

  const toggleCategory = (category: ActivityCategory) => {
    const next = filters.category.includes(category)
      ? filters.category.filter((c) => c !== category)
      : [...filters.category, category];
    onFiltersChange({ ...filters, category: next });
  };

  const categoryOptions: ActivityCategory[] = [
    "events",
    "submissions",
    "users",
    "organizers",
    "venues",
    "taxonomy",
    "settings",
    "security",
  ];

  const categorySummary =
    filters.category.length === 0
      ? "Category"
      : filters.category.length === 1
        ? CATEGORY_LABEL[filters.category[0]]
        : `Category (${filters.category.length})`;

  // Date range inputs
  const handleDateChange = (field: "from" | "to", value: string) => {
    onFiltersChange({ ...filters, [field]: value || null });
  };

  return (
    <div className="admin-activity-toolbar">
      <div className="admin-activity-toolbar__row">
        <div className="admin-activity-toolbar__search">
          <Search size={16} />
          <input
            type="search"
            className="admin-input"
            aria-label="Search activity"
            placeholder="Search by action, actor, target, or entity ID…"
            value={searchInput}
            onChange={(event) => handleSearchInput(event.target.value)}
          />
        </div>

        <div className="admin-activity-toolbar__date">
          <input
            type="date"
            className="admin-input"
            aria-label="From date"
            value={filters.from ?? ""}
            onChange={(event) => handleDateChange("from", event.target.value)}
          />
        </div>

        <div className="admin-activity-toolbar__date">
          <input
            type="date"
            className="admin-input"
            aria-label="To date"
            value={filters.to ?? ""}
            onChange={(event) => handleDateChange("to", event.target.value)}
          />
        </div>

        <div className="admin-activity-toolbar__category" ref={categoryWrapRef}>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            aria-haspopup="menu"
            aria-expanded={categoryOpen}
            onClick={() => setCategoryOpen((value) => !value)}
          >
            {categorySummary}
            <ChevronDown size={14} />
          </button>
          {categoryOpen && (
            <ul
              className="admin-activity-toolbar__category-panel"
              role="menu"
              aria-label="Filter by category"
            >
              {categoryOptions.map((category) => (
                <li key={category} role="none">
                  <label className="admin-activity-toolbar__category-option">
                    <input
                      type="checkbox"
                      checked={filters.category.includes(category)}
                      onChange={() => toggleCategory(category)}
                    />
                    {CATEGORY_LABEL[category]}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="admin-btn admin-btn--secondary admin-activity-toolbar__more"
          onClick={onOpenDrawer}
        >
          <SlidersHorizontal size={14} />
          More Filters
          {drawerFilterCount > 0 && (
            <span className="admin-activity-toolbar__more-count">{drawerFilterCount}</span>
          )}
        </button>
      </div>

      <AdminViewTabs
        views={ACTIVITY_VIEWS}
        active={view}
        counts={counts as Record<ActivityView, number>}
        panelId="activity-panel"
        ariaLabel="Activity views"
        selectId="activity-view-select"
        selectLabel="Filter activity by"
        onChange={onViewChange}
      />

      {/* Sort row — newest/oldest */}
      <div className="admin-activity-toolbar__sort-row">
        <label className="admin-activity-toolbar__sort-label" htmlFor="activity-sort">
          Sort:
        </label>
        <div className="admin-select-wrap">
          <select
            id="activity-sort"
            className="admin-select"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as ActivitySortKey)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <ChevronDown size={16} />
        </div>
      </div>
    </div>
  );
}
