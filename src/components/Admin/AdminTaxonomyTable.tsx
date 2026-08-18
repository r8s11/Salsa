import { Link } from "react-router-dom";
import AdminTaxonomyStatusBadge from "./AdminTaxonomyStatusBadge";
import type { TaxonomyCategory, TaxonomyTerm } from "../../features/admin/model/taxonomy";
import "./AdminTaxonomyTable.css";

const categoryLabel: Record<TaxonomyCategory, string> = {
  dance_style: "Dance Style",
  event_attribute: "Attribute",
};

export default function AdminTaxonomyTable({
  terms,
  onArchive,
  onRestore,
  onDelete,
}: {
  terms: TaxonomyTerm[];
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const action = (term: TaxonomyTerm) => (
    <div className="admin-taxonomy-table__actions">
      {term.status === "archived" ? (
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          onClick={() => onRestore(term.id)}
        >
          Restore {term.name}
        </button>
      ) : (
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          onClick={() => onArchive(term.id)}
        >
          Archive {term.name}
        </button>
      )}
      <button
        type="button"
        className="admin-btn admin-btn--danger"
        aria-label={`Delete ${term.name}`}
        disabled={term.usage_count > 0}
        title={term.usage_count > 0 ? `Used by ${term.usage_count} events` : undefined}
        onClick={() => onDelete(term.id)}
      >
        Delete
      </button>
    </div>
  );
  return (
    <>
      <div className="admin-taxonomy-table__scroll">
        <table className="admin-taxonomy-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Slug</th>
              <th>Usage</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Actions</th>
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
          <article className="admin-card" key={term.id}>
            {
              <>
                <Link to={`/admin/tags/${term.id}`}>{term.name}</Link>
                <span>
                  {categoryLabel[term.category]} ·{" "}
                  <span aria-label={`Used by ${term.usage_count} events`}>
                    {term.usage_count} events
                  </span>{" "}
                  · <AdminTaxonomyStatusBadge status={term.status} />
                </span>
                {action(term)}
              </>
            }
          </article>
        ))}
      </div>
    </>
  );
}
