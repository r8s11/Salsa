import type {
  TaxonomyCategory,
  TaxonomyFilters,
  TaxonomyStatus,
  TaxonomyView,
} from "../../features/admin/model/taxonomy";
import { DEFAULT_TAXONOMY_FILTERS } from "../../features/admin/model/taxonomy";

const views: { value: TaxonomyView; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "dance_styles", label: "Dance Styles" },
  { value: "attributes", label: "Attributes" },
  { value: "unused", label: "Unused" },
  { value: "needs_review", label: "Needs Review" },
  { value: "archived", label: "Archived" },
];

export default function AdminTaxonomyToolbar({
  filters,
  onFiltersChange,
}: {
  filters: TaxonomyFilters;
  onFiltersChange: (next: TaxonomyFilters) => void;
}) {
  const update = <K extends keyof TaxonomyFilters>(key: K, value: TaxonomyFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });
  const active = filters.search || filters.category || filters.status;
  return (
    <>
      <div className="admin-toolbar">
        <label className="admin-visually-hidden" htmlFor="taxonomy-search">
          Search taxonomy
        </label>
        <input
          id="taxonomy-search"
          className="admin-input"
          placeholder="Search taxonomy…"
          value={filters.search}
          onChange={(e) => update("search", e.target.value)}
        />
        <label>
          Category{" "}
          <select
            aria-label="Category"
            className="admin-select"
            value={filters.category ?? ""}
            onChange={(e) =>
              update("category", (e.target.value || null) as TaxonomyCategory | null)
            }
          >
            <option value="">All categories</option>
            <option value="dance_style">Dance Styles</option>
            <option value="event_attribute">Attributes</option>
          </select>
        </label>
        <label>
          Status{" "}
          <select
            aria-label="Status"
            className="admin-select"
            value={filters.status ?? ""}
            onChange={(e) => update("status", (e.target.value || null) as TaxonomyStatus | null)}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="needs_review">Needs Review</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        {active && (
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => onFiltersChange(DEFAULT_TAXONOMY_FILTERS)}
          >
            Clear all filters
          </button>
        )}
      </div>
      <nav className="admin-view-tabs" aria-label="Taxonomy views">
        {views.map((view) => (
          <button
            type="button"
            key={view.value}
            className={
              filters.view === view.value
                ? "admin-view-tabs__tab admin-view-tabs__tab--active"
                : "admin-view-tabs__tab"
            }
            onClick={() => update("view", view.value)}
          >
            {view.label}
          </button>
        ))}
      </nav>
    </>
  );
}
