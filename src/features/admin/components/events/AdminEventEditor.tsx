import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, FilePlus2, ImageUp, Sparkles } from "lucide-react";
import AdminConfirmDialog from "../common/AdminConfirmDialog";
import ComposerEntitySelect from "./ComposerEntitySelect";
import type { ComposerEntity, ComposerEntityKind } from "./ComposerEntitySelect";
import { fetchAdminEntityDetail } from "../../entities/api/entitiesRepo";
import { fetchVenueDetail } from "../../api/venuesRepo";
import { applySeriesToComposer, readComposerRecovery } from "../../model/eventComposerDraft";
import type { ComposerIntent, ComposerSaved } from "../../model/eventComposerDraft";
import type { DatabaseEvent } from "../../../events/model/types";
import { validateSubmitFormFields } from "../../../submit-event/model/validation";
import type { SubmitFieldErrors } from "../../../submit-event/model/validation";
import { useAccessibleDialog } from "../../../../shared/a11y/useAccessibleDialog";
import type { EventTaxonomyTerm } from "../../../events/model/types";
import EventForm, { CAPABILITIES } from "../../../events/components/EventForm";
import type { AdminEventForm } from "../../model/adminEventForm";
import { validateAdminEventForm } from "../../model/adminEventForm";
import { useActiveTaxonomyTerms } from "../../hooks/useAdminTaxonomy";
import {
  chooseExisting,
  newReviewItem,
  removeItem,
} from "../../../entity-matching/entityReviewState";
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
  isSaving: boolean;
  error: string | null;
  eventId?: string;
  initialStatus?: DatabaseEvent["status"];
  initialOrganizerId?: string | null;
  seriesEvents?: DatabaseEvent[];
  flyerOwnerId?: string | null;
  onSubmit: (
    form: AdminEventForm,
    flyer: File | null,
    intent?: ComposerIntent,
    eventId?: string
  ) => Promise<ComposerSaved | void>;
  onCancel: () => void;
};

