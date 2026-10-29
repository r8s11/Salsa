import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { posthogSubmissionLogger } from "../../../shared/analytics/posthogLogs";
import { createSubmission } from "../../admin/api/submissionsRepo";
import { uploadEventFlyer, removeEventFlyer } from "../../events/api/eventFlyers";
import { MAX_FLYERS_PER_EVENT, flyerPayload } from "../../events/model/eventFlyers";
import { useCity } from "../../../contexts/useCity";
import { useMetros } from "../../metros/hooks/useMetros";
import { useAuth } from "../../../contexts/useAuth";
import {
  buildInitialForm,
  validateSubmitFormFields,
  type SubmitFieldErrors,
} from "../model/validation";
import { publicErrorMessage } from "../../../shared/forms/errorMessage";
import { notifySubmissionReceived } from "../api/submissionNotification";
import type { EventFormDraft } from "../../events/components/EventForm";
import type { EventType } from "../../events/model/types";
import { eventTypeFields } from "../../events/model/eventTypeSelection";
import { draftToSubmission } from "../../events/components/EventForm";
import type { FlyerItem as FlyerFieldItem } from "../../events/components/EventFlyersField";
import { extractEventFromFlyer } from "../../flyer-extraction/client";
import { applyExtractionToDraft, type PrefillResult } from "../../flyer-extraction/prefill";
import type { ExtractedEvent, FlyerExtractionStatus } from "../../flyer-extraction/types";
import { reconcileEntities } from "../../entity-matching/entityReviewClient";
import {
  emptyEntityReview,
  extractionEntityCandidates,
  hasEntityCandidates,
  mergeEntityReview,
  type EntityCandidates,
  type EntityReview,
} from "../../entity-matching/entityReview";
import {
  detachAutoVenueLink,
  enrichExtractionWithReview,
  suppressAutoVenueLink,
  listReviewEntries,
  reviewFromCandidates,
} from "../../entity-matching/entityReviewState";

type ReconciliationState = {
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
};

const hasReviewEntries = (review: EntityReview) => listReviewEntries(review).length > 0;

type FlyerItem = {
  id: string;
  file: File;
  /** Public storage URL; set once the upload has persisted. */
  url: string | null;
  status: NonNullable<FlyerFieldItem["status"]>;
  errorMessage: string | null;
};

/** The first item is primary; it is not ready for extraction until uploaded. */
const primaryFlyer = (items: readonly FlyerItem[]) => items[0] ?? null;

const persistedFlyerUrls = (items: readonly FlyerItem[]) =>
  items.flatMap((item) => (item.url ? [item.url] : []));

function buildSubmitDraft(city: EventFormDraft["city"]): EventFormDraft {
  return {
    ...buildInitialForm(city),
    sublocation: "",
    venue_id: "",
    image_url: "",
    image_urls: [],
    host: "",
    contact_email: "",
    contact_instagram: "",
    contact_website: "",
    taxonomy_term_ids: [],
  };
}

