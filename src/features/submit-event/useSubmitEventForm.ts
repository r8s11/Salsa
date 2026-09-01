import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { createSubmission } from "../admin/api/submissionsRepo";
import { uploadEventFlyer, removeEventFlyer } from "../events/api/eventFlyers";
import { useCity } from "../../contexts/useCity";
import { useAuth } from "../../contexts/useAuth";
import { buildInitialForm, validateSubmitForm } from "./validation";
import { notifySubmissionReceived } from "./submissionNotification";
import type { EventFormDraft } from "../events/components/EventForm";
import { draftToSubmission } from "../events/components/EventForm";
import type { EventFlyerStatus } from "../events/components/EventFlyerField";

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
  const [error, setError] = useState<string | null>(null);

  // ── Flyer (Phase 1): persist-before-ready ──
  // The flyer is uploaded to Supabase Storage as soon as it is chosen — the
  // "ready" state therefore always means the object exists in persistent
  // storage, and submitting reuses that URL without a second upload. The
  // canonical `events.image_url` is populated later by the approval RPC once
  // the carry-through SQL (sql/flyer-automation/phase-1/002_update_submission_approval_image.sql)
  // is applied in production.
  const [flyerFile, setFlyerFile] = useState<File | null>(null);
  const [flyerStatus, setFlyerStatus] = useState<EventFlyerStatus>("empty");
  const [flyerError, setFlyerError] = useState<string | null>(null);
  const [flyerPath, setFlyerPath] = useState<string | null>(null);
  const [uploadedFlyerUrl, setUploadedFlyerUrl] = useState<string | null>(null);
  // Tracks the in-flight upload so submit never starts a second one while one
  // is already running. Resolves to the persisted URL or null on failure.
  const flyerUploadPromise = useRef<Promise<string | null> | null>(null);

  const update = <K extends keyof EventFormDraft>(field: K, value: EventFormDraft[K]) =>
    setForm((previous) => ({ ...previous, [field]: value }));
  const onChange = (draft: EventFormDraft) => setForm(draft);

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

  const handleFlyerChange = (file: File | null) => {
    setFlyerError(null);
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const validationError = validateSubmitForm(
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
    if (validationError) {
      setError(validationError);
      return;
    }

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
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
    error,
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
  };
}