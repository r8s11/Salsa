import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminTaxonomyTable from "../components/Admin/AdminTaxonomyTable";
import AdminTaxonomyToolbar from "../components/Admin/AdminTaxonomyToolbar";
import { useAdminTaxonomy } from "../features/admin/hooks/useAdminTaxonomy";
import { type TaxonomyFilters, type TaxonomyView } from "../features/admin/model/taxonomy";

function filtersFromParams(params: URLSearchParams): TaxonomyFilters {
  const category = params.get("category");
  const status = params.get("status");
  const view = params.get("view");
  return {
    search: params.get("q") ?? "",
    category: category === "dance_style" || category === "event_attribute" ? category : null,
    status:
      status === "active" || status === "needs_review" || status === "archived" ? status : null,
    view: (
      [
        "all",
        "active",
        "dance_styles",
        "attributes",
        "unused",
        "needs_review",
        "archived",
      ] as TaxonomyView[]
    ).includes(view as TaxonomyView)
      ? (view as TaxonomyView)
      : "all",
  };
}

function paramsFromFilters(filters: TaxonomyFilters): URLSearchParams {
  const output = new URLSearchParams();
  if (filters.search) output.set("q", filters.search);
  if (filters.category) output.set("category", filters.category);
  if (filters.status) output.set("status", filters.status);
  if (filters.view !== "all") output.set("view", filters.view);
  return output;
}

export default function AdminTagsPage() {
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const paramsKey = params.toString();
  const [search, setSearch] = useState(filters.search);
  const [searchParam, setSearchParam] = useState(filters.search);
  const searchTimer = useRef<number | undefined>(undefined);
  const latestParamsKey = useRef(paramsKey);
  const { terms, isLoading, error, archive, restore, remove } = useAdminTaxonomy(filters);
  if (filters.search !== searchParam) {
    setSearchParam(filters.search);
    setSearch(filters.search);
  }
  useEffect(
    () => () => {
      window.clearTimeout(searchTimer.current);
    },
    []
  );
  useEffect(() => {
    latestParamsKey.current = paramsKey;
  }, [paramsKey]);
  const setFilters = (next: TaxonomyFilters) => {
    if (next.search !== search) {
      setSearch(next.search);
      window.clearTimeout(searchTimer.current);
      const scheduledParamsKey = paramsKey;
      searchTimer.current = window.setTimeout(() => {
        if (latestParamsKey.current !== scheduledParamsKey) return;
        setParams(paramsFromFilters(next), { replace: true });
        searchTimer.current = undefined;
      }, 250);
      return;
    }
    window.clearTimeout(searchTimer.current);
    searchTimer.current = undefined;
    setParams(paramsFromFilters(next));
  };
  return (
    <section className="admin-page">
      <header className="admin-page__header">
        <div>
          <h1>Tags &amp; Taxonomy</h1>
          <p>Manage how SalsaSegura classifies events.</p>
        </div>
        <Link className="admin-btn" to="/admin/tags/new">
          Add term
        </Link>
      </header>
      <AdminTaxonomyToolbar filters={{ ...filters, search }} onFiltersChange={setFilters} />
      {isLoading ? (
        <p>Loading taxonomy terms…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : terms.length === 0 ? (
        <p>No taxonomy terms match these filters.</p>
      ) : (
        <AdminTaxonomyTable
          terms={terms}
          onArchive={(id) => archive.mutate(id)}
          onRestore={(id) => restore.mutate(id)}
          onDelete={(id) => remove.mutate(id)}
        />
      )}
    </section>
  );
}