export function useSubmitEventForm(authenticatedSubmitterName: string | null = null) {
  const { city: defaultCity } = useCity();
  const { metros } = useMetros();
  const { user } = useAuth();
  const [form, setForm] = useState<EventFormDraft>(() => buildSubmitDraft(defaultCity ?? ""));
  // Extraction resolves asynchronously; reading `form` from a closure
  // captured when the request started would ignore anything the user typed
  // in the meantime. This ref always reflects the latest render's form, so
  // the success handler prefills against current, not stale, values.
  const formRef = useRef(form);
  const submittingRef = useRef(false);
  useEffect(() => {
    formRef.current = form;
  }, [form]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  // Per-field validation errors, keyed by `SubmitFieldName`.
  const [fieldErrors, setFieldErrors] = useState<SubmitFieldErrors>({});
  // Failure with no identifiable field — a rejected API call.
  const [serverError, setServerError] = useState<string | null>(null);
  // Bumped on every failed submit attempt (validation or server) so
  // `FormErrorSummary` re-focuses even when the error text is unchanged.
  const [failedAttempt, setFailedAttempt] = useState(0);

  // ── Flyers: persist-before-ready, ordered, up to MAX_FLYERS_PER_EVENT ──
  // Each flyer is uploaded to Supabase Storage as soon as it is chosen — an
  // item is therefore "uploaded" only once its object exists in persistent
  // storage, and submitting reuses those URLs without a second upload. The
  // first persisted flyer is the primary (`events.image_url`); the whole
  // ordered list travels as `image_urls`.
  const [flyers, setFlyers] = useState<FlyerItem[]>([]);
  // Mirrors `flyers` synchronously: upload callbacks and submit read the
  // latest list, not the one captured by the render that started them.
  const flyersRef = useRef<FlyerItem[]>([]);
  const [flyerError, setFlyerError] = useState<string | null>(null);
  // In-flight uploads, so submit never starts a second upload for an item and
  // can wait for the running ones. Each resolves to the URL or null on failure.
  const flyerUploads = useRef(new Map<string, Promise<string | null>>());

  // ── Flyer extraction (Phase 3): review-only ──
  // One extraction attempt at a time, for the currently persisted flyer.
  // `extractionGeneration` is bumped whenever the active flyer changes
  // (replace/remove) or a new extraction starts; a resolving request only
  // applies its result if its captured generation still matches, so a late
  // response for a flyer the user has already replaced or removed is
  // discarded rather than silently becoming the visible result.
  const [extractionStatus, setExtractionStatus] = useState<FlyerExtractionStatus>("idle");
  const [extractionResult, setExtractionResult] = useState<ExtractedEvent | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  // Human labels of fields the last successful extraction filled/skipped —
  // sourced from `applyExtractionToDraft`'s `PrefillResult`, not recomputed.
  const [prefillFeedback, setPrefillFeedback] = useState<Pick<
    PrefillResult,
    "filled" | "skipped"
  > | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationState>({
    status: "idle",
    error: null,
  });
  const extractionGeneration = useRef(0);
  // What the last successful extraction proposed. A repeat extraction compares
  // against it to tell untouched candidates (replaced) from edited ones (kept).
  const lastCandidatesRef = useRef<EntityCandidates | null>(null);
  // Set once the person picks the city themselves; later extractions then
  // leave it alone. The draft cannot tell a typed city from the viewer default.
  const cityChosenRef = useRef(false);
  // Synchronous duplicate-click guard: React state updates don't apply
  // mid-event-handler, so two calls to handleExtractFlyer in the same tick
  // would both read `extractionStatus` as "idle" from the same render
  // closure. This ref flips immediately, before any state update or await.
  const isExtracting = useRef(false);
  // Extraction attempts are capped so a low-quality flyer cannot loop the user
  // into endless retries. The counter resets whenever the flyer identity
  // changes (replace/remove), so a new flyer gets a fresh budget.
  const MAX_EXTRACTION_ATTEMPTS = 3;
  const [extractionAttempts, setExtractionAttempts] = useState(0);

  // Drops a field's error the moment its value changes — stale "Choose an
  // event type" text must not survive the user fixing it.
  const clearFieldError = <K extends keyof EventFormDraft>(field: K) => {
    setFieldErrors((previous) => {
      if (!(field in previous)) return previous;
      const next = { ...previous };
      delete next[field as keyof SubmitFieldErrors];
      return next;
    });
  };

  const update = <K extends keyof EventFormDraft>(field: K, value: EventFormDraft[K]) => {
    if (field === "city") cityChosenRef.current = true;
    const geographyFields =
      field === "city"
        ? { sublocation: "", neighborhood: null }
        : field === "sublocation"
          ? { neighborhood: null }
          : {};
    const typeFields =
      field === "event_types"
        ? eventTypeFields((value as EventType[] | undefined) ?? [])
        : field === "event_type"
          ? eventTypeFields(value ? [value as EventType] : [])
          : {};
    setForm((previous) =>
      detachAutoVenueLink(
        previous,
        { ...previous, [field]: value, ...typeFields, ...geographyFields } as EventFormDraft
      )
    );
    clearFieldError(field === "event_types" ? "event_type" : field);
  };
  // Applies a draft produced by extraction. Unlike `onChange` it is not the
  // person choosing a city, so it must not lock the city against later extractions.
  const applyDraft = (draft: EventFormDraft, review: EntityReview) => {
    setForm((previous) => ({
      ...draft,
      ...(draft.city !== previous.city
        ? { sublocation: "", neighborhood: null }
        : draft.sublocation !== previous.sublocation
          ? { neighborhood: null }
          : {}),
      entity_review: hasReviewEntries(review) ? review : undefined,
    }));
  };
  const onChange = (draft: EventFormDraft) => {
    if (draft.city !== formRef.current.city) cityChosenRef.current = true;
    setForm((previous) => {
      const geographyFields =
        draft.city !== previous.city
          ? { sublocation: "" as const, neighborhood: null }
          : draft.sublocation !== previous.sublocation
            ? { neighborhood: null }
            : {};
      const nextDraft = { ...draft, ...geographyFields };
      setFieldErrors((previousErrors) => {
        if (Object.keys(previousErrors).length === 0) return previousErrors;
        const next = { ...previousErrors };
        let changed = false;
        for (const field of Object.keys(next) as (keyof EventFormDraft)[]) {
          if (previous[field] !== nextDraft[field]) {
            delete next[field as keyof SubmitFieldErrors];
            changed = true;
          }
        }
        return changed ? next : previousErrors;
      });
      return detachAutoVenueLink(previous, nextDraft);
    });
  };
  const setEntityReview = (review: EntityReview) => {
    setForm((previous) => ({ ...previous, entity_review: review }));
  };

  const resetExtraction = () => {
    extractionGeneration.current += 1;
    isExtracting.current = false;
    setExtractionStatus("idle");
    setExtractionResult(null);
    setExtractionError(null);
    setPrefillFeedback(null);
    setReconciliation({ status: "idle", error: null });
    setExtractionAttempts(0);
    // The flyer these candidates came from is gone. Untouched candidates go
    // with it; anything the person edited or decided stays.
    const previous = lastCandidatesRef.current;
    setForm((draft) => {
      if (!draft.entity_review) return draft;
      const pruned = mergeEntityReview(draft.entity_review, previous, emptyEntityReview());
      return { ...draft, entity_review: hasReviewEntries(pruned) ? pruned : undefined };
    });
  };

  const commitFlyers = (next: FlyerItem[]) => {
    const previousPrimaryId = primaryFlyer(flyersRef.current)?.id;
    flyersRef.current = next;
    setFlyers(next);
    // Extraction results belong to the primary flyer; a different item
    // (added, removed, or reordered) invalidates them even if URL mocks repeat.
    if (previousPrimaryId !== primaryFlyer(next)?.id) resetExtraction();
  };
  const patchFlyer = (id: string, patch: Partial<FlyerItem>) =>
    commitFlyers(flyersRef.current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const hasFlyer = (id: string) => flyersRef.current.some((item) => item.id === id);

  const uploadFlyerItem = (item: FlyerItem): Promise<string | null> => {
    const promise = uploadEventFlyer({
      file: item.file,
      ownerId: user?.id ?? "anonymous",
      // No canonical event id yet. Authenticated paths remain owner-scoped;
      // public submissions use the policy-limited anonymous namespace.
      eventId: `submission-${crypto.randomUUID()}`,
    })
      .then((uploaded) => {
        if (!hasFlyer(item.id)) {
          // Removed while uploading: the object would be orphaned.
          void removeEventFlyer(uploaded.url).catch(() => {
            /* best-effort cleanup */
          });
          return null;
        }
        patchFlyer(item.id, { url: uploaded.url, status: "uploaded", errorMessage: null });
        return uploaded.url;
      })
      .catch((uploadErr) => {
        // The applicant can retry or continue manually — the submission is not
        // blocked by a failed upload.
        if (hasFlyer(item.id)) {
          patchFlyer(item.id, {
            status: "upload-error",
            errorMessage:
              uploadErr instanceof Error ? uploadErr.message : "We couldn't upload this flyer.",
          });
        }
        return null;
      })
      .finally(() => {
        flyerUploads.current.delete(item.id);
      });
    flyerUploads.current.set(item.id, promise);
    return promise;
  };

  const handleFlyersAdd = (files: File[]) => {
    const room = Math.max(0, MAX_FLYERS_PER_EVENT - flyersRef.current.length);
    const accepted = files.slice(0, room);
    setFlyerError(
      accepted.length < files.length
        ? `You can add up to ${MAX_FLYERS_PER_EVENT} flyers per event.`
        : null
    );
    if (accepted.length === 0) return;
    const added: FlyerItem[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: null,
      status: "uploading",
      errorMessage: null,
    }));
    commitFlyers([...flyersRef.current, ...added]);
    for (const item of added) void uploadFlyerItem(item);
  };

  const handleFlyerRetry = (id: string) => {
    const item = flyersRef.current.find((candidate) => candidate.id === id);
    if (!item || item.status !== "upload-error") return;
    setFlyerError(null);
    patchFlyer(id, { status: "uploading", errorMessage: null });
    void uploadFlyerItem(item);
  };

  const handleFlyerMove = (id: string, direction: "earlier" | "later") => {
    const items = [...flyersRef.current];
    const from = items.findIndex((item) => item.id === id);
    const to = direction === "earlier" ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= items.length) return;
    [items[from], items[to]] = [items[to], items[from]];
    commitFlyers(items);
  };

  const handleFlyerRemove = async (id: string) => {
    const item = flyersRef.current.find((candidate) => candidate.id === id);
    if (!item) return;
    setFlyerError(null);
    if (!item.url) {
      // Nothing persisted yet. An upload still in flight deletes its own object
      // when it lands and finds the item gone.
      commitFlyers(flyersRef.current.filter((candidate) => candidate.id !== id));
      return;
    }
    patchFlyer(id, { status: "removing" });
    try {
      await removeEventFlyer(item.url);
      commitFlyers(flyersRef.current.filter((candidate) => candidate.id !== id));
    } catch {
      setFlyerError("We couldn't remove this flyer. Please try again.");
      if (hasFlyer(id)) patchFlyer(id, { status: "uploaded" });
    }
  };

  // Extraction reads the primary flyer only, whatever else is attached.
  const handleExtractFlyer = () => {
    const flyerUrl = primaryFlyer(flyersRef.current)?.url ?? null;
    if (!flyerUrl || isExtracting.current) return;
    if (extractionAttempts >= MAX_EXTRACTION_ATTEMPTS) return;
    setExtractionAttempts((attempt) => attempt + 1);
    isExtracting.current = true;
    const generation = ++extractionGeneration.current;
    const stale = () => extractionGeneration.current !== generation;
    setExtractionStatus("loading");
    setExtractionError(null);
    void (async () => {
      try {
        const result = await extractEventFromFlyer(flyerUrl);
        if (stale()) return;
        setExtractionResult(result);
        const candidates = extractionEntityCandidates(result);
        let incoming: EntityReview = emptyEntityReview();
        if (hasEntityCandidates(candidates)) {
          setReconciliation({ status: "loading", error: null });
          try {
            incoming = await reconcileEntities(candidates);
            if (stale()) return;
            setReconciliation({ status: "success", error: null });
          } catch (err) {
            if (stale()) return;
            // Matching is unavailable, but the people and places on the flyer
            // are still worth reviewing by hand.
            incoming = reviewFromCandidates(candidates);
            setReconciliation({
              status: "error",
              error: err instanceof Error ? err.message : "We couldn't check these against existing records.",
            });
          }
        }
        // Read the form only now, after every await, so anything typed or
        // decided while the flyer was being read is merged, not overwritten.
        const current = formRef.current;
        // A link the matcher made on its own never overrides a venue already
        // typed by hand; only an explicit choice does.
        const review = suppressAutoVenueLink(
          current.entity_review
            ? mergeEntityReview(current.entity_review, lastCandidatesRef.current, incoming)
            : incoming,
          current
        );
        lastCandidatesRef.current = candidates;
        const { draft, filled, skipped } = applyExtractionToDraft(
          enrichExtractionWithReview(result, review),
          current,
          metros,
          { preserveCity: cityChosenRef.current }
        );
        setExtractionStatus("success");
        applyDraft(draft, review);
        setPrefillFeedback({ filled, skipped });
      } catch (err) {
        if (stale()) return;
        setExtractionResult(null);
        setExtractionStatus("error");
        setExtractionError(err instanceof Error ? err.message : "We couldn't read this flyer.");
      } finally {
        if (!stale()) isExtracting.current = false;
      }
    })();
  };

  // "Continue manually" — leaves the flyer and its upload alone, only
  // dismisses the failed attempt so the button is available to try again.
  const dismissExtractionError = () => {
    setExtractionStatus("idle");
    setExtractionError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setServerError(null);
    const validationErrors = validateSubmitFormFields(
      {
        title: form.title,
        description: form.description,
        event_type: form.event_type,
        event_types: form.event_types,
        city: form.city,
        sublocation: form.sublocation,
        event_date: form.event_date,
        event_time: form.event_time,
        location: form.location,
        address: form.address,
        price_type: form.price_type,
        price_amount: form.price_amount,
        rsvp_link: form.rsvp_link,
        submitter_name: form.submitter_name,
        submitter_email: form.submitter_email,
        recurrence: form.recurrence,
        dance_styles: form.dance_styles,
      },
      // Anonymous submitters have no account to reach them through, so name
      // and email become required. Matches the anon RLS policy + trigger.
      !user
    );
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setFailedAttempt((attempt) => attempt + 1);
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setFieldErrors({});

    // Reuse the URLs already persisted for the flyers — submit never performs
    // a second upload. If uploads are still in flight, wait for them to settle.
    if (flyerUploads.current.size > 0) {
      await Promise.allSettled([...flyerUploads.current.values()]);
    }
    const flyerUrls = persistedFlyerUrls(flyersRef.current);

    setIsSubmitting(true);
    try {
      const submission = draftToSubmission(
        form,
        user ? { id: user.id, email: user.email ?? null, name: authenticatedSubmitterName } : null
      );
      const submissionId = await createSubmission(
        submission,
        // Persist the uploaded flyer URL into submitted_data so the approval
        // carry-through (deferred SQL) can copy it to events.image_url.
        flyerUrls.length ? flyerPayload(flyerUrls) : undefined
      );
      // The submission is committed. Both emails (submitter confirmation +
      // moderator notification) are deliberately un-awaited: the row is the
      // source of truth, so a mail failure must never turn a successful
      // submission into a visible error. The Edge Function records failures
      // in event_submission_email_attempts for diagnosis.
      void notifySubmissionReceived(submissionId);
      const logAttributes = {
        city: form.city,
        event_type: form.event_type,
        has_flyer: flyerUrls.length > 0,
        flyer_count: flyerUrls.length,
        is_authenticated: Boolean(user),
      };
      posthog.capture("event_submitted", logAttributes);
      posthogSubmissionLogger.submitted(logAttributes);
      setIsSubmitted(true);
      setForm(buildSubmitDraft(defaultCity ?? ""));
      flyerUploads.current.clear();
      commitFlyers([]);
      lastCandidatesRef.current = null;
      cityChosenRef.current = false;
      resetExtraction();
    } catch (err) {
      posthogSubmissionLogger.failed({
        has_flyer: flyerUrls.length > 0,
        flyer_count: flyerUrls.length,
        is_authenticated: Boolean(user),
      });
      setServerError(
        publicErrorMessage(err, {
          fallback: "We couldn't submit your event. Please try again.",
        })
      );
      setFailedAttempt((attempt) => attempt + 1);
      // Clean up a flyer that was uploaded but whose submission failed, so we
      // don't leave an orphaned object.
      if (flyerUrls.length > 0) {
        await Promise.allSettled(flyerUrls.map((url) => removeEventFlyer(url)));
        commitFlyers(flyersRef.current.filter((item) => !item.url));
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const resetSubmitted = () => setIsSubmitted(false);

  const flyerReady = Boolean(primaryFlyer(flyers)?.url);
  const flyerItems = flyers.map((item) => ({
    id: item.id,
    url: item.url ?? "",
    status: item.status,
    errorMessage: item.errorMessage,
    sizeCaption: `${(item.file.size / (1024 * 1024)).toFixed(1)} MB`,
  }));

  return {
    form,
    update,
    onChange,
    handleSubmit,
    isSubmitting,
    isSubmitted,
    fieldErrors,
    serverError,
    failedAttempt,
    resetSubmitted,
    flyerItems,
    flyerError,
    flyerReady,
    handleFlyersAdd,
    handleFlyerRetry,
    handleFlyerMove,
    handleFlyerRemove,
    extractionStatus,
    extractionResult,
    extractionError,
    extractionAttempts,
    prefillFeedback,
    reconciliation,
    entityReview: form.entity_review ?? null,
    setEntityReview,
    handleExtractFlyer,
    dismissExtractionError,
  };
}