export default function AdminEventEditor({
  initial,
  initialTaxonomyTerms,
  heading,
  isSaving,
  error,
  eventId: _eventId,
  flyerOwnerId,
  initialStatus = "draft",
  initialOrganizerId,
  seriesEvents = [],
  onSubmit,
  onCancel,
}: Props) {
  const { metros } = useMetros();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [entry, setEntry] = useState<"flyer" | "series" | "blank">("blank");
  const [previewOpen, setPreviewOpen] = useState(false);
  const recoveryKey = flyerOwnerId
    ? `salsa:event-composer:${flyerOwnerId}:${_eventId ?? "new"}`
    : null;
  const discardRecovery = useRef(false);
  const [recovery] = useState(() => {
    try {
      return recoveryKey ? readComposerRecovery(localStorage.getItem(recoveryKey), initial) : null;
    } catch {
      return null;
    }
  });
  const [form, setForm] = useState(recovery?.form ?? initial);
  const [saved, setSaved] = useState<ComposerSaved | null>(
    recovery?.saved ?? (_eventId ? { id: _eventId, status: initialStatus } : null)
  );
  const edited = useRef(new Set<keyof AdminEventForm>(recovery?.edited ?? []));
  const [saveMessage, setSaveMessage] = useState(
    recovery ? "Restored your draft from this device." : ""
  );
  const [storageError, setStorageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const savingRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<SubmitFieldErrors>({});
  const lastRemoteForm = useRef(JSON.stringify(initial));
  const persistedEvent = useRef(saved);
  const saveCallback = useRef(onSubmit);
  useEffect(() => {
    saveCallback.current = onSubmit;
  }, [onSubmit]);
  const [selectedSeries, setSelectedSeries] = useState<ComposerEntity | null>(null);
  const seriesGeneration = useRef(0);
  const uploadGeneration = useRef(0);
  const seriesRef = useRef<HTMLDivElement>(null);
  const artworkRef = useRef<HTMLDivElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedFlyer, setSelectedFlyer] = useState<File | null>(null);
  const [flyerStatus, setFlyerStatus] = useState<EventFlyerStatus>(
    (recovery?.form.image_url ?? initial.image_url) ? "uploaded" : "empty"
  );
  const [flyerError, setFlyerError] = useState<string | null>(null);

  useEffect(() => {
    if (!form.series_id || selectedSeries?.id === form.series_id) return;
    let cancelled = false;
    void fetchAdminEntityDetail("series", form.series_id)
      .then((entity) => {
        if (!cancelled && entity) setSelectedSeries(entity);
      })
      .catch(() => {
        if (!cancelled)
          setValidationError(
            "Unable to load the selected series. Your event details are preserved."
          );
      });
    return () => {
      cancelled = true;
    };
  }, [form.series_id, selectedSeries?.id]);

  useEffect(() => {
    if (!initialOrganizerId || form.entity_review?.organizer || edited.current.has("entity_review"))
      return;
    let cancelled = false;
    void fetchAdminEntityDetail("organizer", initialOrganizerId)
      .then((entity) => {
        if (cancelled || !entity || edited.current.has("entity_review")) return;
        setForm((current) => ({
          ...current,
          entity_review: {
            ...(current.entity_review ?? emptyEntityReview()),
            organizer: chooseExisting(newReviewItem(entity.name), entity, { moderator: true }),
          },
        }));
      })
      .catch(() => {
        if (!cancelled)
          setValidationError(
            "Unable to load the linked organizer. The existing relationship has not been changed."
          );
      });
    return () => {
      cancelled = true;
    };
    // Hydrate legacy canonical links once; manual choices remain authoritative.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrganizerId]);
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
  const cityChosenRef = useRef(Boolean(_eventId || recovery));
  const [reconciliation, setReconciliation] = useState<{ status: "idle" | "loading" | "error" }>({
    status: "idle",
  });
  const handleFormChange = (draft: AdminEventForm) => {
    for (const key of Object.keys(draft) as (keyof AdminEventForm)[]) {
      if (JSON.stringify(draft[key]) !== JSON.stringify(formRef.current[key]))
        edited.current.add(key);
    }
    if (draft.city !== formRef.current.city) cityChosenRef.current = true;
    if (Object.keys(fieldErrors).length > 0) setFieldErrors(validateSubmitFormFields(draft));
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
  const danceStyles = useActiveTaxonomyTerms("dance_style");
  const attributes = useActiveTaxonomyTerms("event_attribute");
  const archived = initialTaxonomyTerms.filter(
    (term) => term.status !== "active" && form.taxonomy_term_ids.includes(term.id)
  );

  const handleFlyerChange = async (file: File | null) => {
    resetExtraction();
    const generation = ++uploadGeneration.current;
    edited.current.add("image_url");
    setFlyerError(null);
    if (!file) {
      setForm((current) => ({ ...current, image_url: "" }));
      setSelectedFlyer(null);
      setFlyerStatus("empty");
      return;
    }
    if (!flyerOwnerId) {
      setFlyerStatus("upload-error");
      setFlyerError("Your admin session is still loading. Try the flyer again in a moment.");
      return;
    }
    setFlyerStatus("uploading");
    setSelectedFlyer(null);
    try {
      const uploaded = await uploadEventFlyer({
        file,
        ownerId: flyerOwnerId,
        eventId: saved?.id ?? "admin-draft-" + crypto.randomUUID(),
      });
      if (uploadGeneration.current !== generation) {
        void removeEventFlyer(uploaded.url).catch(() => undefined);
        return;
      }
      setForm((current) => ({ ...current, image_url: uploaded.url }));
      setFlyerStatus("uploaded");
    } catch (uploadError) {
      if (uploadGeneration.current !== generation) return;
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
    for (const key of edited.current) Object.assign(applied.draft, { [key]: form[key] });
    setForm(applied.draft);
    setPrefillFeedback({ filled: applied.filled, skipped: applied.skipped });
  };
  const dismissExtractionError = () => {
    setExtractionStatus("idle");
    setExtractionError(null);
  };
  const persist = async (intent: ComposerIntent, automatic = false) => {
    if (savingRef.current || isSaving || flyerStatus === "uploading" || isExtracting.current)
      return;
    const snapshot = formRef.current;
    const errors = validateSubmitFormFields(snapshot);
    const nextError = Object.values(errors)[0] ?? validateAdminEventForm(snapshot);
    if (nextError) {
      if (!automatic) {
        setFieldErrors(errors);
        setValidationError(nextError);
      }
      return;
    }
    if (
      intent === "publish" &&
      listReviewEntries(snapshot.entity_review ?? emptyEntityReview()).some(
        ({ item }) => item.decision === "pending"
      )
    ) {
      setValidationError("Resolve or remove the suggested entities before publishing.");
      return;
    }
    savingRef.current = true;
    setBusy(true);
    setValidationError(null);
    setFieldErrors({});
    try {
      const result = await saveCallback.current(snapshot, selectedFlyer, intent, saved?.id);
      if (result) {
        persistedEvent.current = result;
        setSaved(result);
        // This request may finish after SPA navigation unmounts the editor.
        if (recoveryKey && !discardRecovery.current) {
          try {
            const latest = readComposerRecovery(localStorage.getItem(recoveryKey), initial);
            localStorage.setItem(
              recoveryKey,
              JSON.stringify({
                version: 1,
                form: latest?.form ?? snapshot,
                saved: result,
                edited: [...edited.current],
              })
            );
          } catch {
            setStorageError(
              "The event was saved to your account, but device recovery is unavailable."
            );
          }
        }
      }
      lastRemoteForm.current = JSON.stringify(snapshot);
      if (result?.publicationError) {
        setValidationError(
          `The event was saved, but public visibility could not be verified: ${result.publicationError}`
        );
        setSaveMessage("Saved. Check public visibility before sharing.");
      } else {
        setSaveMessage(
          intent === "publish"
            ? "Published. Your event is live."
            : saved?.status === "approved"
              ? "Changes saved to the live event."
              : "Draft saved to your account."
        );
      }
    } catch (submissionError) {
      setValidationError(
        submissionError instanceof Error ? submissionError.message : "Unable to save event."
      );
      setSaveMessage("Account save failed. Your edits remain in this editor.");
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void persist(saved?.status === "approved" ? "save" : "draft");
  };

  useEffect(() => {
    if (!recoveryKey) return;
    const snapshot = { version: 1, form, edited: [...edited.current] };
    const writeRecovery = () => {
      if (discardRecovery.current) return null;
      try {
        localStorage.setItem(
          recoveryKey,
          JSON.stringify({ ...snapshot, saved: persistedEvent.current })
        );
        return null;
      } catch {
        return "Device saving is unavailable. Save to your account before leaving.";
      }
    };
    // Coalesce typing; flush the latest snapshot on navigation or page closure.
    const timer = window.setTimeout(() => setStorageError(writeRecovery()), 150);
    window.addEventListener("pagehide", writeRecovery);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", writeRecovery);
      writeRecovery();
    };
  }, [form, saved, recoveryKey]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (storageError || flyerStatus === "uploading" || busy) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [storageError, flyerStatus, busy]);

  useEffect(() => {
    if (
      saved?.status === "approved" ||
      initialStatus !== "draft" ||
      isSaving ||
      flyerStatus === "uploading" ||
      JSON.stringify(form) === lastRemoteForm.current ||
      listReviewEntries(form.entity_review ?? emptyEntityReview()).some(
        ({ item }) => item.decision === "pending" || item.decision === "new"
      )
    )
      return;
    const timer = window.setTimeout(() => void persist("draft", true), 1800);
    return () => window.clearTimeout(timer);
    // Form revisions schedule autosave; callback identity must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, saved?.status, initialStatus, isSaving, flyerStatus]);

  // The banner sits above a long form and Save sits below it: bring the
  // message to the person instead of leaving it off-screen.
  const bannerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (validationError || error) bannerRef.current?.focus();
  }, [validationError, error]);

  const requestCancel = () => {
    const dirty = selectedFlyer !== null || JSON.stringify(form) !== lastRemoteForm.current;
    if (dirty) setDiscardOpen(true);
    else {
      discardRecovery.current = true;
      if (recoveryKey) {
        try {
          localStorage.removeItem(recoveryKey);
        } catch {
          /* Account save is already complete. */
        }
      }
      onCancel();
    }
  };

  const review = form.entity_review ?? emptyEntityReview();
  const entityValue = (
    kind: Exclude<ComposerEntityKind, "series">,
    index = 0
  ): ComposerEntity | null => {
    const item = kind === "instructor" ? review.instructors[index] : review[kind];
    if (kind === "venue" && form.venue_id) {
      return { id: form.venue_id, name: form.location || "Selected venue", address: form.address };
    }
    if (!item?.selected_id || item.decision !== "existing") return null;
    return (
      item.matches.find((match) => match.id === item.selected_id) ?? {
        id: item.selected_id,
        name: item.candidate.name,
      }
    );
  };
  const selectEntity = (
    kind: Exclude<ComposerEntityKind, "series">,
    entity: ComposerEntity | null,
    index = 0
  ) => {
    edited.current.add("entity_review");
    if (kind === "venue") {
      edited.current.add("venue_id");
      edited.current.add("location");
      edited.current.add("address");
    }
    setForm((current) => {
      const existing = current.entity_review ?? emptyEntityReview();
      const old = kind === "instructor" ? existing.instructors[index] : existing[kind];
      const item = entity
        ? chooseExisting(newReviewItem(entity.name), entity, { moderator: true })
        : old
          ? removeItem(old)
          : null;
      const next = { ...existing };
      if (kind === "instructor") {
        next.instructors = [...existing.instructors];
        if (item) next.instructors[index] = item;
      } else next[kind] = item;
      return {
        ...current,
        entity_review: next,
        ...(kind === "venue"
          ? {
              venue_id: entity?.id ?? "",
              location: entity?.name ?? "",
              address: entity?.address ?? "",
              venue_time_zone: entity?.timezone ?? "",
            }
          : {}),
      };
    });
  };
  const selectSeries = async (entity: ComposerEntity | null) => {
    const generation = ++seriesGeneration.current;
    setSelectedSeries(entity);
    if (!entity) {
      setForm((current) => ({ ...current, series_id: "" }));
      return;
    }
    const source = seriesEvents
      .filter((event) => event.series_id === entity.id)
      .sort((a, b) => b.event_date.localeCompare(a.event_date))[0];
    setForm((current) => applySeriesToComposer(current, entity, source, edited.current));
    setSaveMessage("Series details fill empty fields only. Choose the date for this occurrence.");
    try {
      const [venue, organizer] = await Promise.all([
        entity.venue_id ? fetchVenueDetail(entity.venue_id) : null,
        entity.organizer_id ? fetchAdminEntityDetail("organizer", entity.organizer_id) : null,
      ]);
      if (seriesGeneration.current !== generation) return;
      setForm((current) => {
        if (current.series_id !== entity.id) return current;
        const next = { ...current };
        const nextReview = { ...(current.entity_review ?? emptyEntityReview()) };
        if (
          venue &&
          !edited.current.has("venue_id") &&
          !edited.current.has("location") &&
          (!current.venue_id || current.venue_id === venue.id) &&
          (!current.location || current.location === venue.name)
        ) {
          next.venue_id = venue.id;
          next.venue_time_zone = venue.timezone ?? "";
          next.location = next.location || venue.name;
          if (!edited.current.has("address"))
            next.address = next.address || venueDisplayAddress(venue) || "";
          nextReview.venue = chooseExisting(
            newReviewItem(venue.name),
            {
              id: venue.id,
              name: venue.name,
              address: venueDisplayAddress(venue),
            },
            { moderator: true }
          );
        }
        if (organizer && !edited.current.has("entity_review") && !nextReview.organizer) {
          nextReview.organizer = chooseExisting(newReviewItem(organizer.name), organizer, {
            moderator: true,
          });
        }
        next.entity_review = nextReview;
        return next;
      });
    } catch (loadError) {
      if (seriesGeneration.current === generation)
        setValidationError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load series defaults. Select the venue and organizer below."
        );
    }
  };
  const locked = busy || isSaving || flyerStatus === "uploading";
  const suggestions = listReviewEntries(review).some(
    ({ item }) => item.decision === "pending" || item.decision === "new"
  );

  return (
    <>
      <form className="admin-form admin-event-editor" onSubmit={submit} noValidate>
        <div className="admin-form__header">
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-event-editor__back"
            onClick={requestCancel}
            disabled={locked}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Events
          </button>
          <h1>{_eventId ? heading : "Event composer"}</h1>
          <p>Create the listing, connect its people and place, then publish here.</p>
        </div>
        {!_eventId && (
          <div className="composer-entry" role="group" aria-label="Start your event">
            {(
              [
                ["flyer", ImageUp, "Upload Flyer", "Read details from your artwork"],
                [
                  "series",
                  CalendarDays,
                  "Create from Series",
                  "Reuse a night’s details and artwork",
                ],
                ["blank", FilePlus2, "Start Blank", "Enter a new event yourself"],
              ] as const
            ).map(([method, Icon, title, description]) => (
              <button
                key={method}
                type="button"
                aria-label={title}
                aria-pressed={entry === method}
                disabled={locked}
                onClick={() => {
                  setEntry(method);
                  if (method === "flyer") {
                    artworkRef.current?.scrollIntoView?.({ block: "center" });
                    artworkRef.current
                      ?.querySelector<HTMLInputElement>('input[type="file"]')
                      ?.click();
                  }
                  if (method === "series") {
                    seriesRef.current?.scrollIntoView?.({ block: "center" });
                    seriesRef.current?.querySelector<HTMLInputElement>("input")?.focus();
                  }
                }}
              >
                <Icon size={20} aria-hidden="true" />
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="composer-series" ref={seriesRef}>
          <ComposerEntitySelect
            kind="series"
            label="Event series"
            value={
              selectedSeries ??
              (form.series_id ? { id: form.series_id, name: "Loading series…" } : null)
            }
            city={form.city}
            disabled={locked}
            onSelect={(entity) => void selectSeries(entity)}
          />
          <p>Optional. Reuse details and artwork; every occurrence needs its own date.</p>
        </div>
        {storageError && (
          <p className="admin-banner admin-banner--error" role="alert">
            {storageError}
          </p>
        )}
        <fieldset className="composer-fields" disabled={locked}>
          <legend className="sr-only">Event details</legend>
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
            taxonomyTerms={{
              danceStyles: danceStyles.terms,
              attributes: attributes.terms,
              archived,
            }}
            errors={fieldErrors}
            renderVenueField={() => (
              <>
                <ComposerEntitySelect
                  kind="venue"
                  value={entityValue("venue")}
                  city={form.city}
                  disabled={locked}
                  onSelect={(entity) => selectEntity("venue", entity)}
                />
                <label>
                  Venue name
                  <input
                    id="event-location"
                    name="location"
                    value={form.location}
                    onChange={(event) =>
                      handleFormChange({ ...form, location: event.target.value })
                    }
                  />
                </label>
                <label>
                  Address
                  <input
                    id="event-address"
                    name="address"
                    value={form.address}
                    onChange={(event) => handleFormChange({ ...form, address: event.target.value })}
                  />
                </label>
              </>
            )}
            renderFlyerField={() => (
              <div ref={artworkRef}>
                <EventFlyerField
                  currentUrl={form.image_url || null}
                  onFileChange={(file) => void handleFlyerChange(file)}
                  onRemove={() => void handleFlyerChange(null)}
                  status={flyerStatus}
                  errorMessage={flyerError}
                  disabled={locked}
                />
                {form.image_url && extractionStatus === "idle" && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary"
                    onClick={() => void handleExtractFlyer()}
                    disabled={locked || flyerStatus !== "uploaded"}
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
              </div>
            )}
          />
          <section className="composer-relationships">
            <h2>People & organizations</h2>
            <p>Link existing listings or create a missing one without leaving this event.</p>
            <div className="composer-relationships__grid">
              <ComposerEntitySelect
                kind="organizer"
                value={entityValue("organizer")}
                city={form.city}
                disabled={locked}
                onSelect={(entity) => selectEntity("organizer", entity)}
              />
              <ComposerEntitySelect
                kind="school"
                value={entityValue("school")}
                city={form.city}
                disabled={locked}
                onSelect={(entity) => selectEntity("school", entity)}
              />
              {review.instructors.map(
                (item, index) =>
                  item.decision !== "removed" && (
                    <ComposerEntitySelect
                      key={index}
                      kind="instructor"
                      label={`Instructor ${index + 1}`}
                      value={entityValue("instructor", index)}
                      city={form.city}
                      disabled={locked}
                      onSelect={(entity) => selectEntity("instructor", entity, index)}
                    />
                  )
              )}
              {review.instructors.filter((item) => item.decision !== "removed").length < 10 && (
                <ComposerEntitySelect
                  kind="instructor"
                  label="Add instructor"
                  value={null}
                  city={form.city}
                  disabled={locked}
                  onSelect={(entity) => {
                    if (!entity) return;
                    const removed = review.instructors.findIndex(
                      (item) => item.decision === "removed"
                    );
                    selectEntity(
                      "instructor",
                      entity,
                      removed < 0 ? review.instructors.length : removed
                    );
                  }}
                />
              )}
            </div>
          </section>
          {suggestions && (
            <details className="composer-suggestions" open>
              <summary>Review suggested entities</summary>
              <EntityReviewSection
                review={review}
                onChange={(next) => {
                  edited.current.add("entity_review");
                  setForm((current) => ({ ...current, entity_review: next }));
                }}
                disabled={locked}
                mode="authorized"
              />
            </details>
          )}
        </fieldset>
        <div
          className={`admin-form__actions${saved?.status === "approved" ? " admin-form__actions--published" : ""}`}
        >
          <div className="composer-save-status" role="status" aria-live="polite">
            <strong>
              {busy ? "Saving…" : saved?.status === "approved" ? "Published" : "Draft"}
            </strong>
            <span>
              {saveMessage ||
                (recoveryKey
                  ? "Changes save automatically on this device."
                  : "Save to keep your event.")}
            </span>
            {saved?.status === "approved" && (
              <Link
                className="composer-public-link"
                to={saved.publicUrl ?? `/events/${saved.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View public event
              </Link>
            )}
            <button
              type="button"
              className="admin-btn admin-btn--ghost composer-exit"
              onClick={requestCancel}
              disabled={locked}
            >
              Cancel
            </button>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => setPreviewOpen(true)}
            disabled={locked}
          >
            Preview event
          </button>
          <button
            type="submit"
            className={`admin-btn admin-btn--${saved?.status === "approved" ? "primary" : "secondary"}`}
            disabled={locked}
          >
            {busy ? "Saving…" : saved?.status === "approved" ? "Save changes" : "Save draft"}
          </button>
          {saved?.status !== "approved" && (
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={locked}
              onClick={() => void persist("publish")}
            >
              Publish event
            </button>
          )}
        </div>
      </form>
      {previewOpen && <ComposerPreview form={form} onClose={() => setPreviewOpen(false)} />}
      {discardOpen && (
        <AdminConfirmDialog
          title="Discard changes?"
          body="Discard this device’s unsaved changes? Any draft already saved to your account will remain."
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
          tone="danger"
          isBusy={false}
          onConfirm={() => {
            if (recoveryKey) {
              discardRecovery.current = true;
              try {
                localStorage.removeItem(recoveryKey);
              } catch {
                /* Device storage may be unavailable. */
              }
            }
            onCancel();
          }}
          onCancel={() => setDiscardOpen(false)}
        />
      )}
    </>
  );
}

function ComposerPreview({ form, onClose }: { form: AdminEventForm; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialog = useAccessibleDialog({ dialogRef, onDismiss: onClose });
  return (
    <div className="composer-preview-overlay" onClick={dialog.onBackdropClick}>
      <div
        className="composer-preview admin-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="composer-preview-title"
        ref={dialogRef}
        onKeyDown={dialog.onKeyDown}
        onClick={dialog.onDialogClick}
      >
        <div className="composer-preview__heading">
          <h2 id="composer-preview-title">Event preview</h2>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={onClose}>
            Back to editing
          </button>
        </div>
        <p className="composer-preview__note">
          Preview of your current edits. Nothing is published by opening this preview.
        </p>
        {form.image_url && (
          <img src={form.image_url} alt={`Artwork for ${form.title || "this event"}`} />
        )}
        <h3>{form.title || "Untitled event"}</h3>
        <dl>
          <div>
            <dt>When</dt>
            <dd>
              {form.event_date || "Choose an occurrence date"}
              {form.event_time && ` · ${form.event_time}`} · America/New_York
            </dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>
              {form.location || "Venue not specified"}
              {form.address && ` · ${form.address}`}
            </dd>
          </div>
          <div>
            <dt>Admission</dt>
            <dd>
              {form.price_type === "free"
                ? "Free"
                : form.price_type === "paid"
                  ? `$${form.price_amount}`
                  : "Not specified"}
            </dd>
          </div>
          <div>
            <dt>Type & city</dt>
            <dd>
              {form.event_type.replace("_", " ") || "Not specified"} ·{" "}
              {form.city || "Choose a city"}
            </dd>
          </div>
          {listReviewEntries(form.entity_review ?? emptyEntityReview())
            .filter(({ item }) => item.decision === "existing")
            .map(({ kind, index, item }) => (
              <div key={`${kind}-${index}`}>
                <dt>{kind}</dt>
                <dd>
                  {item.matches.find((match) => match.id === item.selected_id)?.name ??
                    item.candidate.name}
                </dd>
              </div>
            ))}
        </dl>
        <p className="composer-preview__description">{form.description || "No description yet."}</p>
        {form.rsvp_link && <p>RSVP: {form.rsvp_link}</p>}
      </div>
    </div>
  );
}
