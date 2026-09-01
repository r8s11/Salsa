import { useEffect, useRef, useState } from "react";
import { Sparkles, ArrowDown } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import EventForm, { CAPABILITIES } from "../features/events/components/EventForm";
import EventFlyerField from "../features/events/components/EventFlyerField";
import SuccessCard from "../features/submit-event/components/SuccessCard";
import { useSubmissionAccess } from "../features/submit-event/useSubmissionAccess";
import { useSubmitEventForm } from "../features/submit-event/useSubmitEventForm";
import "../styles/forms.css";
import "./SubmitEventPage.css";

type EntryMode = "choice" | "flyer" | "manual";


export default function SubmitEventPage() {
  const { user, isOrganizer } = useAuth();
  const {
    form,
    onChange,
    handleSubmit,
    isSubmitting,
    isSubmitted,
    error,
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
  const [showComingSoon, setShowComingSoon] = useState(false);
  const comingSoonRef = useRef<HTMLDivElement>(null);

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
    // Reveal/scroll to the canonical event form so manual entry continues.
    const formEl = formRef.current;
    if (formEl) {
      formEl.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstField = formEl.querySelector<HTMLElement>("input, textarea, button, [tabindex]");
      firstField?.focus();
    }
  };

  const closeComingSoon = () => {
    setShowComingSoon(false);
    focusForm();
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
        {error && (
          <div className="error-banner" role="alert">
            <p>❌ {error}</p>
          </div>
        )}
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
              <button
                type="button"
                className="btn-primary"
                onClick={() => setEntryMode("flyer")}
                aria-label="Choose to upload a flyer to start"
              >
                Upload Flyer
              </button>
            </div>
            <div className="flyer-choice-card" role="group" aria-label="Enter manually">
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
              <section className="submit-flyer" aria-labelledby="submit-flyer-heading">
                <h2 id="submit-flyer-heading" className="submit-flyer__heading">
                  Start with a flyer
                </h2>
                <p className="submit-flyer__subhead">
                  Upload an event flyer and SalsaSegura will eventually help fill in the event
                  details for you.
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
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowComingSoon(true)}
                    >
                      <Sparkles size={16} aria-hidden /> Extract Event Details
                    </button>
                    <button type="button" className="btn-ghost" onClick={focusForm}>
                      <ArrowDown size={16} aria-hidden /> Continue manually
                    </button>
                  </div>
                )}

                <div className="submit-flyer__divider">
                  <span>or</span>
                </div>
                <button
                  type="button"
                  className="btn-ghost submit-flyer__manual"
                  onClick={focusForm}
                >
                  Continue manually
                </button>
              </section>
            )}

            {/* ── Canonical event form ── */}
            <form ref={formRef} onSubmit={handleSubmit} className="submit-form">
              <EventForm
                draft={form}
                onChange={onChange}
                capabilities={CAPABILITIES.submit}
                requireSubmitterContact={!user}
              />
              <button type="submit" className="btn-primary btn-block" disabled={isSubmitting}>
                {isSubmitting
                  ? "Submitting..."
                  : isOrganizer
                    ? "Submit for review"
                    : "Submit Event"}
              </button>
            </form>
          </>
        )}
      </div>

      {/* ── Coming Soon (honest, not a silent no-op) ── */}
      {showComingSoon && (
        <div className="submit-comingsoon-overlay" onClick={closeComingSoon} role="presentation">
          <div
            className="submit-comingsoon"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coming-soon-title"
            ref={comingSoonRef}
          >
            <h2 id="coming-soon-title">
              <Sparkles size={18} aria-hidden /> Extract Event Details
            </h2>
            <p className="submit-comingsoon__badge">Coming soon</p>
            <p>
              AI flyer extraction is coming soon. Your flyer is already saved and will be used as
              the event image.
            </p>
            <p>You can continue adding the event details manually.</p>
            <button type="button" className="btn-primary" onClick={closeComingSoon}>
              Continue Manually
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
