import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import EventForm, { CAPABILITIES } from "../features/events/components/EventForm";
import EventFlyerField from "../features/events/components/EventFlyerField";
import SuccessCard from "../features/submit-event/components/SuccessCard";
import { useSubmissionAccess } from "../features/submit-event/hooks/useSubmissionAccess";
import { useSubmitEventForm } from "../features/submit-event/hooks/useSubmitEventForm";
import type { SubmitFieldName } from "../features/submit-event/model/validation";
import { extractEventFromFlyer } from "../features/flyer-extraction/client";
import { applyExtractionToDraft } from "../features/flyer-extraction/prefill";
import FormErrorSummary from "../shared/forms/FormErrorSummary";
import Button from "../components/ui/Button";
import "../styles/forms.css";
import "./SubmitEventPage.css";

type EntryMode = "choice" | "flyer" | "manual";
type ExtractionNotice =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; filled: string[]; skipped: string[] }
  | { status: "error"; message: string };

/**
 * Maps each `SubmitFieldName` to the DOM id `EventForm` renders it with, in
 * form order — drives both the error summary's link targets and the order
 * its list is built in.
 */
const FIELD_ORDER: { field: SubmitFieldName; id: string }[] = [
  { field: "title", id: "event-title" },
  { field: "event_type", id: "event-type" },
  { field: "city", id: "event-city" },
  { field: "description", id: "event-description" },
  { field: "dance_styles", id: "event-dance-styles" },
  { field: "event_date", id: "event-date" },
  { field: "location", id: "event-location" },
  { field: "address", id: "event-address" },
  { field: "price_amount", id: "event-price-amount" },
  { field: "rsvp_link", id: "event-rsvp-link" },
  { field: "submitter_name", id: "submitter-name" },
  { field: "submitter_email", id: "submitter-email" },
];

