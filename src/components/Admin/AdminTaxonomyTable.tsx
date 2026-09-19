import { Link } from "react-router-dom";
import AdminTaxonomyStatusBadge from "./AdminTaxonomyStatusBadge";
import type { TaxonomyCategory, TaxonomyTerm } from "../../features/admin/model/taxonomy";
import "./AdminTaxonomyTable.css";

import "./AdminTables.css";

const categoryLabel: Record<TaxonomyCategory, string> = {
  dance_style: "Dance Style",
  event_attribute: "Attribute",
};

export default function AdminTaxonomyTable({
  terms,
  onArchive,
  onRestore,
  onDelete,
  isLoading = false,
}: {
  terms: TaxonomyTerm[];
  onArchive: (term: TaxonomyTerm) => void;
  onRestore: (id: string) => void;
  onDelete: (term: TaxonomyTerm) => void;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="admin-taxonomy-table__scroll" aria-busy="true">
        <table className="admin-taxonomy-table">
          <caption className="admin-visually-hidden">Taxonomy — loading</caption>
          <thead>
            <tr>
              {["Name", "Category", "Slug", "Usage", "Status", "Updated", "Actions"].map((label) => (
                <th key={label} scope="col">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }, (_, index) => (
              <tr key={index}>
                <td colSpan={7}>
                  <div className="admin-table-loading" aria-hidden="true">
                    <div className="admin-skeleton admin-skeleton--title" />
                    <div className="admin-skeleton admin-skeleton--meta" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (terms.length === 0) {
    return <div className="admin-table-empty" role="status"><p>No taxonomy terms found.</p></div>;
  }

  const action = (term: TaxonomyTerm) => (
    <div className="admin-taxonomy-table__actions">
      {term.status === "archived" ? (
        <button
          type="button"
          className="admin-btn admin-btn--secondary admin-btn--sm"
          aria-label={`Restore ${term.name}`}
          onClick={() => onRestore(term.id)}
        >
          Restore
        </button>
      ) : (
        <button
          type="button"
          className="admin-btn admin-btn--secondary admin-btn--sm"
          aria-label={`Archive ${term.name}`}
          onClick={() => onArchive(term)}
        >
          Archive
        </button>
      )}
      <button
        type="button"
        className="admin-btn admin-btn--danger-quiet admin-btn--sm"
        aria-label={`Delete ${term.name}`}
        disabled={term.usage_count > 0}
        title={term.usage_count > 0 ? `Used by ${term.usage_count} events` : undefined}
        onClick={() => onDelete(term)}
      >
        Delete
      </button>
    </div>
  );
  return (
    <>
      <div className="admin-taxonomy-table__scroll">
        <table className="admin-taxonomy-table">
          <caption className="admin-visually-hidden">Taxonomy</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Category</th>
              <th scope="col">Slug</th>
              <th scope="col">Usage</th>
              <th scope="col">Status</th>
              <th scope="col">Updated</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((term) => (
              <tr key={term.id}>
                <td>
                  <Link to={`/admin/tags/${term.id}`}>{term.name}</Link>
                </td>
                <td>{categoryLabel[term.category]}</td>
                <td>{term.slug}</td>
                <td aria-label={`Used by ${term.usage_count} events`}>{term.usage_count} events</td>
                <td>
                  <AdminTaxonomyStatusBadge status={term.status} />
                </td>
                <td>
                  {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
                    new Date(term.updated_at)
                  )}
                </td>
                <td>{action(term)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="admin-taxonomy-cards admin-taxonomy-table__cards"
        aria-label="Taxonomy terms mobile list"
      >
        {terms.map((term) => (
          <article className="admin-card admin-taxonomy-cards__item" key={term.id}>
            <div className="admin-taxonomy-cards__body">
              <p className="admin-taxonomy-cards__name">
                <Link to={`/admin/tags/${term.id}`}>{term.name}</Link>
              </p>
              <p className="admin-taxonomy-cards__meta">
                {categoryLabel[term.category]} ·{" "}
                <span aria-label={`Used by ${term.usage_count} events`}>
                  {term.usage_count} events
                </span>{" "}
                · <AdminTaxonomyStatusBadge status={term.status} />
              </p>
            </div>
            {action(term)}
          </article>
        ))}
      </div>
    </>
  );
}
