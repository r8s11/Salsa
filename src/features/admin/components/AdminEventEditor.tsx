import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, X } from "lucide-react";
import type { EventTaxonomyTerm } from "../../events/model/types";
import EventForm, { CAPABILITIES } from "../../events/components/EventForm";
import type { AdminEventForm } from "../model/adminEventForm";
import { validateAdminEventForm } from "../model/adminEventForm";
import { useActiveTaxonomyTerms } from "../hooks/useAdminTaxonomy";
import { useVenueCombobox } from "../hooks/useVenueCombobox";
import type { VenueRow } from "../model/venuesQuery";
import { venueDisplayAddress } from "../model/venuesQuery";
import EventFlyerField from "../../events/components/EventFlyerField";

import "./AdminEventEditor.css";

type Props = {
  initial: AdminEventForm;
  initialTaxonomyTerms: EventTaxonomyTerm[];
  heading: string;
  submitLabel: string;
  isSaving: boolean;
  error: string | null;
  eventId?: string;
  onSubmit: (form: AdminEventForm, flyer: File | null) => Promise<void>;
  onCancel: () => void;
};

export default function AdminEventEditor({
  initial,
  initialTaxonomyTerms,
  heading,
  submitLabel,
  isSaving,
  error,
  eventId,
  onSubmit,
  onCancel,
}: Props) {
  const [form, setForm] = useState(initial);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedFlyer, setSelectedFlyer] = useState<File | null>(null);
  const venueCombobox = useVenueCombobox(form.venue_id);
  const danceStyles = useActiveTaxonomyTerms("dance_style");
  const attributes = useActiveTaxonomyTerms("event_attribute");
  const archived = initialTaxonomyTerms.filter(
    (term) => term.status !== "active" && form.taxonomy_term_ids.includes(term.id)
  );

  useEffect(() => {
    if (!form.venue_id && venueCombobox.selectedId) venueCombobox.clearVenue();
    if (form.venue_id && form.venue_id !== venueCombobox.selectedId) {
      const existing = venueCombobox.results.find((venue) => venue.id === form.venue_id);
      if (existing) venueCombobox.selectVenue(existing);
    }
  }, [form.venue_id, venueCombobox]);

  const selectVenue = (venue: VenueRow) => {
    venueCombobox.selectVenue(venue);
    setForm((current) => ({
      ...current,
      venue_id: venue.id,
      location: venue.name,
      address: venueDisplayAddress(venue) || venue.address_line1 || "",
    }));
  };
  const clearVenue = () => {
    venueCombobox.clearVenue();
    setForm((current) => ({ ...current, venue_id: "", location: "", address: "" }));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    const nextError = validateAdminEventForm(form);
    if (nextError) {
      setValidationError(nextError);
      return;
    }
    setValidationError(null);
    try {
      await onSubmit(form, selectedFlyer);
    } catch (submissionError) {
      setValidationError(
        submissionError instanceof Error ? submissionError.message : "Unable to save event."
      );
    }
  };

  return (
    <form className="admin-form admin-event-editor" onSubmit={submit}>
      <div className="admin-form__header">
        <h2>{heading}</h2>
      </div>
      {(validationError || error) && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>{validationError || error}</p>
        </div>
      )}
      <EventForm
        draft={form}
        onChange={setForm}
        capabilities={CAPABILITIES.admin}
        taxonomyTerms={{ danceStyles: danceStyles.terms, attributes: attributes.terms, archived }}
        renderVenueField={() => (
          <>
            <>
              {venueCombobox.selectedId ? (
                <div className="admin-event-form__venue-selected">
                  <div>
                    <MapPin size={16} />
                    <strong>{venueCombobox.selectedName}</strong>
                    <p>{venueCombobox.selectedAddress}</p>
                  </div>
                  <button type="button" aria-label="Change venue" onClick={clearVenue}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="admin-event-form__venue-combobox">
                  <label htmlFor="venue-search">Venue</label>
                  <input
                    id="venue-search"
                    type="search"
                    value={venueCombobox.query}
                    onChange={(event) => venueCombobox.setQuery(event.target.value)}
                    onFocus={() => venueCombobox.setIsOpen(true)}
                    aria-autocomplete="list"
                    aria-expanded={venueCombobox.isOpen}
                    aria-controls="venue-results"
                  />
                  {venueCombobox.isOpen && venueCombobox.results.length > 0 && (
                    <ul id="venue-results" role="listbox">
                      {venueCombobox.results.map((venue) => (
                        <li key={venue.id} role="option">
                          <button type="button" onClick={() => selectVenue(venue)}>
                            <strong>{venue.name}</strong>
                            <p>{venueDisplayAddress(venue) || "No address"}</p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
            <label>
              Venue name
              <input
                value={form.location}
                onChange={(event) =>
                  setForm((current) => ({ ...current, location: event.target.value }))
                }
              />
            </label>
            <label>
              Address
              <input
                value={form.address}
                onChange={(event) =>
                  setForm((current) => ({ ...current, address: event.target.value }))
                }
              />
            </label>
          </>
        )}
        renderFlyerField={() => (
          <>
            <label>
              Image URL
              <input
                type="url"
                value={form.image_url}
                onChange={(event) =>
                  setForm((current) => ({ ...current, image_url: event.target.value }))
                }
              />
            </label>
            {eventId && (
              <EventFlyerField
                currentUrl={form.image_url || null}
                onFileChange={setSelectedFlyer}
                disabled={isSaving}
              />
            )}
          </>
        )}
      />
      <p>
        <Link to="/admin/tags/new?category=dance_style">Create dance style</Link> ·{" "}
        <Link to="/admin/tags/new?category=event_attribute">Create attribute</Link>
      </p>
      <div className="admin-form__actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={isSaving}>
          {isSaving ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
