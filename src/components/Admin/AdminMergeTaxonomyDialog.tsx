import { useEffect, useRef, useState } from "react";
import type { TaxonomyTerm } from "../../features/admin/model/taxonomy";

export default function AdminMergeTaxonomyDialog({ source, candidates, onClose, onMerge }: { source: TaxonomyTerm; candidates: TaxonomyTerm[]; onClose: () => void; onMerge: (ids: { keepId: string; mergeId: string }) => void }) {
  const [keepId, setKeepId] = useState(candidates[0]?.id ?? "");
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);
  const keep = candidates.find((candidate) => candidate.id === keepId);
  return <div className="admin-dialog-backdrop" role="presentation"><section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="merge-taxonomy-title"><h2 id="merge-taxonomy-title" ref={titleRef} tabIndex={-1}>Merge taxonomy terms</h2><p><strong>Merge:</strong> {source.name}</p><label htmlFor="merge-keep">Keep<select id="merge-keep" className="admin-select" value={keepId} onChange={(event) => setKeepId(event.target.value)}>{candidates.filter((candidate) => candidate.category === source.category).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>{keep && <p>{source.usage_count} event relationships will move to {keep.name}.</p>}<p>The source term will be archived. This cannot be undone automatically.</p><div className="admin-dialog__actions"><button type="button" className="admin-btn admin-btn--secondary" onClick={onClose}>Cancel</button><button type="button" className="admin-btn admin-btn--danger" disabled={!keepId} onClick={() => onMerge({ keepId, mergeId: source.id })}>Merge terms</button></div></section></div>;
}