export default function SubmitEventPage() {
  const { user, isOrganizer } = useAuth();
  const {
    form,
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
    uploadedFlyerUrl,
    flyerReady,
    handleFlyerChange,
    handleFlyerRetry,
    handleFlyerRemove,
  } = useSubmitEventForm();
  const submissionAccess = useSubmissionAccess(Boolean(user));
  const [pristineForm] = useState(form);
  const isDirty = JSON.stringify(form) !== JSON.stringify(pristineForm);
  const [entryMode, setEntryMode] = useState<EntryMode>("choice");

  const formRef = useRef<HTMLFormElement>(null);
  const [extractNotice, setExtractNotice] = useState<ExtractionNotice>({ status: "idle" });

  // Only the Host-facing entry point warns before losing typed work — the
  // public submitter flow is intentionally left unchanged in Phase 2.
  useEffect(() => {
    if (!isOrganizer || !isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isOrganizer, isDirty]);

  const focusForm = () => {
    const formEl = formRef.current;
    if (formEl) {
      formEl.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstField = formEl.querySelector<HTMLElement>("input, textarea, button, [tabindex]");
      firstField?.focus();
    }
  };

  const handleExtract = async () => {
    if (!uploadedFlyerUrl || extractNotice.status === "working") return;
    setExtractNotice({ status: "working" });
    try {
      const extraction = await extractEventFromFlyer(uploadedFlyerUrl);
      const result = applyExtractionToDraft(extraction, form);
      onChange(result.draft);
      setExtractNotice({ status: "done", filled: result.filled, skipped: result.skipped });
      focusForm();
    } catch (error) {
      setExtractNotice({
        status: "error",
        message:
          error instanceof Error ? error.message : "We couldn't read this flyer. Please try again.",
      });
    }
  };

  if (isSubmitted) return <SuccessCard onReset={resetSubmitted} />;

  return (
    <section className="submit-event">
      <div className="container">
        {isOrganizer && <p className="submit-event__eyebrow">Host · Create Event</p>}
        <h1 className="section-title">{isOrganizer ? "Create a new event" : "Submit an Event"}</h1>
        <p className="submit-intro">
          {isOrganizer
            ? "Add the details dancers need to discover and attend your event. It goes through moderation review before it appears on the calendar."
            : "Know about a salsa, bachata, or dance event in Greater Boston or NYC? Share it with the community! All submissions are reviewed before appearing on the calendar."}
        </p>
        {submissionAccess.isLoading ? (
          <p role="status">Checking whether submissions are open…</p>
        ) : submissionAccess.error ? (
          <div className="error-banner" role="alert">
            <p>❌ Event submissions are currently unavailable. Please try again later.</p>
          </div>
        ) : !submissionAccess.canSubmit ? (
          <p className="submit-intro">Event submissions are currently closed.</p>
        ) : entryMode === "choice" ? (
          <div className="flyer-choice-grid" role="group" aria-label="How would you like to start?">
            <div className="flyer-choice-card" role="group" aria-label="Upload a flyer">
              <h2>Upload a Flyer</h2>
              <p>Let SalsaSegura help prepare your event using your flyer as the event image.</p>
              <Button onClick={() => setEntryMode("flyer")} aria-label="Choose to upload a flyer to start">Upload Flyer</Button>
            </div>
            <div className="flyer-choice-card" role="group" aria-label="Enter manually">
              <h2>Enter Manually</h2>
              <p>Fill in the event details yourself from the start.</p>
              <Button variant="secondary" onClick={() => setEntryMode("manual")} aria-label="Choose to enter event details manually">Start Manually</Button>
            </div>
          </div>
        ) : (
          <>
            {entryMode === "flyer" && (
              <section className="submit-flyer" aria-labelledby="submit-flyer-heading">
                <h2 id="submit-flyer-heading" className="submit-flyer__heading">
                  Start with a flyer
                </h2>
                <p className="submit-flyer__subhead">
                  Upload an event flyer and SalsaSegura will help fill in the event details for
                  you — review everything before submitting.
                </p>

                {user ? (
                  <EventFlyerField
                    currentUrl={uploadedFlyerUrl}
                    onFileChange={handleFlyerChange}
                    onRemove={handleFlyerRemove}
                    onRetry={handleFlyerRetry}
                    status={flyerStatus}
                    errorMessage={flyerError}
                    disabled={isSubmitting}
                    label="Event flyer"
                    sizeCaption={
                      flyerFile ? `${(flyerFile.size / (1024 * 1024)).toFixed(1)} MB` : null
                    }
                  />
                ) : (
                  <p className="submit-flyer__guest-note" role="note">
                    You must be signed in to upload a flyer. You can still submit event details
                    manually below.
                  </p>
                )}

                {flyerReady && (
                  <div className="submit-flyer__actions">
                    <Button
                      variant="secondary"
                      onClick={handleExtract}
                      loading={extractNotice.status === "working"}
                      loadingLabel="Reading flyer…"
                    >
                      <Sparkles size={16} aria-hidden /> Extract Event Details
                    </Button>
                  </div>
                )}
                {extractNotice.status === "done" && (
                  <div className="submit-flyer__notice" role="status">
                    {extractNotice.filled.length > 0 ? (
                      <p>
                        Filled {extractNotice.filled.join(", ").toLowerCase()} from your flyer —
                        review below before submitting.
                      </p>
                    ) : (
                      <p>
                        Couldn&apos;t pull any details from this flyer — fill in the form
                        manually.
                      </p>
                    )}
                    {extractNotice.skipped.length > 0 && (
                      <p>
                        Couldn&apos;t determine: {extractNotice.skipped.join(", ").toLowerCase()} —
                        fill those in manually.
                      </p>
                    )}
                  </div>
                )}
                {extractNotice.status === "error" && (
                  <div className="submit-flyer__notice" role="alert">
                    <p>{extractNotice.message}</p>
                  </div>
                )}
              </section>
            )}

            {/* ── Canonical event form ── */}
            <form ref={formRef} onSubmit={handleSubmit} className="submit-form" noValidate>
              <FormErrorSummary
                id="submit-error-summary"
                items={FIELD_ORDER.filter(({ field }) => fieldErrors[field]).map(({ field, id }) => ({
                  fieldId: id,
                  message: fieldErrors[field] as string,
                }))}
                serverMessage={serverError}
                focusKey={failedAttempt}
              />
              <p className="submit-form__required-legend">* Required</p>
              <EventForm
                draft={form}
                onChange={onChange}
                capabilities={CAPABILITIES.submit}
                requireSubmitterContact={!user}
                errors={fieldErrors}
              />
              <Button type="submit" block loading={isSubmitting} loadingLabel="Submitting...">
                {isOrganizer ? "Submit for review" : "Submit Event"}
              </Button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
