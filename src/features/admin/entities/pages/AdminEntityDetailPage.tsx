import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAccessibleDialog } from "../../../../shared/a11y/useAccessibleDialog";
import AdminConfirmDialog from "../../components/common/AdminConfirmDialog";
import AdminEntityTeamSection from "../../components/entities/AdminEntityTeamSection";
import { useAdminEntity, useAdminEntityActions, useAdminEntityDirectory, useAdminVenueOptions } from "../hooks/useAdminEntities";
import {
  buildEntityForm,
  entityPayload,
  ENTITY_LABELS,
  qualityIssueLabel,
  validateEntityForm,
  type EntityForm,
  type EntityKind,
  type EntityStatus,
} from "../model";
import "./AdminEntityPages.css";

type PendingAction = "create" | "archive" | "merge" | null;

function pluralPath(kind: EntityKind): string {
  if (kind === "series") return "/admin/series";
  if (kind === "organizer") return "/admin/organizers";
  return `/admin/${kind}s`;
}

export default function AdminEntityDetailPage({ kind, mode }: { kind: EntityKind; mode?: "create" }) {
  const { id: routeId } = useParams<{ id: string }>();
  const creating = mode === "create" || !routeId;
  const id = creating ? null : routeId!;
  const navigate = useNavigate();
  const { entity, isLoading, error, refetch } = useAdminEntity(kind, id);
  const actions = useAdminEntityActions(kind);
  const { rows: candidates = [] } = useAdminEntityDirectory(kind, "", null);
  const { rows: organizers = [] } = useAdminEntityDirectory(
    "organizer",
    "",
    "active",
    kind === "series"
  );
  const venues = useAdminVenueOptions(kind === "series");
  const [editing, setEditing] = useState(creating);
  const [form, setForm] = useState<EntityForm>(() => buildEntityForm(entity));
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [mergeId, setMergeId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const mergeDialogRef = useRef<HTMLDivElement>(null);
  const mergeCancelRef = useRef<HTMLButtonElement>(null);
  const mergeDialog = useAccessibleDialog({
    dialogRef: mergeDialogRef,
    onDismiss: () => setPendingAction(null),
    isBusy: actions.isMerging,
    initialFocusRef: mergeCancelRef,
    isOpen: pendingAction === "merge",
  });
  const labels = ENTITY_LABELS[kind];
  const basePath = pluralPath(kind);

  const beginEdit = () => {
    setForm(buildEntityForm(entity));
    setValidationError(null);
    setEditing(true);
  };
  const update = (field: keyof EntityForm, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (actions.isSaving) return;
    const invalid = validateEntityForm(form);
    if (invalid) {
      setValidationError(invalid);
      return;
    }
    setValidationError(null);
    if (creating) setPendingAction("create");
    else void actions.save({ id, payload: entityPayload(kind, form) }).then((saved) => {
      setEditing(false);
      navigate(`${basePath}/${saved.id}`, { replace: true });
    }).catch(() => undefined);
  };
  const confirmAction = () => {
    if (pendingAction === "create") {
      void actions.save({ id: null, payload: entityPayload(kind, form) }).then((saved) => navigate(`${basePath}/${saved.id}`, { replace: true })).catch(() => undefined);
    } else if (pendingAction === "archive" && id) {
      void actions.archive(id).then(() => setPendingAction(null)).catch(() => undefined);
    } else if (pendingAction === "merge" && id && mergeId) {
      void actions.merge({ keepId: id, mergeId }).then(() => navigate(basePath)).catch(() => undefined);
    }
  };

  if (!creating && isLoading && !entity) return <div className="admin-entity-page" aria-busy="true"><p role="status">Loading {labels.singular.toLowerCase()}…</p></div>;
  if (!creating && error) return <div className="admin-entity-page"><div className="admin-banner admin-banner--error" role="alert"><p>Could not load {labels.singular.toLowerCase()}: {error}</p><button type="button" className="admin-btn admin-btn--secondary" onClick={() => refetch()}>Try again</button></div></div>;
  if (!creating && !entity) return <div className="admin-entity-page"><h1>{labels.singular} not found</h1><Link to={basePath} className="admin-btn admin-btn--secondary">Back to {labels.plural.toLowerCase()}</Link></div>;
  const current = entity;

  return (
    <div className="admin-entity-page">
      <Link to={basePath} className="admin-entity-page__back">← {labels.plural}</Link>
      <header className="admin-entity-page__header">
        <div><h1>{creating ? `New ${labels.singular}` : current?.name}</h1></div>
        {!creating && !editing && current ? <div className="admin-entity-page__actions">
          <button type="button" className="admin-btn admin-btn--secondary" onClick={beginEdit} aria-label={`Edit ${kind}`}>Edit {labels.singular.toLowerCase()}</button>
          {current.status !== "archived" && <button type="button" className="admin-btn admin-btn--danger" aria-label={`Archive ${kind}`} onClick={() => setPendingAction("archive")}>Archive</button>}
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setPendingAction("merge")}>Merge duplicate</button>
        </div> : null}
      </header>
      {editing ? <form className="admin-form admin-entity-page__form" onSubmit={submit} noValidate aria-busy={actions.isSaving || undefined}>
        <fieldset className="admin-form__fieldset"><legend>{labels.singular} details</legend>
          <div className="admin-field"><label htmlFor="entity-name">Name</label><input id="entity-name" className="admin-input" value={form.name} onChange={(event) => update("name", event.target.value)} required /></div>
          <div className="admin-field"><label htmlFor="entity-slug">Public URL slug</label><input id="entity-slug" className="admin-input" value={form.slug ?? ""} onChange={(event) => update("slug", event.target.value)} readOnly={!creating && Boolean(current?.slug)} /><p className="admin-form__helper">{!creating && current?.slug ? "This existing public URL is stable and cannot be changed." : "Leave blank to generate a URL slug from the name."}</p></div>
          <div className="admin-field"><label htmlFor="entity-status">Status</label><select id="entity-status" className="admin-select" value={form.status} onChange={(event) => update("status", event.target.value as EntityStatus)}><option value="active">Active</option><option value="needs_review">Needs review</option>{kind === "organizer" && <option value="suspended">Suspended</option>}<option value="archived">Archived</option></select></div>
          {(kind === "series" || kind === "organizer" || kind === "school" || kind === "instructor") && <div className="admin-field"><label htmlFor="entity-city">City (canonical metro slug)</label><input id="entity-city" className="admin-input" value={form.city ?? ""} onChange={(event) => update("city", event.target.value)} /></div>}
          <div className="admin-field"><label htmlFor="entity-description">Description</label><textarea id="entity-description" className="admin-textarea" rows={4} value={form.description ?? ""} onChange={(event) => update("description", event.target.value)} /></div>
          {(kind === "organizer" || kind === "school" || kind === "instructor") && <div className="admin-entity-page__form-row">
            <div className="admin-field"><label htmlFor="entity-state">State / region</label><input id="entity-state" className="admin-input" value={form.state_region} onChange={(event) => update("state_region", event.target.value)} /></div>
            <div className="admin-field"><label htmlFor="entity-country">Country</label><input id="entity-country" className="admin-input" value={form.country} onChange={(event) => update("country", event.target.value)} /></div>
          </div>}
          {kind === "series" && <div className="admin-entity-page__form-row">
            <div className="admin-field"><label htmlFor="entity-venue">Default venue</label><select id="entity-venue" className="admin-select" value={form.venue_id} onChange={(event) => update("venue_id", event.target.value)}><option value="">No default venue</option>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></div>
            <div className="admin-field"><label htmlFor="entity-organizer">Default organizer</label><select id="entity-organizer" className="admin-select" value={form.organizer_id} onChange={(event) => update("organizer_id", event.target.value)}><option value="">No default organizer</option>{organizers.map((organizer) => <option key={organizer.id} value={organizer.id}>{organizer.name}</option>)}</select></div>
          </div>}
          {kind === "school" && <div className="admin-field"><label htmlFor="entity-address">Address</label><input id="entity-address" className="admin-input" value={form.address} onChange={(event) => update("address", event.target.value)} /></div>}
          {kind === "instructor" && <div className="admin-field"><label htmlFor="entity-organization">Organization</label><input id="entity-organization" className="admin-input" value={form.organization} onChange={(event) => update("organization", event.target.value)} /></div>}
          {kind === "organizer" && <div className="admin-field"><label htmlFor="entity-category">Category</label><input id="entity-category" className="admin-input" value={form.category} onChange={(event) => update("category", event.target.value)} /></div>}
          {kind === "school" && <div className="admin-field"><label htmlFor="entity-phone">Phone</label><input id="entity-phone" type="tel" className="admin-input" value={form.phone} onChange={(event) => update("phone", event.target.value)} /></div>}
          {kind !== "series" && <div className="admin-field"><label htmlFor="entity-website">Website</label><input id="entity-website" type="url" className="admin-input" value={form.website ?? ""} onChange={(event) => update("website", event.target.value)} /></div>}
          {kind !== "series" && <div className="admin-field"><label htmlFor="entity-instagram">Instagram</label><input id="entity-instagram" className="admin-input" value={form.instagram ?? ""} onChange={(event) => update("instagram", event.target.value)} /></div>}
          <div className="admin-field"><label htmlFor="entity-image">{kind === "organizer" ? "Logo URL" : "Image URL"}</label><input id="entity-image" type="url" className="admin-input" value={form.image_url ?? ""} onChange={(event) => update("image_url", event.target.value)} /></div>
        </fieldset>
        {validationError && <p className="admin-field__error" role="alert">{validationError}</p>}
        {actions.error && <p className="admin-field__error" role="alert">{actions.error}</p>}
        <div className="admin-form__actions"><button type="submit" className="admin-btn admin-btn--primary" disabled={actions.isSaving}>{creating ? "Continue to create" : "Save changes"}</button>{!creating && <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setEditing(false)}>Cancel</button>}</div>
      </form> : current && <>
        <section className="admin-card admin-entity-page__summary" aria-label={`${labels.singular} information`}>
          <span className={`admin-entity-page__status admin-entity-page__status--${current.status}`}>{current.status.replace(/_/g, " ")}</span>
          <p>{[current.city, current.slug ? `/${current.slug}` : null].filter(Boolean).join(" · ") || "No city or public URL"}</p>
          {current.description && <p>{current.description}</p>}
          {current.website && <p><a href={current.website} target="_blank" rel="noreferrer">Website ↗</a></p>}
          {current.instagram && <p>{current.instagram}</p>}
        </section>
        <section className="admin-card admin-entity-page__quality"><h2>Quality review</h2>{current.quality_issues.length ? <ul>{current.quality_issues.map((issue) => <li key={issue}>{qualityIssueLabel(issue)}</li>)}</ul> : <p>No quality issues detected.</p>}</section>
        <section className="admin-card admin-entity-page__linked"><h2>Linked events <span>({current.linked_events.length})</span></h2>{current.linked_events.length ? <ul>{current.linked_events.map((event) => <li key={event.id}><Link to={`/admin/events?edit=${event.id}`}>{event.title}</Link><span>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(event.event_date))} · {event.status}</span></li>)}</ul> : <p>No linked events.</p>}</section>
        {(kind === "school" || kind === "instructor") && current.id && <AdminEntityTeamSection kind={kind} id={current.id} />}
      </>}
      {pendingAction === "create" && <AdminConfirmDialog title={`Create ${labels.singular.toLowerCase()}?`} body={`Create “${form.name.trim()}” as an explicit ${labels.singular.toLowerCase()} record? No account or membership will be created.`} confirmLabel={`Create ${labels.singular.toLowerCase()}`} busyLabel="Creating…" isBusy={actions.isSaving} tone="neutral" error={actions.error} onConfirm={confirmAction} onCancel={() => setPendingAction(null)} />}
      {pendingAction === "archive" && current && <AdminConfirmDialog title={`Archive ${labels.singular.toLowerCase()}?`} body={`Archive “${current.name}”? This keeps the record and linked events but removes it from public active listings.`} confirmLabel={`Archive ${labels.singular.toLowerCase()}`} isBusy={actions.isSaving} error={actions.error} onConfirm={confirmAction} onCancel={() => setPendingAction(null)} />}
      {pendingAction === "merge" && current && <div className="admin-confirm-dialog__overlay" onClick={mergeDialog.onBackdropClick}>
        <section ref={mergeDialogRef} className="admin-confirm-dialog admin-card" role="dialog" aria-modal="true" aria-labelledby="entity-merge-title" onKeyDown={mergeDialog.onKeyDown} onClick={mergeDialog.onDialogClick}>
          <h2 id="entity-merge-title">Merge duplicate {labels.plural.toLowerCase()}?</h2>
          <p id="entity-merge-help">Choose the duplicate to archive and transfer its eligible event links to “{current.name}”. This does not transfer organizer memberships.</p>
          <label htmlFor="entity-merge-target">Duplicate {labels.singular.toLowerCase()}</label>
          <select id="entity-merge-target" className="admin-select" value={mergeId} onChange={(event) => setMergeId(event.target.value)} aria-describedby="entity-merge-help">
            <option value="">Choose a record</option>
            {candidates.filter((candidate) => candidate.id !== current.id && candidate.status !== "archived").map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.city ? ` — ${candidate.city}` : ""}</option>)}
          </select>
          {actions.error && <p className="admin-field__error" role="alert">{actions.error}</p>}
          <div className="admin-confirm-dialog__actions">
            <button ref={mergeCancelRef} type="button" className="admin-btn admin-btn--secondary" onClick={() => setPendingAction(null)} disabled={actions.isMerging}>Cancel</button>
            <button type="button" className="admin-btn admin-btn--danger" onClick={confirmAction} disabled={!mergeId || actions.isMerging}>{actions.isMerging ? "Merging…" : "Confirm merge"}</button>
          </div>
        </section>
      </div>}
    </div>
  );
}
