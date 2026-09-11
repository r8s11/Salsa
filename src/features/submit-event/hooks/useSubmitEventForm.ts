import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { createSubmission } from "../../admin/api/submissionsRepo";
import { uploadEventFlyer, removeEventFlyer } from "../../events/api/eventFlyers";
import { useCity } from "../../../contexts/useCity";
import { useAuth } from "../../../contexts/useAuth";
import { buildInitialForm, validateSubmitFormFields, type SubmitFieldErrors } from "../model/validation";
import { publicErrorMessage } from "../../../shared/forms/errorMessage";
import { notifySubmissionReceived } from "../api/submissionNotification";
import type { EventFormDraft } from "../../events/components/EventForm";
import { draftToSubmission } from "../../events/components/EventForm";
import type { EventFlyerStatus } from "../../events/components/EventFlyerField";
import { extractEventFromFlyer } from "../../flyer-extraction/client";
import type { ExtractedEvent, FlyerExtractionStatus } from "../../flyer-extraction/types";

function buildSubmitDraft(city: EventFormDraft["city"]): EventFormDraft {
  return {
    ...buildInitialForm(city),
    venue_id: "",
    image_url: "",
    host: "",
    contact_email: "",
    contact_instagram: "",
    contact_website: "",
    taxonomy_term_ids: [],
  };
}

