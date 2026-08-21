import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { ChevronDown, MapPin, X } from "lucide-react";
import type { AdminEventForm as AdminEventFormValues } from "../../features/admin/model/adminEventForm";
import type { EventTaxonomyTerm } from "../../features/events/model/types";
import { validateAdminEventForm } from "../../features/admin/model/adminEventForm";
import { venueDisplayAddress } from "../../features/admin/model/venuesQuery";
import { useVenueCombobox } from "../../features/admin/hooks/useVenueCombobox";
import { useActiveTaxonomyTerms } from "../../features/admin/hooks/useAdminTaxonomy";
import type { VenueRow } from "../../features/admin/model/venuesQuery";
import EventFlyerField from "../../features/events/components/EventFlyerField";
import "./AdminEventForm.css";

interface AdminEventFormProps {
  initialTaxonomyTerms?: EventTaxonomyTerm[];
  initial: AdminEventFormValues;
  heading: string;
  submitLabel: string;
  isSaving: boolean;
  error: string | null;
  eventId?: string;
  onSubmit: (form: AdminEventFormValues, flyer: File | null) => void | Promise<void>;
  onCancel: () => void;
}


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
  initialTaxonomyTerms = [],
  heading,
  submitLabel,
  isSaving,
  error,
  eventId,
  onSubmit,
  onCancel,
}: AdminEventFormProps) {
  const [form, setForm] = useState<AdminEventFormValues>(initial);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFlyer, setSelectedFlyer] = useState<File | null>(null);
  const venueCombobox = useVenueCombobox(form.venue_id);
  const { clearVenue, results, selectVenue, selectedId } = venueCombobox;
  const danceStyles = useActiveTaxonomyTerms("dance_style");
  const eventAttributes = useActiveTaxonomyTerms("event_attribute");
  const archivedAttachments = initialTaxonomyTerms.filter(
    (term) => term.status !== "active" && form.taxonomy_term_ids.includes(term.id),
  );

  // Sync the combobox selection when the form's venue_id changes externally
  // (e.g. the user clears the venue, or the form is reset with new initial data).
  useEffect(() => {
    if (form.venue_id && form.venue_id !== selectedId) {
      const existing = results.find((v) => v.id === form.venue_id);
      if (existing) selectVenue(existing);
    }
    if (!form.venue_id && selectedId) {
      clearVenue();
    }
  }, [clearVenue, form.venue_id, results, selectVenue, selectedId]);

  const update = (field: keyof AdminEventFormValues, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setValidationError(null);
  };

  const handleVenueSelect = (venue: VenueRow) => {
    venueCombobox.selectVenue(venue);
    setForm((previous) => ({
      ...previous,
      venue_id: venue.id,
      location: venue.name,
      address: venueDisplayAddress(venue) || venue.address_line1 || "",
    }));
    setValidationError(null);
  };

  const handleVenueClear = () => {
    venueCombobox.clearVenue();
    setForm((previous) => ({ ...previous, venue_id: "", location: "", address: "" }));
    setValidationError(null);
  };

  const toggleTaxonomyTerm = (termId: string) => {
    const current = form.taxonomy_term_ids;
    const updated = current.includes(termId)
      ? current.filter((id) => id !== termId)
      : [...current, termId];
    setForm((previous) => ({ ...previous, taxonomy_term_ids: updated }));
    setValidationError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || isSubmitting) return;

    const nextError = validateAdminEventForm(form);
    if (nextError) {
      setValidationError(nextError);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(form, selectedFlyer);
    } catch (submissionError) {
      setValidationError(
        submissionError instanceof Error ? submissionError.message : "Unable to save event."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBusy = isSaving || isSubmitting;
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

        {archivedAttachments.length > 0 && (
          <div className="admin-banner">
            <strong>Archived existing terms</strong>
            <ul>{archivedAttachments.map((term) => <li key={term.id}>{term.name} (Archived)</li>)}</ul>
          </div>
        )}

        {[
          { legend: "Dance Styles", category: "dance_style", query: danceStyles, empty: "No active dance styles available" },
          { legend: "Event Attributes", category: "event_attribute", query: eventAttributes, empty: "No active event attributes available" },
        ].map(({ legend, category, query, empty }) => (
          <fieldset className="admin-form__fieldset" key={category}>
            <legend>{legend}</legend>
            {query.isLoading ? (
              <p>Loading {legend.toLowerCase()}…</p>
            ) : query.error ? (
              <p role="alert">{query.error}</p>
            ) : query.terms.length === 0 ? (
              <p>{empty}</p>
            ) : (
              <div className="admin-dance-styles-grid">
                {query.terms.map((term) => (
                  <label key={term.id} className="admin-dance-style-chip">
                    <input
                      type="checkbox"
                      value={term.id}
                      checked={form.taxonomy_term_ids.includes(term.id)}
                      onChange={() => toggleTaxonomyTerm(term.id)}
                    />
                    {term.name}
                  </label>
                ))}
              </div>
            )}
            <Link to={`/admin/tags/new?category=${category}`}>Create term</Link>
          </fieldset>
        ))}

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

        {venueCombobox.selectedId ? (
          <div className="admin-field admin-event-form__venue-selected">
            <div className="admin-event-form__venue-info">
              <MapPin size={16} />
              <div>
                <strong>{venueCombobox.selectedName}</strong>
                {venueCombobox.selectedAddress && (
                  <p className="admin-form__helper">{venueCombobox.selectedAddress}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              className="admin-icon-btn"
              aria-label="Change venue"
              onClick={handleVenueClear}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="admin-field admin-event-form__venue-combobox">
            <label htmlFor="venue-search">Venue</label>
            <div className="admin-event-form__venue-combobox-wrap">
              <input
                id="venue-search"
                type="search"
                className="admin-input"
                placeholder="Search for a venue…"
                value={venueCombobox.query}
                onChange={(e) => venueCombobox.setQuery(e.target.value)}
                onFocus={() => venueCombobox.setIsOpen(true)}
                aria-autocomplete="list"
                aria-expanded={venueCombobox.isOpen}
                aria-controls="venue-results"
              />
              {venueCombobox.isOpen && venueCombobox.results.length > 0 && (
                <ul
                  id="venue-results"
                  className="admin-event-form__venue-results"
                  role="listbox"
                >
                  {venueCombobox.results.map((venue) => (
                    <li key={venue.id} role="option">
                      <button
                        type="button"
                        className="admin-event-form__venue-result"
                        onClick={() => handleVenueSelect(venue)}
                      >
                        <div>
                          <strong>{venue.name}</strong>
                          <p className="admin-form__helper">
                            {venueDisplayAddress(venue) || "No address"}
                          </p>
                        </div>
                        {venue.quality_issues && venue.quality_issues.length > 0 && (
                          <span className="admin-event-form__venue-warning" aria-label="Quality issues">
                            ⚠
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

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
        {eventId && (
          <EventFlyerField
            currentUrl={form.image_url || null}
            file={selectedFlyer}
            onFileChange={setSelectedFlyer}
            disabled={isBusy}
          />
        )}
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
        <button type="submit" className="admin-btn admin-btn--primary" disabled={isBusy}>
          {isBusy ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          onClick={onCancel}
          disabled={isBusy}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
