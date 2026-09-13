import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import EventForm, { CAPABILITIES } from "../features/events/components/EventForm";
import EventFlyerField from "../features/events/components/EventFlyerField";
import FlyerExtractionPanel from "../features/flyer-extraction/FlyerExtractionPanel";
import SuccessCard from "../features/submit-event/components/SuccessCard";
import { useSubmissionAccess } from "../features/submit-event/hooks/useSubmissionAccess";
import { useSubmitEventForm } from "../features/submit-event/hooks/useSubmitEventForm";
import type { SubmitFieldName } from "../features/submit-event/model/validation";
import FormErrorSummary from "../shared/forms/FormErrorSummary";
import Button from "../components/ui/Button";
import "../styles/forms.css";
import "./SubmitEventPage.css";

type EntryMode = "choice" | "flyer" | "manual";

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
    extractionStatus,
    extractionResult,
    extractionError,
    prefillFeedback,
    reconciliation,
    handleExtractFlyer,
    dismissExtractionError,
  } = useSubmitEventForm();
  const submissionAccess = useSubmissionAccess(Boolean(user));
  const [pristineForm] = useState(form);
  const isDirty = JSON.stringify(form) !== JSON.stringify(pristineForm);
  const [entryMode, setEntryMode] = useState<EntryMode>("choice");

  const formRef = useRef<HTMLFormElement>(null);

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

  if (isSubmitted) return <SuccessCard onReset={resetSubmitted} />;

  return (
    <section className="submit-event">
      <div className="container">
        <header className="submit-event__header">
          {isOrganizer && <p className="submit-event__eyebrow">Host · Create Event</p>}
          <h1 className="submit-event__title">
            {isOrganizer ? "Create a new event" : "Submit an Event"}
          </h1>
          <p className="submit-event__intro">
            {isOrganizer
              ? "Add the details dancers need to discover and attend your event. It goes through moderation review before it appears on the calendar."
              : "Know about a salsa, bachata, or dance event in Greater Boston or NYC? Share it with the community! All submissions are reviewed before appearing on the calendar."}
          </p>
        </header>

        {submissionAccess.isLoading ? (
          <p className="submit-event__status" role="status">
            Checking whether submissions are open…
          </p>
        ) : submissionAccess.error ? (
          <div className="submit-event__banner submit-event__banner--error" role="alert">
            <p>❌ Event submissions are currently unavailable. Please try again later.</p>
          </div>
        ) : !submissionAccess.canSubmit ? (
          <p className="submit-event__status">Event submissions are currently closed.</p>
        ) : entryMode === "choice" ? (
          <div className="submit-entry" role="group" aria-label="How would you like to start?">
            <button
              type="button"
              className="submit-entry__card submit-entry__card--flyer"
              onClick={() => setEntryMode("flyer")}
              aria-label="Upload a flyer to start"
            >
              <span className="submit-entry__card-icon" aria-hidden="true">
                <Sparkles />
              </span>
              <h2 className="submit-entry__card-title">I have a flyer</h2>
              <p className="submit-entry__card-text">
                Upload your flyer and SalsaSegura will help fill in the details for you — review everything before submitting.
              </p>
              <span className="submit-entry__card-cta">Upload Flyer</span>
            </button>
            <button
              type="button"
              className="submit-entry__card submit-entry__card--manual"
              onClick={() => setEntryMode("manual")}
              aria-label="Enter event details manually"
            >
              <span className="submit-entry__card-glyph" aria-hidden="true">
                ✎
              </span>
              <h2 className="submit-entry__card-title">Start manually</h2>
              <p className="submit-entry__card-text">
                Fill in the event details yourself from the start.
              </p>
              <span className="submit-entry__card-cta">Enter Manually</span>
            </button>
          </div>
        ) : (
          <div className="submit-event__flow">
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

                {flyerReady && extractionStatus === "idle" && (
                  <div className="submit-flyer__actions">
                    <Button variant="secondary" onClick={handleExtractFlyer}>
                      <Sparkles size={16} aria-hidden /> Extract Event Details
                    </Button>
                  </div>
                )}

                {flyerReady && extractionStatus !== "idle" && (
                  <>
                    <FlyerExtractionPanel
                      status={extractionStatus}
                      result={extractionResult}
                      error={extractionError}
                      onRetry={handleExtractFlyer}
                      onDismiss={() => {
                        dismissExtractionError();
                        focusForm();
                      }}
                    />
                    {extractionStatus === "success" && prefillFeedback && (
                      <div className="submit-flyer__notice" role="status">
                        {prefillFeedback.filled.length > 0 ? (
                          <p>
                            Filled {prefillFeedback.filled.join(", ").toLowerCase()} from your
                            flyer — review below before submitting.
                          </p>
                        ) : (
                          <p>
                            Couldn&apos;t pull any details from this flyer — fill in the form
                            manually.
                          </p>
                        )}
                        {prefillFeedback.skipped.length > 0 && (
                          <p>
                            Couldn&apos;t determine:{" "}
                            {prefillFeedback.skipped.join(", ").toLowerCase()} — fill those in
                            manually.
                          </p>
                        )}
                      </div>
                    )}
                    {reconciliation.status === "loading" && (
                      <p className="submit-flyer__notice" role="status">
                        Checking the venue details…
                      </p>
                    )}
                    {reconciliation.status === "success" &&
                      (reconciliation.response?.venue.status === "exact" ||
                        reconciliation.response?.venue.status === "strong") && (
                        <p className="submit-flyer__notice" role="status">
                          Matched to an existing SalsaSegura venue.
                        </p>
                      )}
                  </>
                )}
              </section>
            )}

            <form ref={formRef} onSubmit={handleSubmit} className="submit-form" noValidate>
              <div className="submit-form__card">
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
              </div>
              <div className="submit-form__bar">
                <Button type="submit" block loading={isSubmitting} loadingLabel="Submitting...">
                  {isOrganizer ? "Submit for review" : "Submit Event"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
