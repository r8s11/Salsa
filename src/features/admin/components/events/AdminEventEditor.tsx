import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Sparkles } from "lucide-react";
import AdminConfirmDialog from "../common/AdminConfirmDialog";
import { fetchAdminEntityDirectory } from "../../entities/api/entitiesRepo";
import type { AdminEntityRow } from "../../entities/model";
import type { EventTaxonomyTerm } from "../../../events/model/types";
import EventForm, { CAPABILITIES } from "../../../events/components/EventForm";
import type { AdminEventForm } from "../../model/adminEventForm";
import { validateAdminEventForm } from "../../model/adminEventForm";
import { useActiveTaxonomyTerms } from "../../hooks/useAdminTaxonomy";
import { useVenueCombobox } from "../../hooks/useVenueCombobox";
import type { VenueRow } from "../../model/venuesQuery";
import { venueDisplayAddress } from "../../model/venuesQuery";
import EventFlyerField, { type EventFlyerStatus } from "../../../events/components/EventFlyerField";
import FlyerExtractionPanel from "../../../flyer-extraction/FlyerExtractionPanel";
import { extractEventFromFlyer } from "../../../flyer-extraction/client";
import { applyExtractionToDraft, type PrefillResult } from "../../../flyer-extraction/prefill";
import EntityReviewSection from "../../../entity-matching/EntityReviewSection";
import { reconcileEntities } from "../../../entity-matching/entityReviewClient";
import {
  emptyEntityReview,
  extractionEntityCandidates,
  hasEntityCandidates,
  mergeEntityReview,
  type EntityCandidates,
  type EntityReview,
} from "../../../entity-matching/entityReview";
import {
  detachAutoVenueLink,
  enrichExtractionWithReview,
  listReviewEntries,
  reviewFromCandidates,
  suppressAutoVenueLink,
} from "../../../entity-matching/entityReviewState";
import type { ExtractedEvent, FlyerExtractionStatus } from "../../../flyer-extraction/types";
import { useMetros } from "../../../metros/hooks/useMetros";
import { removeEventFlyer, uploadEventFlyer } from "../../../events/api/eventFlyers";

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
  const { metros } = useMetros();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [venueActive, setVenueActive] = useState(-1);
  const [series, setSeries] = useState<AdminEntityRow[]>([]);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchAdminEntityDirectory({ kind: "series" })
      .then((rows) => {
        if (!cancelled) setSeries(rows);
      })
      .catch((loadError: unknown) => {
        if (!cancelled)
          setSeriesError(
            loadError instanceof Error ? loadError.message : "Unable to load event series."
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [form, setForm] = useState(initial);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedFlyer, setSelectedFlyer] = useState<File | null>(null);
  const [flyerStatus, setFlyerStatus] = useState<EventFlyerStatus>(
    initial.image_url ? "uploaded" : "empty"
  );
  const [flyerError, setFlyerError] = useState<string | null>(null);
  const [extractionAttempts, setExtractionAttempts] = useState(0);
  const [extractionStatus, setExtractionStatus] = useState<FlyerExtractionStatus>("idle");
  const [extractionResult, setExtractionResult] = useState<ExtractedEvent | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [prefillFeedback, setPrefillFeedback] = useState<Pick<
    PrefillResult,
    "filled" | "skipped"
  > | null>(null);
  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  }, [form]);
  const extractionGeneration = useRef(0);
  const isExtracting = useRef(false);
  // What the last extraction proposed, so a repeat extraction can tell
  // untouched candidates (replaced) from edited ones (kept).
  const lastCandidatesRef = useRef<EntityCandidates | null>(null);
  // An existing event already has a chosen city; for a new one, the first
  // manual city change locks it against later extractions.
  const cityChosenRef = useRef(Boolean(_eventId));
  const [reconciliation, setReconciliation] = useState<{ status: "idle" | "loading" | "error" }>({
    status: "idle",
  });
  const handleFormChange = (draft: AdminEventForm) => {
    if (draft.city !== formRef.current.city) cityChosenRef.current = true;
    updateForm(() => draft);
  };
  // Every edit to the event's own venue goes through here so an automatic
  // flyer-venue link is detached when the admin changes the venue.
  const updateForm = (change: (current: AdminEventForm) => AdminEventForm) => {
    setForm((current) => detachAutoVenueLink(current, change(current)));
  };
  const resetExtraction = () => {
    extractionGeneration.current += 1;
    isExtracting.current = false;
    setExtractionStatus("idle");
    setExtractionResult(null);
    setExtractionError(null);
    setExtractionAttempts(0);
    setPrefillFeedback(null);
    setReconciliation({ status: "idle" });
    // The flyer that produced these candidates is changing; untouched ones go
    // with it, edited or decided ones stay.
    const previous = lastCandidatesRef.current;
    setForm((current) => {
      if (!current.entity_review) return current;
      const pruned = mergeEntityReview(current.entity_review, previous, emptyEntityReview());
      return {
        ...current,
        entity_review: listReviewEntries(pruned).length > 0 ? pruned : undefined,
      };
    });
  };
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
    updateForm((current) => ({
      ...current,
      venue_id: venue.id,
      location: venue.name,
      address: venueDisplayAddress(venue) || venue.address_line1 || "",
    }));
  };
  const clearVenue = () => {
    venueCombobox.clearVenue();
    updateForm((current) => ({ ...current, venue_id: "", location: "", address: "" }));
  };
  const handleFlyerChange = async (file: File | null) => {
    resetExtraction();
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
    if (!form.image_url || isExtracting.current) return;
    if (extractionAttempts >= 3) return;
    const imageUrl = form.image_url;
    isExtracting.current = true;
    const generation = ++extractionGeneration.current;
    const stale = () => extractionGeneration.current !== generation;
    setExtractionAttempts((attempt) => attempt + 1);
    setExtractionStatus("loading");
    setExtractionError(null);
    try {
      const result = await extractEventFromFlyer(imageUrl);
      if (stale()) return;
      setExtractionResult(result);
      setPrefillFeedback(null);
      const candidates = extractionEntityCandidates(result);
      let incoming: EntityReview = emptyEntityReview();
      if (hasEntityCandidates(candidates)) {
        setReconciliation({ status: "loading" });
        try {
          incoming = await reconcileEntities(candidates);
          if (stale()) return;
          setReconciliation({ status: "idle" });
        } catch {
          if (stale()) return;
          incoming = reviewFromCandidates(candidates);
          setReconciliation({ status: "error" });
        }
      }
      // Merge against the form as it is now, after every await, so edits and
      // decisions made while the flyer was read are kept.
      const existing = formRef.current.entity_review;
      // A link the matcher made on its own never overrides a venue the admin
      // already picked or typed; only an explicit choice does.
      const review = suppressAutoVenueLink(
        existing ? mergeEntityReview(existing, lastCandidatesRef.current, incoming) : incoming,
        formRef.current
      );
      lastCandidatesRef.current = candidates;
      setForm((current) => ({
        ...current,
        entity_review: listReviewEntries(review).length > 0 ? review : undefined,
      }));
      setExtractionStatus("success");
    } catch (extractError) {
      if (stale()) return;
      setExtractionStatus("error");
      setExtractionError(
        extractError instanceof Error ? extractError.message : "Unable to read this flyer."
      );
    } finally {
      if (!stale()) isExtracting.current = false;
    }
  };
  const applyExtraction = () => {
    if (!extractionResult) return;
    const applied = applyExtractionToDraft(
      enrichExtractionWithReview(extractionResult, form.entity_review),
      form,
      metros,
      { preserveCity: cityChosenRef.current }
    );
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

  // The banner sits above a long form and Save sits below it: bring the
  // message to the person instead of leaving it off-screen.
  const bannerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (validationError || error) bannerRef.current?.focus();
  }, [validationError, error]);

  const requestCancel = () => {
    const dirty = selectedFlyer !== null || JSON.stringify(form) !== JSON.stringify(initial);
    if (dirty) setDiscardOpen(true);
    else onCancel();
  };

  const venueListOpen = venueCombobox.isOpen && venueCombobox.results.length > 0;
  const handleVenueKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = venueCombobox.results.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (count === 0) return;
      event.preventDefault();
      venueCombobox.setIsOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setVenueActive((current) => (current + step + count) % count);
    } else if (event.key === "Enter" && venueListOpen && venueActive >= 0) {
      event.preventDefault();
      selectVenue(venueCombobox.results[venueActive]);
    } else if (event.key === "Escape" && venueListOpen) {
      event.preventDefault();
      event.stopPropagation();
      venueCombobox.setIsOpen(false);
    }
  };

  return (
    <>
      <form className="admin-form admin-event-editor" onSubmit={submit}>
        <div className="admin-form__header">
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-event-editor__back"
            onClick={requestCancel}
            disabled={isSaving}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Events
          </button>
          <h1>{heading}</h1>
        </div>
        {(validationError || error) && (
          <div
            ref={bannerRef}
            tabIndex={-1}
            className="admin-banner admin-banner--error"
            role="alert"
          >
            <p>{validationError || error}</p>
          </div>
        )}
        <EventForm
          draft={form}
          onChange={handleFormChange}
          capabilities={CAPABILITIES.admin}
          taxonomyTerms={{ danceStyles: danceStyles.terms, attributes: attributes.terms, archived }}
          flyerFirst
          renderVenueField={() => (
            <>
              {venueCombobox.selectedId ? (
                <div className="admin-event-form__venue-selected">
                  <div>
                    <MapPin size={16} aria-hidden="true" />
                    <strong>{venueCombobox.selectedName}</strong>
                    <p>{venueCombobox.selectedAddress}</p>
                  </div>
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost"
                    aria-label="Change venue"
                    onClick={clearVenue}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="admin-event-form__venue-combobox">
                  <label htmlFor="venue-search">Venue</label>
                  <input
                    id="venue-search"
                    type="search"
                    role="combobox"
                    value={venueCombobox.query}
                    onChange={(event) => {
                      setVenueActive(-1);
                      venueCombobox.setQuery(event.target.value);
                      venueCombobox.setIsOpen(true);
                    }}
                    onFocus={() => venueCombobox.setIsOpen(true)}
                    onBlur={() => venueCombobox.setIsOpen(false)}
                    onKeyDown={handleVenueKeyDown}
                    aria-autocomplete="list"
                    aria-expanded={venueListOpen}
                    aria-controls="venue-results"
                    aria-activedescendant={
                      venueListOpen && venueActive >= 0
                        ? `venue-option-${venueCombobox.results[venueActive]?.id}`
                        : undefined
                    }
                  />
                  {venueListOpen && (
                    <ul id="venue-results" role="listbox" aria-label="Matching venues">
                      {venueCombobox.results.map((venue, index) => (
                        <li
                          key={venue.id}
                          id={`venue-option-${venue.id}`}
                          role="option"
                          aria-selected={index === venueActive}
                          // Keeps focus in the input so blur does not close the list first.
                          onMouseDown={(event) => {
                            event.preventDefault();
                            selectVenue(venue);
                          }}
                        >
                          <strong>{venue.name}</strong>
                          <span>{venueDisplayAddress(venue) || "No address"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <label>
                Venue name
                <input
                  id="event-location"
                  name="location"
                  value={form.location}
                  onChange={(event) =>
                    updateForm((current) => ({ ...current, location: event.target.value }))
                  }
                />
              </label>
              <label>
                Address
                <input
                  id="event-address"
                  name="address"
                  value={form.address}
                  onChange={(event) =>
                    updateForm((current) => ({ ...current, address: event.target.value }))
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
                    remainingRetries={Math.max(0, 3 - extractionAttempts)}
                  />
                  {reconciliation.status === "loading" && (
                    <div className="admin-banner" role="status">
                      Checking the venue, organizer, instructors and school against existing
                      records…
                    </div>
                  )}
                  {reconciliation.status === "error" && (
                    <div className="admin-banner" role="status">
                      We couldn&apos;t check these against existing records. Review them below.
                    </div>
                  )}
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
        <div className="admin-event-form__series">
          <label htmlFor="event-series">Series</label>
          <select
            id="event-series"
            value={form.series_id ?? ""}
            onChange={(event) =>
              updateForm((current) => ({ ...current, series_id: event.target.value }))
            }
            disabled={isSaving}
          >
            <option value="">None</option>
            {series.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {seriesError && <p role="alert">{seriesError}</p>}
        </div>
        <EntityReviewSection
          review={form.entity_review ?? emptyEntityReview()}
          onChange={(review) => setForm((current) => ({ ...current, entity_review: review }))}
          disabled={isSaving}
          mode="authorized"
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
            onClick={requestCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
        </div>
      </form>
      {discardOpen && (
        <AdminConfirmDialog
          title="Discard changes?"
          body="Your edits to this event haven't been saved."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          tone="danger"
          isBusy={false}
          onConfirm={onCancel}
          onCancel={() => setDiscardOpen(false)}
        />
      )}
    </>
  );
}
