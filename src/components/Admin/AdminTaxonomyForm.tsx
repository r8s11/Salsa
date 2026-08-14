import { useState } from "react";
import { slugifyTaxonomyName, validateTaxonomyForm, type TaxonomyForm } from "../../features/admin/model/taxonomy";

export const EMPTY_TAXONOMY_FORM: TaxonomyForm = { name: "", category: "dance_style", slug: "", description: "", display_order: 0, status: "active" };

export default function AdminTaxonomyForm({ initial, submitLabel, usageCount = 0, isSaving, onSubmit, onCancel }: { initial: TaxonomyForm; submitLabel: string; usageCount?: number; isSaving?: boolean; onSubmit: (form: TaxonomyForm) => void; onCancel: () => void }) {
  const [form, setForm] = useState(initial);
  const [slugEdited, setSlugEdited] = useState(Boolean(initial.slug));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = <K extends keyof TaxonomyForm>(key: K, value: TaxonomyForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = validateTaxonomyForm(form);
    setErrors(next);
    if (Object.keys(next).length === 0) onSubmit(form);
  };
  return <form className="admin-form" onSubmit={submit}>
    <div className="admin-form__header"><h1>{submitLabel}</h1></div>
    <fieldset className="admin-form__fieldset"><legend>Term details</legend>
      <div className="admin-field"><label htmlFor="taxonomy-name">Name *</label><input id="taxonomy-name" className="admin-input" value={form.name} onChange={(e) => { const name = e.target.value; update("name", name); if (!slugEdited) update("slug", slugifyTaxonomyName(name)); }} />{errors.name && <p className="admin-field__error">{errors.name}</p>}</div>
      <div className="admin-field"><label htmlFor="taxonomy-category">Category *</label><select id="taxonomy-category" className="admin-select" value={form.category} disabled={usageCount > 0} onChange={(e) => update("category", e.target.value as TaxonomyForm["category"])}><option value="dance_style">Dance Style</option><option value="event_attribute">Event Attribute</option></select>{usageCount > 0 && <p className="admin-form__helper">Category cannot change while this term has event usage.</p>}</div>
      <div className="admin-field"><label htmlFor="taxonomy-slug">Slug *</label><input id="taxonomy-slug" className="admin-input" value={form.slug} onChange={(e) => { setSlugEdited(true); update("slug", e.target.value); }} />{errors.slug && <p className="admin-field__error">{errors.slug}</p>}</div>
      <div className="admin-field"><label htmlFor="taxonomy-description">Description</label><textarea id="taxonomy-description" className="admin-textarea" value={form.description} onChange={(e) => update("description", e.target.value)} /></div>
      <div className="admin-field"><label htmlFor="taxonomy-order">Display order</label><input id="taxonomy-order" type="number" className="admin-input" value={form.display_order} onChange={(e) => update("display_order", Number(e.target.value))} /></div>
      <div className="admin-field"><label htmlFor="taxonomy-status">Status</label><select id="taxonomy-status" className="admin-select" value={form.status} onChange={(e) => update("status", e.target.value as TaxonomyForm["status"])}><option value="active">Active</option><option value="needs_review">Needs Review</option><option value="archived">Archived</option></select></div>
    </fieldset>
    <div className="admin-form__actions"><button type="button" className="admin-btn admin-btn--secondary" onClick={onCancel}>Cancel</button><button className="admin-btn" disabled={isSaving}>{isSaving ? "Saving…" : submitLabel}</button></div>
  </form>;
}
