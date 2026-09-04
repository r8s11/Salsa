import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AdminConfirmDialog from "../components/Admin/AdminConfirmDialog";
import AdminMergeTaxonomyDialog from "../components/Admin/AdminMergeTaxonomyDialog";
import AdminTaxonomyForm from "../components/Admin/AdminTaxonomyForm";
import { useAdminTaxonomy, useAdminTaxonomyTerm } from "../features/admin/hooks/useAdminTaxonomy";
import { DEFAULT_TAXONOMY_FILTERS } from "../features/admin/model/taxonomy";
import { taxonomyArchiveCopy, taxonomyDeleteCopy } from "../features/admin/model/taxonomyConfirmCopy";

export default function AdminTaxonomyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mergeOpen, setMergeOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"archive" | "delete" | null>(null);
  const { term, isLoading, error } = useAdminTaxonomyTerm(id);
  const actions = useAdminTaxonomy(DEFAULT_TAXONOMY_FILTERS);

  if (isLoading) return <p>Loading taxonomy term…</p>;
  if (error || !term) return <p role="alert">{error ?? "Taxonomy term not found"}</p>;

  const candidates = actions.terms.filter(
    (candidate) =>
      candidate.id !== term.id &&
      candidate.category === term.category &&
      candidate.status === "active"
  );
  const closePendingAction = () => setPendingAction(null);
  const confirmPendingAction = () => {
    if (pendingAction === "archive") {
      actions.archive.mutate(term.id, { onSuccess: closePendingAction });
    } else if (pendingAction === "delete") {
      actions.remove.mutate(term.id, {
        onSuccess: () => navigate("/admin/tags"),
      });
    }
  };

  return (
    <section className="admin-page">
      <AdminTaxonomyForm
        initial={{
          name: term.name,
          category: term.category,
          slug: term.slug,
          description: term.description ?? "",
          display_order: term.display_order,
          status: term.status,
        }}
        usageCount={term.usage_count}
        submitLabel="Save term"
        isSaving={actions.update.isPending}
        onCancel={() => navigate("/admin/tags")}
        onSubmit={(form) => actions.update.mutate({ id: term.id, form })}
      />
      <section className="admin-card">
        <h2>Usage</h2>
        <p aria-label={`Used by ${term.usage_count} events`}>Used by {term.usage_count} events</p>
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          onClick={() => navigate(`/admin/events?taxonomy=${term.id}`)}
        >
          View events
        </button>
      </section>
      <section className="admin-card">
        <h2>Administration</h2>
        {term.status === "archived" ? (
          <button
            type="button"
            className="admin-btn"
            onClick={() => actions.restore.mutate(term.id)}
          >
            Restore
          </button>
        ) : (
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => setPendingAction("archive")}
          >
            Archive
          </button>
        )}
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          disabled={candidates.length === 0}
          onClick={() => setMergeOpen(true)}
        >
          Merge
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--danger"
          disabled={term.usage_count > 0}
          title={
            term.usage_count > 0
              ? `This term is used by ${term.usage_count} events and cannot be deleted.`
              : undefined
          }
          onClick={() => setPendingAction("delete")}
        >
          Delete
        </button>
      </section>
      {mergeOpen && (
        <AdminMergeTaxonomyDialog
          source={term}
          candidates={candidates}
          onClose={() => setMergeOpen(false)}
          onMerge={({ keepId, mergeId }) =>
            actions.merge.mutate(
              { keepId, mergeId },
              {
                onSuccess: () => {
                  setMergeOpen(false);
                  navigate(`/admin/tags/${keepId}`);
                },
              }
            )
          }
        />
      )}
      {pendingAction && (
        <AdminConfirmDialog
          {...(pendingAction === "archive"
            ? taxonomyArchiveCopy(term.name)
            : taxonomyDeleteCopy(term.name))}
          isBusy={pendingAction === "archive" ? actions.archive.isPending : actions.remove.isPending}
          error={
            pendingAction === "archive"
              ? (actions.archive.error?.message ?? null)
              : (actions.remove.error?.message ?? null)
          }
          onConfirm={confirmPendingAction}
          onCancel={closePendingAction}
        />
      )}
    </section>
  );
}
