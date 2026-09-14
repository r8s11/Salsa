import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Sparkles, X } from "lucide-react";
import type { EventTaxonomyTerm } from "../../events/model/types";
import EventForm, { CAPABILITIES } from "../../events/components/EventForm";
import type { AdminEventForm } from "../model/adminEventForm";
import { validateAdminEventForm } from "../model/adminEventForm";
import { useActiveTaxonomyTerms } from "../hooks/useAdminTaxonomy";
import { useVenueCombobox } from "../hooks/useVenueCombobox";
import type { VenueRow } from "../model/venuesQuery";
import { venueDisplayAddress } from "../model/venuesQuery";
import EventFlyerField, { type EventFlyerStatus } from "../../events/components/EventFlyerField";
import FlyerExtractionPanel from "../../flyer-extraction/FlyerExtractionPanel";
import { extractEventFromFlyer } from "../../flyer-extraction/client";
import { applyExtractionToDraft, type PrefillResult } from "../../flyer-extraction/prefill";
import type { ExtractedEvent, FlyerExtractionStatus } from "../../flyer-extraction/types";
import { removeEventFlyer, uploadEventFlyer } from "../../events/api/eventFlyers";

import "./AdminEventEditor.css";

type Props = {
  initial: AdminEventForm;
  initialTaxonomyTerms: EventTaxonomyTerm[];
  heading: string;
  submitLabel: string;
  isSaving: boolean;
  error: string | null;
  eventId?: string;
  flyerOwnerId?: string | null;
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
  eventId: _eventId,
  flyerOwnerId,
  onSubmit,
  onCancel,
}: Props) {
  const [form, setForm] = useState(initial);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedFlyer, setSelectedFlyer] = useState<File | null>(null);
  const [flyerStatus, setFlyerStatus] = useState<EventFlyerStatus>(
    initial.image_url ? "uploaded" : "empty"
  );
  const [flyerError, setFlyerError] = useState<string | null>(null);
  const [extractionStatus, setExtractionStatus] = useState<FlyerExtractionStatus>("idle");
  const [extractionResult, setExtractionResult] = useState<ExtractedEvent | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [prefillFeedback, setPrefillFeedback] = useState<Pick<
    PrefillResult,
    "filled" | "skipped"
  > | null>(null);
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
  const handleFlyerChange = async (file: File | null) => {
    setExtractionStatus("idle");
    setExtractionResult(null);
    setExtractionError(null);
    setPrefillFeedback(null);
    setFlyerError(null);
    if (!file) {
      if (form.image_url) await removeEventFlyer(form.image_url).catch(() => undefined);
      setForm((current) => ({ ...current, image_url: "" }));
      setSelectedFlyer(null);
      setFlyerStatus("empty");
      return;
    }
    if (_eventId) {
      setSelectedFlyer(file);
      setFlyerStatus("empty");
      return;
    }
    // Flyer analysis only accepts objects stored under the caller's own user
    // id. A missing actor id (auth still resolving) would upload to a path no
    // analysis call can ever read, so fail loudly instead.
    if (!flyerOwnerId) {
      setFlyerStatus("upload-error");
      setFlyerError("Your admin session is still loading. Try the flyer again in a moment.");
      return;
    }
    setFlyerStatus("uploading");
    setSelectedFlyer(null);
    const previousUrl = form.image_url;
    try {
      const uploaded = await uploadEventFlyer({
        file,
        ownerId: flyerOwnerId,
        eventId: "admin-draft-" + crypto.randomUUID(),
      });
      if (previousUrl) void removeEventFlyer(previousUrl).catch(() => undefined);
      setForm((current) => ({ ...current, image_url: uploaded.url }));
      setFlyerStatus("uploaded");
    } catch (uploadError) {
      setFlyerStatus("upload-error");
      setFlyerError(
        uploadError instanceof Error ? uploadError.message : "Unable to upload this flyer."
      );
    }
  };
  const handleExtractFlyer = async () => {
    if (!form.image_url || extractionStatus === "loading") return;
    setExtractionStatus("loading");
    setExtractionError(null);
    try {
      const result = await extractEventFromFlyer(form.image_url);
      setExtractionResult(result);
      setPrefillFeedback(null);
      setExtractionStatus("success");
    } catch (extractError) {
      setExtractionStatus("error");
      setExtractionError(
        extractError instanceof Error ? extractError.message : "Unable to read this flyer."
      );
    }
  };
  const applyExtraction = () => {
    if (!extractionResult) return;
    const applied = applyExtractionToDraft(extractionResult, form);
    setForm(applied.draft);
    setPrefillFeedback({ filled: applied.filled, skipped: applied.skipped });
  };
  const dismissExtractionError = () => {
    setExtractionStatus("idle");
    setExtractionError(null);
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
            <EventFlyerField
              currentUrl={form.image_url || null}
              onFileChange={(file) => void handleFlyerChange(file)}
              onRemove={() => void handleFlyerChange(null)}
              status={flyerStatus}
              errorMessage={flyerError}
              disabled={isSaving}
            />
            {form.image_url && extractionStatus === "idle" && (
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => void handleExtractFlyer()}
                disabled={isSaving || flyerStatus !== "uploaded"}
              >
                <Sparkles size={16} aria-hidden /> Analyze flyer
              </button>
            )}
            {extractionStatus !== "idle" && (
              <>
                <FlyerExtractionPanel
                  status={extractionStatus}
                  result={extractionResult}
                  error={extractionError}
                  onRetry={() => void handleExtractFlyer()}
                  onDismiss={dismissExtractionError}
                />
                {extractionStatus === "success" && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    onClick={applyExtraction}
                  >
                    Use These Details
                  </button>
                )}
                {extractionStatus === "success" && prefillFeedback && (
                  <div className="admin-banner" role="status">
                    {prefillFeedback.filled.length > 0
                      ? "Filled " +
                        prefillFeedback.filled.join(", ").toLowerCase() +
                        " from your flyer — review below."
                      : "No details were found; continue manually."}
                    {prefillFeedback.skipped.length > 0 &&
                      " Could not determine: " +
                        prefillFeedback.skipped.join(", ").toLowerCase() +
                        "."}
                  </div>
                )}
              </>
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
