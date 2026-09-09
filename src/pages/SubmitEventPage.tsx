import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import EventForm, { CAPABILITIES } from "../features/events/components/EventForm";
import EventFlyerField from "../features/events/components/EventFlyerField";
import FlyerExtractionPanel from "../features/flyer-extraction/FlyerExtractionPanel";
import SuccessCard from "../features/submit-event/components/SuccessCard";
import { useSubmissionAccess } from "../features/submit-event/useSubmissionAccess";
import { useSubmitEventForm } from "../features/submit-event/useSubmitEventForm";
import type { SubmitFieldName } from "../features/submit-event/validation";
import FormErrorSummary from "../shared/forms/FormErrorSummary";
import "../styles/forms.css";
import "./SubmitEventPage.css";

type EntryMode = "choice" | "flyer" | "manual";

/** Maps each `SubmitFieldName` to the DOM id `EventForm` renders it with, in
 * form order — drives both the error summary's link targets and the order
 * its list is built in. */
const FIELD_ORDER: { field: SubmitFieldName; id: string }[] = [
  { field: "title", id: "event-title" },
  { field: "event_type", id: "event-type" },
  { field: "dance_styles", id: "dance-styles" },
  { field: "city", id: "event-city" },
  { field: "description", id: "event-description" },
  { field: "event_date", id: "event-date" },
  { field: "event_time", id: "event-time" },
  { field: "location", id: "event-location" },
  { field: "address", id: "event-address" },
  { field: "price_amount", id: "event-price-amount" },
  { field: "rsvp_link", id: "event-rsvp-link" },
  { field: "submitter_name", id: "submitter-name" },
  { field: "submitter_email", id: "submitter-email" },
];

export default function SubmitEventPage() {
  const { user } = useAuth();
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
    extractFlyer,
    extractedEvent,
    reconciliation,
    isExtracting,
    extractionError,
    applyFlyerExtraction,
  } = useSubmitEventForm();
  const submissionAccess = useSubmissionAccess(Boolean(user));
  const [pristineForm] = useState(form);
  const isDirty = JSON.stringify(form) !== JSON.stringify(pristineForm);
  const [entryMode, setEntryMode] = useState<EntryMode>("choice");

  const formRef = useRef<HTMLFormElement>(null);
  const [showAppliedBanner, setShowAppliedBanner] = useState(false);
  const appliedBannerRef = useRef<HTMLDivElement>(null);

  const handleApplyExtraction = () => {
    applyFlyerExtraction();
    setShowAppliedBanner(true);
  };

  // Only the Host-facing entry point warns before losing typed work.
  useEffect(() => {
    if (!user || !isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [user, isDirty]);

  if (isSubmitted) return <SuccessCard onReset={resetSubmitted} />;

  return (
    <section className="submit-event">
      <div className="container">
        <h1 className="section-title">
          {user ? "Create a new event" : "Submit an Event"}
        </h1>
        <p className="submit-intro">
          {user
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
          <div
            className="flyer-choice-grid"
            role="group"
            aria-label="How would you like to start?"
          >
            <div
              className="flyer-choice-card"
              role="group"
              aria-label="Upload a flyer"
            >
              <h2>Upload a Flyer</h2>
              <p>
                Let SalsaSegura help prepare your event using your flyer as the
                event image.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setEntryMode("flyer")}
                aria-label="Choose to upload a flyer to start"
              >
                Upload Flyer
              </button>
            </div>
            <div
              className="flyer-choice-card"
              role="group"
              aria-label="Enter manually"
            >
              <h2>Enter Manually</h2>
              <p>Fill in the event details yourself from the start.</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEntryMode("manual")}
                aria-label="Choose to enter event details manually"
              >
                Start Manually
              </button>
            </div>
          </div>
        ) : (
          <>
            {entryMode === "flyer" && (
              <section
                className="submit-flyer"
                aria-labelledby="submit-flyer-heading"
              >
                <h2
                  id="submit-flyer-heading"
                  className="submit-flyer__heading"
                >
                  Start with a flyer
                </h2>
                <p className="submit-flyer__subhead">
                  Upload an event flyer and SalsaSegura will help fill in the
                  event details for you.
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
                      flyerFile
                        ? `${(flyerFile.size / (1024 * 1024)).toFixed(1)} MB`
                        : null
                    }
                  />
                ) : (
                  <p className="submit-flyer__guest-note" role="note">
                    You must be signed in to upload a flyer. You can still
                    submit event details manually below.
                  </p>
                )}

                {flyerReady && flyerStatus !== "extracting" && !extractedEvent && (
                  <div className="submit-flyer__actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={extractFlyer}
                      disabled={isExtracting}
                    >
                      {isExtracting ? (
                        <>
                          <span
                            className="flyer-extraction-panel_status_spinner"
                            aria-hidden
                          />
                          Analyzing…
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} aria-hidden />
                          Extract Event Details
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setEntryMode("manual")}
                    >
                      Continue manually
                    </button>
                  </div>
                )}

                {flyerStatus === "extracting" && (
                  <div className="flyer-extraction-panel">
                    <div className="flyer-extraction-panel__status">
                      <span
                        className="flyer-extraction-panel_status_spinner"
                        aria-hidden
                      />
                      <span className="flyer-extraction-panel_status_text">
                        Analyzing your flyer
                      </span>
                    </div>
                  </div>
                )}

                {extractedEvent && (
                  <div className="flyer-extraction-panel">
                    <FlyerExtractionPanel
                      event={extractedEvent}
                      isAnalyzing={isExtracting}
                      error={extractionError}
                      onAnalyze={extractFlyer}
                      onUseTheseDetails={handleApplyExtraction}
                      reconciliation={reconciliation}
                    />

                    {showAppliedBanner && (
                      <div
                        className="form-status form-status_success"
                        role="status"
                        aria-label="Details added to your event form"
                        ref={appliedBannerRef}
                      >
                        Details added to your event form. Review everything
                        before submitting.
                      </div>
                    )}
                  </div>
                )}

                {flyerStatus === "extraction-error" && (
                  <div className="flyer-extraction-failure">
                    <p className="flyer-extraction-failure_heading">
                      We couldn&apos;t read this flyer
                    </p>
                    <p className="flyer-extraction-failure_text">
                      {flyerError}
                    </p>
                    <div className="flyer-extraction-failure_actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleFlyerRetry}
                      >
                        Try Again
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setEntryMode("manual")}
                      >
                        Continue manually
                      </button>
                    </div>
                  </div>
                )}

                <div className="submit-flyer__divider">
                  <span>or</span>
                </div>
                <button
                  type="button"
                  className="btn-ghost submit-flyer__manual"
                  onClick={() => setEntryMode("manual")}
                >
                  Continue manually
                </button>
              </section>
            )}

            {/* ── Canonical event form ── */}
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="submit-form"
              noValidate
            >
              <FormErrorSummary
                id="submit-error-summary"
                items={FIELD_ORDER
                  .filter(({ field }) => fieldErrors[field])
                  .map(({ field, id }) => ({
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
              <button
                type="submit"
                className="btn-primary btn-block"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Submitting..."
                  : user
                    ? "Submit for review"
                    : "Submit Event"}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
