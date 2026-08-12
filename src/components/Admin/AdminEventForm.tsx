import { useState } from "react";
import type { FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import type { AdminEventForm as AdminEventFormValues } from "../../features/admin/model/adminEventForm";
import { validateAdminEventForm } from "../../features/admin/model/adminEventForm";
import "./AdminEventForm.css";

interface AdminEventFormProps {
  initial: AdminEventFormValues;
  heading: string;
  submitLabel: string;
  isSaving: boolean;
  error: string | null;
  onSubmit: (form: AdminEventFormValues) => void;
  onCancel: () => void;
}

const DANCE_STYLE_OPTIONS = [
  { value: "salsa", label: "Salsa" },
  { value: "bachata", label: "Bachata" },
  { value: "kizomba", label: "Kizomba" },
  { value: "merengue", label: "Merengue" },
  { value: "cha-cha", label: "Cha-Cha" },
  { value: "zouk", label: "Zouk" },
  { value: "afro-cuban", label: "Afro-Cuban" },
];

const IMAGE_URL_MAX_LENGTH = 2000;

function isValidImageUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export default function AdminEventForm({
  initial,
  heading,
  submitLabel,
  isSaving,
  error,
  onSubmit,
  onCancel,
}: AdminEventFormProps) {
  const [form, setForm] = useState<AdminEventFormValues>(initial);
  const [validationError, setValidationError] = useState<string | null>(null);

  const update = (field: keyof AdminEventFormValues, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setValidationError(null);
  };

  const updateDanceStyles = (styles: string[]) => {
    setForm((previous) => ({ ...previous, dance_styles: styles }));
    setValidationError(null);
  };

  const toggleDanceStyle = (style: string) => {
    const current = form.dance_styles ?? [];
    const updated = current.includes(style)
      ? current.filter((s) => s !== style)
      : [...current, style];
    updateDanceStyles(updated);
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

  const bannerMessage = validationError || error;

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <div className="admin-form__header">
        <h2>{heading}</h2>
      </div>

      {bannerMessage && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>{bannerMessage}</p>
        </div>
      )}

      <fieldset className="admin-form__fieldset">
        <legend>Event details</legend>

        <div className="admin-field">
          <label htmlFor="title">Event Title *</label>
          <input
            id="title"
            type="text"
            className="admin-input"
            placeholder="e.g. Friday Night Salsa Social"
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            required
          />
        </div>

        <div className="admin-form__row">
          <div className="admin-field">
            <label htmlFor="event_type">Event Type *</label>
            <div className="admin-select-wrap">
              <select
                id="event_type"
                className="admin-select"
                value={form.event_type}
                onChange={(event) => update("event_type", event.target.value)}
                required
              >
                <option value="">Select type</option>
                <option value="social">Social Dance</option>
                <option value="class">Class</option>
                <option value="workshop">Workshop</option>
              </select>
              <ChevronDown size={16} />
            </div>
          </div>
          <div className="admin-field">
            <label htmlFor="city">City *</label>
            <div className="admin-select-wrap">
              <select
                id="city"
                className="admin-select"
                value={form.city}
                onChange={(event) => update("city", event.target.value)}
                required
              >
                <option value="boston">Boston</option>
                <option value="new-york-city">New York City</option>
              </select>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        <div className="admin-form__row">
          <div className="admin-field">
            <label htmlFor="event_date">Date *</label>
            <input
              id="event_date"
              type="date"
              className="admin-input"
              value={form.event_date}
              onChange={(event) => update("event_date", event.target.value)}
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="event_time">Start Time</label>
            <input
              id="event_time"
              type="time"
              className="admin-input"
              value={form.event_time}
              onChange={(event) => update("event_time", event.target.value)}
            />
          </div>
        </div>

        <div className="admin-field admin-field--checkbox">
          <label>
            <input
              type="checkbox"
              checked={form.recurrence === "weekly"}
              onChange={(event) => update("recurrence", event.target.checked ? "weekly" : "")}
            />
            This is a weekly recurring event
          </label>
        </div>

        <div className="admin-field">
          <label>Dance Styles</label>
          <p className="admin-form__helper">
            Select all that apply ({DANCE_STYLE_OPTIONS.length} available)
          </p>
          <div className="admin-dance-styles-grid">
            {DANCE_STYLE_OPTIONS.map((style) => {
              const checked = (form.dance_styles ?? []).includes(style.value);
              return (
                <label key={style.value} className="admin-dance-style-chip">
                  <input
                    type="checkbox"
                    value={style.value}
                    checked={checked}
                    onChange={() => toggleDanceStyle(style.value)}
                  />
                  {style.label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="admin-field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            className="admin-textarea"
            placeholder="Tell people what to expect..."
            rows={4}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="admin-form__fieldset">
        <legend>Location</legend>

        <div className="admin-field">
          <label htmlFor="location">Venue Name</label>
          <input
            id="location"
            type="text"
            className="admin-input"
            placeholder="e.g. Havana Club"
            value={form.location}
            onChange={(event) => update("location", event.target.value)}
          />
        </div>

        <div className="admin-field">
          <label htmlFor="address">Address</label>
          <input
            id="address"
            type="text"
            className="admin-input"
            placeholder="e.g. 288 Green St, Cambridge, MA"
            value={form.address}
            onChange={(event) => update("address", event.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="admin-form__fieldset">
        <legend>Pricing &amp; link</legend>

        <div className="admin-form__row">
          <div className="admin-field">
            <label htmlFor="price_type">Price</label>
            <div className="admin-select-wrap">
              <select
                id="price_type"
                className="admin-select"
                value={form.price_type}
                onChange={(event) => update("price_type", event.target.value)}
              >
                <option value="">Select</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
              <ChevronDown size={16} />
            </div>
          </div>

          {form.price_type === "paid" && (
            <div className="admin-field">
              <label htmlFor="price_amount">Amount ($)</label>
              <input
                id="price_amount"
                type="number"
                className="admin-input"
                min="0"
                step="0.01"
                placeholder="15.00"
                value={form.price_amount}
                onChange={(event) => update("price_amount", event.target.value)}
              />
            </div>
          )}
        </div>

        <div className="admin-field">
          <label htmlFor="rsvp_link">RSVP / Event Link</label>
          <input
            id="rsvp_link"
            type="url"
            className="admin-input"
            placeholder="https://..."
            value={form.rsvp_link}
            onChange={(event) => update("rsvp_link", event.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="admin-form__fieldset">
        <legend>Presentation</legend>

        <div className="admin-field">
          <label htmlFor="host">Host</label>
          <input
            id="host"
            type="text"
            className="admin-input"
            value={form.host}
            onChange={(event) => update("host", event.target.value)}
          />
        </div>

        <div className="admin-field">
          <label htmlFor="image_url">Image URL</label>
          <input
            id="image_url"
            type="url"
            className="admin-input"
            placeholder="https://..."
            maxLength={IMAGE_URL_MAX_LENGTH}
            value={form.image_url}
            onChange={(event) => update("image_url", event.target.value)}
          />
          {form.image_url && isValidImageUrl(form.image_url) && (
            <div className="admin-image-preview">
              <img
                src={form.image_url}
                alt="Event flyer preview"
                className="admin-image-preview__img"
              />
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className="admin-form__fieldset">
        <legend>Contact</legend>
        <p className="admin-form__helper">Shown publicly on approved events.</p>

        <div className="admin-field">
          <label htmlFor="contact_email">Contact email</label>
          <input
            id="contact_email"
            type="email"
            className="admin-input"
            value={form.contact_email}
            onChange={(event) => update("contact_email", event.target.value)}
          />
        </div>

        <div className="admin-field">
          <label htmlFor="contact_instagram">Instagram</label>
          <input
            id="contact_instagram"
            type="text"
            className="admin-input"
            placeholder="@handle"
            value={form.contact_instagram}
            onChange={(event) => update("contact_instagram", event.target.value)}
          />
        </div>

        <div className="admin-field">
          <label htmlFor="contact_website">Website</label>
          <input
            id="contact_website"
            type="url"
            className="admin-input"
            placeholder="https://..."
            value={form.contact_website}
            onChange={(event) => update("contact_website", event.target.value)}
          />
        </div>
      </fieldset>

      <div className="admin-form__actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={isSaving}>
          {isSaving ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="admin-btn admin-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
