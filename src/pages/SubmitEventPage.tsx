import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Sparkles, XCircle } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { ADMIN_EVENT_CREATE_PATH } from "../lib/eventCreateDestination";
import { useOwnProfile } from "../features/account/hooks/useOwnProfile";
import { resolveIdentity } from "../features/account/model/account";
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
  const { user, isAdmin, isOrganizer } = useAuth();
  const { profile } = useOwnProfile(user?.id);
  const authenticatedSubmitterName = user
    ? profile
      ? resolveIdentity(profile).name
      : (
          (user.user_metadata as Record<string, unknown> | undefined)?.full_name as
            string | undefined
        )?.trim() || "SalsaSegura member"
    : null;
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
    extractionAttempts,
    prefillFeedback,
    reconciliation,
    handleExtractFlyer,
    dismissExtractionError,
  } = useSubmitEventForm(authenticatedSubmitterName);
  const submissionAccess = useSubmissionAccess(Boolean(user));
  const [pristineForm] = useState(form);
  const isDirty = JSON.stringify(form) !== JSON.stringify(pristineForm);

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
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      formEl.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
      const firstField = formEl.querySelector<HTMLElement>("input, textarea, button, [tabindex]");
      firstField?.focus();
    }
  };

  // An Admin reaching the public flow (bookmark, deep link, or a shared CTA)
  // intends to create a platform event, not file a moderated submission.
  // /submit itself stays public — this only re-routes the Admin role, and the
  // Admin create view never renders this page, so no redirect loop exists.
  if (isAdmin) return <Navigate to={ADMIN_EVENT_CREATE_PATH} replace />;

  if (isSubmitted)
    return (
      <SuccessCard
        onReset={resetSubmitted}
        trackPath={user ? (isOrganizer ? "/host/events" : "/profile") : null}
      />
    );

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
              : "Know about a salsa, bachata, or dance event near you? Share it with the community! All submissions are reviewed before appearing on the calendar."}
          </p>
        </header>

        {submissionAccess.isLoading ? (
          <p className="submit-event__status" role="status">
            Checking whether submissions are open…
          </p>
        ) : submissionAccess.error ? (
          <div className="submit-event__banner submit-event__banner--error" role="alert">
            <p>
              <XCircle size={16} aria-hidden="true" style={{ verticalAlign: "-0.15em" }} /> Event
              submissions are currently unavailable. Please try again later.
            </p>
          </div>
        ) : !submissionAccess.canSubmit ? (
          <p className="submit-event__status">Event submissions are currently closed.</p>
        ) : (
          <div className="submit-event__flow">
            <section className="submit-flyer" aria-labelledby="submit-flyer-heading">
              <h2 id="submit-flyer-heading" className="submit-flyer__heading">
                Start with the flyer
              </h2>
              <p className="submit-flyer__subhead">
                Optional. Upload the event flyer and SalsaSegura reads the details off it, so the
                form below starts mostly filled in. Prefer to type? Skip straight to the details.
              </p>

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

              {flyerReady && extractionStatus === "idle" && (
                <div className="submit-flyer__actions">
                  {user ? (
                    <Button variant="secondary" onClick={handleExtractFlyer}>
                      <Sparkles size={16} aria-hidden /> Extract Event Details
                    </Button>
                  ) : (
                    <p className="submit-flyer__guest-note" role="note">
                      <strong>Extract details with AI</strong>
                      <Link to="/signin" target="_blank" rel="noreferrer">
                        Sign in to automatically extract event details from your flyer.
                      </Link>
                    </p>
                  )}
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
                    remainingRetries={Math.max(0, 3 - extractionAttempts)}
                  />
                  {extractionStatus === "success" && prefillFeedback && (
                    <div className="submit-flyer__notice" role="status">
                      {prefillFeedback.filled.length > 0 ? (
                        <p>
                          Filled {prefillFeedback.filled.join(", ").toLowerCase()} from your flyer —
                          review below before submitting.
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

            <form ref={formRef} onSubmit={handleSubmit} className="submit-form" noValidate>
              <div className="submit-form__card">
                <FormErrorSummary
                  id="submit-error-summary"
                  items={FIELD_ORDER.filter(({ field }) => fieldErrors[field]).map(
                    ({ field, id }) => ({
                      fieldId: id,
                      message: fieldErrors[field] as string,
                    })
                  )}
                  serverMessage={serverError}
                  focusKey={failedAttempt}
                />
                <p className="submit-form__required-legend">* Required</p>
                <EventForm
                  draft={form}
                  onChange={onChange}
                  capabilities={CAPABILITIES.submit}
                  requireSubmitterContact={!user}
                  authenticatedSubmitterName={authenticatedSubmitterName}
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
