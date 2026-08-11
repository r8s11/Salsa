import { FormEvent, useState } from "react";
import type { AdminEventForm } from "../../features/admin/model/adminEventForm";
import { validateAdminEventForm } from "../../features/admin/model/adminEventForm";
import EventDetailsFieldset from "../../features/submit-event/components/EventDetailsFieldset";
import LocationFieldset from "../../features/submit-event/components/LocationFieldset";
import PricingFieldset from "../../features/submit-event/components/PricingFieldset";
import type { SubmitForm } from "../../features/submit-event/validation";
import "../../styles/forms.css";

interface Props {
  initial: AdminEventForm;
  heading: string;
  submitLabel: string;
  isSaving: boolean;
  error: string | null;
  onSubmit: (form: AdminEventForm) => void;
  onCancel: () => void;
}

export default function AdminEventFormPanel({
  initial,
  heading,
  submitLabel,
  isSaving,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const [form, setForm] = useState<AdminEventForm>(initial);
  const [validationError, setValidationError] = useState<string | null>(null);

  const update = (field: keyof AdminEventForm, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setValidationError(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextError = validateAdminEventForm(form);
    if (nextError) {
      setValidationError(nextError);
      return;
    }
    onSubmit(form);
  };

  const submitForm = form satisfies SubmitForm;

  return (
    <section className="admin-event-form-panel">
      <div className="admin-event-form-panel__header">
        <h2>{heading}</h2>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
      {(validationError || error) && (
        <div className="error-banner" role="alert">
          <p>{validationError || error}</p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="submit-form">
        <EventDetailsFieldset form={submitForm} update={update} />
        <LocationFieldset form={submitForm} update={update} />
        <PricingFieldset form={submitForm} update={update} />

        <fieldset>
          <legend>Presentation</legend>
          <div className="form-group">
            <label htmlFor="host">Host</label>
            <input id="host" type="text" value={form.host} onChange={(event) => update("host", event.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="image_url">Image URL</label>
            <input id="image_url" type="url" placeholder="https://..." value={form.image_url} onChange={(event) => update("image_url", event.target.value)} />
          </div>
        </fieldset>

        <fieldset>
          <legend>Contact</legend>
          <p className="admin-event-form-panel__helper">Shown publicly on approved events.</p>
          <div className="form-group">
            <label htmlFor="contact_email">Contact email</label>
            <input id="contact_email" type="email" value={form.contact_email} onChange={(event) => update("contact_email", event.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="contact_instagram">Instagram</label>
            <input id="contact_instagram" type="text" placeholder="@handle" value={form.contact_instagram} onChange={(event) => update("contact_instagram", event.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="contact_website">Website</label>
            <input id="contact_website" type="url" placeholder="https://..." value={form.contact_website} onChange={(event) => update("contact_website", event.target.value)} />
          </div>
        </fieldset>

        <div className="admin-event-form-panel__actions">
          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? "Saving…" : submitLabel}
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </section>
  );
}
