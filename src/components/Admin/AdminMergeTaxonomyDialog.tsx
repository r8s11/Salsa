import { useId, useRef, useState } from "react";
import { useAccessibleDialog } from "../../shared/a11y/useAccessibleDialog";
import "./AdminMergeTaxonomyDialog.css";
import type { TaxonomyTerm } from "../../features/admin/model/taxonomy";

export default function AdminMergeTaxonomyDialog({
  source,
  candidates,
  onClose,
  onMerge,
}: {
  source: TaxonomyTerm;
  candidates: TaxonomyTerm[];
  onClose: () => void;
  onMerge: (ids: { keepId: string; mergeId: string }) => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const keepSelectRef = useRef<HTMLSelectElement>(null);
  const sameCategory = candidates.filter((candidate) => candidate.category === source.category);
  const [keepId, setKeepId] = useState(sameCategory[0]?.id ?? "");

  const { onKeyDown, onBackdropClick, onDialogClick } = useAccessibleDialog({
    dialogRef,
    onDismiss: onClose,
    isBusy: false,
    initialFocusRef: keepSelectRef,
  });

  const keep = sameCategory.find((candidate) => candidate.id === keepId);

  return (
    <div className="admin-dialog-backdrop" onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="admin-card admin-card--dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        onClick={onDialogClick}
      >
        <h2 id={titleId}>Merge taxonomy terms</h2>

        <p className="merge-taxonomy__summary">
          <strong>Merge:</strong> {source.name}
        </p>

        <label htmlFor="merge-keep" className="admin-field">
          Keep
          <select
            id="merge-keep"
            ref={keepSelectRef}
            className="admin-select"
            value={keepId}
            onChange={(event) => setKeepId(event.target.value)}
          >
            {sameCategory.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>

        {keep && (
          <p className="merge-taxonomy__impact">
            {source.usage_count} event relationships will move to {keep.name}.
          </p>
        )}

        <p className="merge-taxonomy__warning">
          The source term will be archived. This cannot be undone automatically.
        </p>

        <div className="admin-dialog__actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--danger"
            disabled={!keepId}
            onClick={() => onMerge({ keepId, mergeId: source.id })}
          >
            Merge terms
          </button>
        </div>
      </div>
    </div>
  );
}
