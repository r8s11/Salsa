import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import AdminPageHeader from "../components/Admin/AdminPageHeader";
import AdminViewTabs from "../components/Admin/AdminViewTabs";
import AdminTaxonomyToolbar from "../components/Admin/AdminTaxonomyToolbar";
import AdminTaxonomyTable from "../components/Admin/AdminTaxonomyTable";
import { useAdminTaxonomy } from "../features/admin/hooks/useAdminTaxonomy";
import {
  DEFAULT_TAXONOMY_FILTERS,
  applyTaxonomyView,
  applyTaxonomyFilters,
  taxonomyViewCounts,
  TAXONOMY_VIEWS,
  type TaxonomyFilters,
} from "../features/admin/model/taxonomy";
import "./AdminTagsPage.css";

function parseFilters(searchParams: URLSearchParams): TaxonomyFilters {
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const rawView = searchParams.get("view");
  return {
    search: searchParams.get("q") ?? "",
    category:
      category === "dance_style" || category === "event_attribute"
        ? category
        : null,
    status:
      status === "active" || status === "needs_review" || status === "archived"
        ? status
        : null,
    view: (rawView ?? "all") as TaxonomyFilters["view"],
  };
}

function paramsFromFilters(filters: TaxonomyFilters): URLSearchParams {
  const output = new URLSearchParams();
  if (filters.search) output.set("q", filters.search);
  if (filters.category) output.set("category", filters.category);
  if (filters.status) output.set("status", filters.status);
  if (filters.view) output.set("view", filters.view);
  return output;
}

export default function AdminTagsPage() {
  const [params, setParams] = useSearchParams();
  const urlFilters = parseFilters(params);
  const { terms, isLoading, error, archive, restore, remove } =
    useAdminTaxonomy(urlFilters);

  const viewableTerms = useMemo(
    () => applyTaxonomyView(terms ?? [], urlFilters.view),
    [terms, urlFilters.view]
  );

  const filteredTerms = useMemo(
    () => applyTaxonomyFilters(viewableTerms, urlFilters),
    [viewableTerms, urlFilters]
  );

  const counts = useMemo(() => taxonomyViewCounts(terms ?? []), [terms]);

  const updateFilters = (next: TaxonomyFilters) => {
    setParams(paramsFromFilters(next), { replace: true });
  };

  const clearAllFilters = () => {
    setParams(paramsFromFilters(DEFAULT_TAXONOMY_FILTERS), { replace: true });
  };

  const hasActiveFilters =
    urlFilters.search.length > 0 ||
    urlFilters.category !== null ||
    urlFilters.status !== null;

  const emptyMessage =
    hasActiveFilters && filteredTerms.length === 0
      ? "No taxonomy terms match these filters."
      : terms?.length === 0
        ? "No taxonomy terms yet."
        : null;

  return (
    <>
      <AdminPageHeader
        title="Tags &amp; Taxonomy"
        description="Manage how SalsaSegura classifies events."
        actions={
          <a href="/admin/tags/new" className="admin-btn admin-btn--primary">
            Add term
          </a>
        }
      />

      {!isLoading && error && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn&apos;t load taxonomy terms.</p>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      )}

      {!error && (
        <>
          <AdminViewTabs
            views={TAXONOMY_VIEWS}
            active={urlFilters.view}
            counts={counts}
            panelId="admin-taxonomy-tabpanel"
            ariaLabel="Taxonomy views"
            selectId="admin-taxonomy-view-select"
            selectLabel="Taxonomy view"
            onChange={(view) => updateFilters({ ...urlFilters, view })}
          />

          <div className="admin-card admin-tags-page__toolbar-card">
            <AdminTaxonomyToolbar
              filters={urlFilters}
              onFiltersChange={updateFilters}
            />
            {hasActiveFilters && (
              <button
                type="button"
                className="admin-btn admin-btn--ghost admin-tags-page__clear-all"
                onClick={clearAllFilters}
              >
                Clear all filters
              </button>
            )}
          </div>

          <p className="admin-tags-page__result-count" role="status">
            {filteredTerms.length} term{filteredTerms.length === 1 ? "" : "s"}
          </p>

          <div
            className="admin-card admin-tags-page__table-card"
            id="admin-taxonomy-tabpanel"
            role="region"
            aria-label="Taxonomy terms"
          >
            {isLoading ? (
              <div className="admin-tags-page__skeleton" aria-busy="true">
                <p role="status" className="admin-tags-page__status">
                  Loading taxonomy terms…
                </p>
              </div>
            ) : emptyMessage ? (
              <div className="admin-tags-page__empty">
                <h2>{emptyMessage}</h2>
                {!hasActiveFilters && (
                  <a href="/admin/tags/new" className="admin-btn admin-btn--primary">
                    Add first term
                  </a>
                )}
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    onClick={clearAllFilters}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <AdminTaxonomyTable
                terms={filteredTerms}
                onArchive={(id) => archive.mutate(id)}
                onRestore={(id) => restore.mutate(id)}
                onDelete={(id) => remove.mutate(id)}
              />
            )}
          </div>
        </>
      )}
    </>
  );
}
