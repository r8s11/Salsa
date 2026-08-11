import { useAuth } from "../contexts/useAuth";
import { useSubmitEventForm } from "../features/submit-event/useSubmitEventForm";
import EventDetailsFieldset from "../features/submit-event/components/EventDetailsFieldset";
import LocationFieldset from "../features/submit-event/components/LocationFieldset";
import PricingFieldset from "../features/submit-event/components/PricingFieldset";
import YourInfoFieldset from "../features/submit-event/components/YourInfoFieldset";
import SuccessCard from "../features/submit-event/components/SuccessCard";
import "./SubmitEventPage.css";

export default function SubmitEventPage() {
  const { user } = useAuth();
  const { form, update, handleSubmit, isSubmitting, isSubmitted, error, resetSubmitted } =
    useSubmitEventForm();

  if (isSubmitted) {
    return <SuccessCard onReset={resetSubmitted} />;
  }

  return (
    <section className="submit-event">
      <div className="container">
        <h1 className="section-title">Submit an Event</h1>
        <p className="submit-intro">
          Know about a salsa, bachata, or dance event in Greater Boston or NYC? Share it with the
          community! All submissions are reviewed before appearing on the calendar.
        </p>

        {error && (
          <div className="error-banner" role="alert">
            <p>❌ {error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="submit-form">
          <EventDetailsFieldset form={form} update={update} />
          <LocationFieldset form={form} update={update} />
          <PricingFieldset form={form} update={update} />
          <YourInfoFieldset form={form} update={update} email={user?.email ?? ""} />

          <button type="submit" className="btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Event"}
          </button>
        </form>
      </div>
    </section>
  );
}
