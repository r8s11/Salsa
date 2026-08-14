import { useEffect, useRef, useState } from "react";
import type { TaxonomyTerm } from "../../features/admin/model/taxonomy";

export default function AdminMergeTaxonomyDialog({ source, candidates, onClose, onMerge }: { source: TaxonomyTerm; candidates: TaxonomyTerm[]; onClose: () => void; onMerge: (ids: { keepId: string; mergeId: string }) => void }) {
  const sameCategory = candidates.filter((candidate) => candidate.category === source.category);
  const [keepId, setKeepId] = useState(sameCategory[0]?.id ?? "");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    titleRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        openerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  const keep = sameCategory.find((candidate) => candidate.id === keepId);
  return <div className="admin-dialog-backdrop" role="presentation"><section ref={dialogRef} className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="merge-taxonomy-title"><h2 id="merge-taxonomy-title" ref={titleRef} tabIndex={-1}>Merge taxonomy terms</h2><p><strong>Merge:</strong> {source.name}</p><label htmlFor="merge-keep">Keep<select id="merge-keep" className="admin-select" value={keepId} onChange={(event) => setKeepId(event.target.value)}>{sameCategory.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>{keep && <p>{source.usage_count} event relationships will move to {keep.name}.</p>}<p>The source term will be archived. This cannot be undone automatically.</p><div className="admin-dialog__actions"><button type="button" className="admin-btn admin-btn--secondary" onClick={() => { onClose(); openerRef.current?.focus(); }}>Cancel</button><button type="button" className="admin-btn admin-btn--danger" disabled={!keepId} onClick={() => onMerge({ keepId, mergeId: source.id })}>Merge terms</button></div></section></div>;
}
