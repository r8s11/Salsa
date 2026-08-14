import { Link, useSearchParams } from "react-router-dom";
import AdminTaxonomyTable from "../components/Admin/AdminTaxonomyTable";
import AdminTaxonomyToolbar from "../components/Admin/AdminTaxonomyToolbar";
import { useAdminTaxonomy } from "../features/admin/hooks/useAdminTaxonomy";
import { type TaxonomyFilters, type TaxonomyView } from "../features/admin/model/taxonomy";

function filtersFromParams(params: URLSearchParams): TaxonomyFilters {
  const category = params.get("category");
  const status = params.get("status");
  const view = params.get("view");
  return { search: params.get("q") ?? "", category: category === "dance_style" || category === "event_attribute" ? category : null, status: status === "active" || status === "needs_review" || status === "archived" ? status : null, view: (["all", "active", "dance_styles", "attributes", "unused", "needs_review", "archived"] as TaxonomyView[]).includes(view as TaxonomyView) ? view as TaxonomyView : "all" };
}

export default function AdminTagsPage() {
  const [params, setParams] = useSearchParams();
  const filters = filtersFromParams(params);
  const { terms, isLoading, error, archive, restore, remove } = useAdminTaxonomy(filters);
  const setFilters = (next: TaxonomyFilters) => { const output = new URLSearchParams(); if (next.search) output.set("q", next.search); if (next.category) output.set("category", next.category); if (next.status) output.set("status", next.status); if (next.view !== "all") output.set("view", next.view); setParams(output); };
  return <section className="admin-page"><header className="admin-page__header"><div><h1>Tags &amp; Taxonomy</h1><p>Manage how SalsaSegura classifies events.</p></div><Link className="admin-btn" to="/admin/tags/new">Add term</Link></header><AdminTaxonomyToolbar filters={filters} onFiltersChange={setFilters} />{isLoading ? <p>Loading taxonomy terms…</p> : error ? <p role="alert">{error}</p> : terms.length === 0 ? <p>No taxonomy terms match these filters.</p> : <AdminTaxonomyTable terms={terms} onArchive={(id) => archive.mutate(id)} onRestore={(id) => restore.mutate(id)} onDelete={(id) => remove.mutate(id)} />}</section>;
}