export function useSubmitEventForm() {
  const { city: defaultCity } = useCity();
  const { user } = useAuth();
  const [form, setForm] = useState<EventFormDraft>(() => buildSubmitDraft(defaultCity));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  // Per-field validation errors, keyed by `SubmitFieldName`.
  const [fieldErrors, setFieldErrors] = useState<SubmitFieldErrors>({});
  // Failure with no identifiable field — a rejected API call.
  const [serverError, setServerError] = useState<string | null>(null);
  // Bumped on every failed submit attempt (validation or server) so
  // `FormErrorSummary` re-focuses even when the error text is unchanged.
  const [failedAttempt, setFailedAttempt] = useState(0);

  // ── Flyer (Phase 1): persist-before-ready ──
  // The flyer is uploaded to Supabase Storage as soon as it is chosen — the
  // "ready" state therefore always means the object exists in persistent
  // storage, and submitting reuses that URL without a second upload. The
  // canonical `events.image_url` is populated later by the approval RPC once
  // the carry-through SQL (supabase/manual/flyer-automation/phase-1/002_update_submission_approval_image.sql)
  // is applied in production.
  const [flyerFile, setFlyerFile] = useState<File | null>(null);
  const [flyerStatus, setFlyerStatus] = useState<EventFlyerStatus>("empty");
  const [flyerError, setFlyerError] = useState<string | null>(null);
  const [flyerPath, setFlyerPath] = useState<string | null>(null);
  const [uploadedFlyerUrl, setUploadedFlyerUrl] = useState<string | null>(null);
  // Tracks the in-flight upload so submit never starts a second one while one
  // is already running. Resolves to the persisted URL or null on failure.
  const flyerUploadPromise = useRef<Promise<string | null> | null>(null);

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
  const extractionGeneration = useRef(0);
  // Synchronous duplicate-click guard: React state updates don't apply
  // mid-event-handler, so two calls to handleExtractFlyer in the same tick
  // would both read `extractionStatus` as "idle" from the same render
  // closure. This ref flips immediately, before any state update or await.
  const isExtracting = useRef(false);

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
    setForm((previous) => ({ ...previous, [field]: value }));
    clearFieldError(field);
  };
  const onChange = (draft: EventFormDraft) => {
    setForm((previous) => {
      setFieldErrors((previousErrors) => {
        if (Object.keys(previousErrors).length === 0) return previousErrors;
        const next = { ...previousErrors };
        let changed = false;
        for (const field of Object.keys(next) as (keyof EventFormDraft)[]) {
          if (previous[field] !== draft[field]) {
            delete next[field as keyof SubmitFieldErrors];
            changed = true;
          }
        }
        return changed ? next : previousErrors;
      });
      return draft;
    });
  };

  const uploadFlyerFile = (file: File): Promise<string | null> => {
    if (!user) return Promise.resolve(null);
    setFlyerStatus("uploading");
    setFlyerError(null);
    const promise = uploadEventFlyer({
      file,
      ownerId: user.id,
      // No canonical event id yet — use a submission-scoped path so the owner
      // RLS policy (foldername[1] = auth.uid()) still matches.
      eventId: `submission-${crypto.randomUUID()}`,
    })
      .then((uploaded) => {
        setUploadedFlyerUrl(uploaded.url);
        setFlyerPath(uploaded.path);
        setFlyerStatus("uploaded");
        return uploaded.url;
      })
      .catch((uploadErr) => {
        setFlyerStatus("upload-error");
        setFlyerError(
          uploadErr instanceof Error ? uploadErr.message : "We couldn't upload this flyer."
        );
        // The applicant can retry or continue manually — the submission is not
        // blocked by a failed upload.
        return null;
      });
    flyerUploadPromise.current = promise;
    return promise;
  };

  // Invalidates any in-flight extraction and clears its result — called
  // whenever the flyer identity changes (replace/remove) so a response that
  // arrives afterward is recognized as stale and ignored.
  const resetExtraction = () => {
    extractionGeneration.current += 1;
    isExtracting.current = false;
    setExtractionStatus("idle");
    setExtractionResult(null);
    setExtractionError(null);
  };

  const handleFlyerChange = (file: File | null) => {
    setFlyerError(null);
    resetExtraction();
    if (!file) {
      // Cleared selection: remove a previously persisted flyer (orphan safety).
      const previousUrl = uploadedFlyerUrl;
      setFlyerFile(null);
      setFlyerStatus("empty");
      setUploadedFlyerUrl(null);
      setFlyerPath(null);
      if (previousUrl) {
        void removeEventFlyer(previousUrl).catch(() => {
          /* best-effort cleanup */
        });
      }
      return;
    }

    // Replacing a previously persisted flyer: remove the old object first so we
    // never leave an orphan sitting in storage.
    const previousUrl = uploadedFlyerUrl;
    setUploadedFlyerUrl(null);
    setFlyerPath(null);
    if (previousUrl) {
      void removeEventFlyer(previousUrl).catch(() => {
        /* best-effort cleanup */
      });
    }

    setFlyerFile(file);
    void uploadFlyerFile(file);
  };

  const handleFlyerRetry = () => {
    setFlyerError(null);
    if (flyerFile) {
      void uploadFlyerFile(flyerFile);
    }
  };

  const handleFlyerRemove = async () => {
    resetExtraction();
    setFlyerStatus("removing");
    try {
      if (uploadedFlyerUrl) {
        await removeEventFlyer(uploadedFlyerUrl);
      }
      setUploadedFlyerUrl(null);
      setFlyerPath(null);
      setFlyerFile(null);
      flyerUploadPromise.current = null;
      setFlyerStatus("empty");
    } catch {
      setFlyerError("We couldn't remove this flyer. Please try again.");
      setFlyerStatus(uploadedFlyerUrl ? "uploaded" : "empty");
    }
  };

  // Runs (or re-runs) extraction for the currently persisted flyer. Guards
  // against duplicate concurrent requests and stamps a generation so a
  // response is only applied if the flyer has not changed since the request
  // started.
  const handleExtractFlyer = () => {
    if (!uploadedFlyerUrl || isExtracting.current) return;
    isExtracting.current = true;
    const generation = ++extractionGeneration.current;
    setExtractionStatus("loading");
    setExtractionError(null);
    extractEventFromFlyer(uploadedFlyerUrl)
      .then((result) => {
        if (extractionGeneration.current !== generation) return;
        isExtracting.current = false;
        setExtractionResult(result);
        setExtractionStatus("success");
      })
      .catch((err) => {
        if (extractionGeneration.current !== generation) return;
        isExtracting.current = false;
        setExtractionResult(null);
        setExtractionStatus("error");
        setExtractionError(err instanceof Error ? err.message : "We couldn't read this flyer.");
      });
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
        city: form.city,
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
    setFieldErrors({});

    // Reuse the URL already persisted for this flyer — submit never performs a
    // second upload. If an upload is still in flight, wait for it to settle.
    let persistedFlyerUrl: string | null = uploadedFlyerUrl;
    if (!persistedFlyerUrl && flyerUploadPromise.current) {
      try {
        persistedFlyerUrl = await flyerUploadPromise.current;
      } catch {
        persistedFlyerUrl = null;
      }
    }

    setIsSubmitting(true);
    try {
      const submission = draftToSubmission(
        form,
        user ? { id: user.id, email: user.email ?? null } : null
      );
      const submissionId = await createSubmission(
        submission,
        // Persist the uploaded flyer URL into submitted_data so the approval
        // carry-through (deferred SQL) can copy it to events.image_url.
        persistedFlyerUrl ? { image_url: persistedFlyerUrl } : undefined
      );
      // The submission is committed. Both emails (submitter confirmation +
      // moderator notification) are deliberately un-awaited: the row is the
      // source of truth, so a mail failure must never turn a successful
      // submission into a visible error. The Edge Function records failures
      // in event_submission_email_attempts for diagnosis.
      void notifySubmissionReceived(submissionId);
      setIsSubmitted(true);
      setForm(buildSubmitDraft(defaultCity));
      setFlyerFile(null);
      setUploadedFlyerUrl(null);
      setFlyerPath(null);
      flyerUploadPromise.current = null;
      setFlyerStatus("empty");
      resetExtraction();
    } catch (err) {
      setServerError(
        publicErrorMessage(err, {
          fallback: "We couldn't submit your event. Please try again.",
        })
      );
      setFailedAttempt((attempt) => attempt + 1);
      // Clean up a flyer that was uploaded but whose submission failed, so we
      // don't leave an orphaned object.
      if (persistedFlyerUrl) {
        try {
          await removeEventFlyer(persistedFlyerUrl);
        } catch {
          /* best-effort */
        }
        setUploadedFlyerUrl(null);
        setFlyerPath(null);
        flyerUploadPromise.current = null;
        setFlyerStatus("empty");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSubmitted = () => setIsSubmitted(false);

  const flyerReady = Boolean(uploadedFlyerUrl);

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
    flyerFile,
    flyerStatus,
    flyerError,
    flyerPath,
    uploadedFlyerUrl,
    flyerReady,
    handleFlyerChange,
    handleFlyerRetry,
    handleFlyerRemove,
    extractionStatus,
    extractionResult,
    extractionError,
    handleExtractFlyer,
    dismissExtractionError,
  };
}
