import { useEffect, useState } from "react";
import { useAuth } from "../contexts/useAuth";
import EventForm, { CAPABILITIES } from "../features/events/components/EventForm";
import SuccessCard from "../features/submit-event/components/SuccessCard";
import { useSubmissionAccess } from "../features/submit-event/useSubmissionAccess";
import { useSubmitEventForm } from "../features/submit-event/useSubmitEventForm";
import "../styles/forms.css";
import "./SubmitEventPage.css";

export default function SubmitEventPage() {
  const { user, isOrganizer } = useAuth();
  const { form, onChange, handleSubmit, isSubmitting, isSubmitted, error, resetSubmitted } =
    useSubmitEventForm();
  const submissionAccess = useSubmissionAccess(Boolean(user));
  const [pristineForm] = useState(form);
  const isDirty = JSON.stringify(form) !== JSON.stringify(pristineForm);

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
        ) : (
          <form onSubmit={handleSubmit} className="submit-form">
            <EventForm draft={form} onChange={onChange} capabilities={CAPABILITIES.submit} />
            <button type="submit" className="btn-primary btn-block" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : isOrganizer ? "Submit for review" : "Submit Event"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
