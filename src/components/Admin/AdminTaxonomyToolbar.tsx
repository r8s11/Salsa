import { ChevronDown } from "lucide-react";
import type {
  TaxonomyCategory,
  TaxonomyFilters,
  TaxonomyStatus,
} from "../../features/admin/model/taxonomy";
import { DEFAULT_TAXONOMY_FILTERS } from "../../features/admin/model/taxonomy";

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
    <div className="admin-taxonomy-toolbar">
      <div className="admin-taxonomy-toolbar__search">
        <label className="admin-visually-hidden" htmlFor="taxonomy-search">
          Search taxonomy
        </label>
        <input
          id="taxonomy-search"
          className="admin-input"
          placeholder="Search taxonomy…"
          value={filters.search}
          onChange={(event) => update("search", event.target.value)}
        />
      </div>

      <label className="admin-field admin-taxonomy-toolbar__field">
        <span>Category</span>
        <span className="admin-select-wrap">
          <select
            aria-label="Category"
            className="admin-select"
            value={filters.category ?? ""}
            onChange={(event) =>
              update("category", (event.target.value || null) as TaxonomyCategory | null)
            }
          >
            <option value="">All categories</option>
            <option value="dance_style">Dance Styles</option>
            <option value="event_attribute">Attributes</option>
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </span>
      </label>

      <label className="admin-field admin-taxonomy-toolbar__field">
        <span>Status</span>
        <span className="admin-select-wrap">
          <select
            aria-label="Status"
            className="admin-select"
            value={filters.status ?? ""}
            onChange={(event) =>
              update("status", (event.target.value || null) as TaxonomyStatus | null)
            }
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="needs_review">Needs Review</option>
            <option value="archived">Archived</option>
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </span>
      </label>

      {active && (
        <button
          type="button"
          className="admin-btn admin-btn--ghost admin-btn--sm admin-taxonomy-toolbar__clear"
          onClick={() => onFiltersChange(DEFAULT_TAXONOMY_FILTERS)}
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
