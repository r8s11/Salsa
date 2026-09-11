import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import { useMyOrganizers } from "../features/host/hooks/useMyOrganizers";
import {
  createOrganizerEvent,
  OrganizerAccessError,
  updateOrganizerEvent,
} from "../features/host/api/organizerAccessRepo";
import {
  CAPABILITIES,
  draftToOrganizerCreatePayload,
} from "../features/events/components/EventForm";
import type { EventFormDraft } from "../features/events/components/EventForm";
import EventForm from "../features/events/components/EventForm";
import EventFlyerField from "../features/events/components/EventFlyerField";
import { removeEventFlyer, uploadEventFlyer } from "../features/events/api/eventFlyers";
import { buildEmptyAdminForm, validateAdminEventForm } from "../features/admin/model/adminEventForm";
import { useCity } from "../contexts/useCity";
import "./HostCreateEventPage.css";

export default function HostCreateEventPage() {
  const { user } = useAuth();
  const { city } = useCity();
  const navigate = useNavigate();
  const {
    data: organizers = [],
    isLoading,
    error: organizersError,
    refetch: refetchOrganizers,
  } = useMyOrganizers();
  const manageable = organizers.filter(
    (organizer) =>
      organizer.organizerStatus === "active" &&
      (organizer.memberRole === "owner" || organizer.memberRole === "manager")
  );
  const [form, setForm] = useState<EventFormDraft>(() => buildEmptyAdminForm(city));
  const [organizerId, setOrganizerId] = useState("");
  const [flyer, setFlyer] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedOrganizerId =
    organizerId || (manageable.length === 1 ? manageable[0].organizerId : "");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const shouldPublish = submitter?.value === "publish";
    setError(null);
    const validationError = validateAdminEventForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!selectedOrganizerId) {
      setError("Choose an active organizer with owner or manager access before creating this event.");
      return;
    }
    if (!user) {
      setError("You must be signed in to create an event.");
      return;
    }

    setIsSaving(true);
    try {
      const eventId = await createOrganizerEvent(
        selectedOrganizerId,
        draftToOrganizerCreatePayload(form),
        shouldPublish
      );
      let flyerWarning: string | null = null;
      if (flyer) {
        try {
          const uploaded = await uploadEventFlyer({ file: flyer, ownerId: user.id, eventId });
          try {
            await updateOrganizerEvent(eventId, { image_url: uploaded.url });
          } catch {
            try {
              await removeEventFlyer(uploaded.url);
            } catch {
              // Best-effort cleanup; the event itself remains safely created.
            }
            flyerWarning = "Event saved, but we couldn't attach the flyer. You can add it later.";
          }
        } catch {
          flyerWarning = "Event saved, but the flyer couldn't be uploaded. You can add it later.";
        }
      }
      navigate(`/host/events/${eventId}`, {
        state: flyerWarning ? { flyerWarning } : undefined,
      });
    } catch (submissionError) {
      if (
        submissionError instanceof OrganizerAccessError ||
        (submissionError instanceof Error &&
          /permission|owner or manager|organizer access/i.test(submissionError.message))
      ) {
        setError("You don't have permission to create events for this organizer.");
      } else {
        setError("We couldn't create this event. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className="host-create-event__status" role="status">Checking organizer access…</p>;
  }

  if (organizersError) {
    return (
      <section className="host-create-event">
        <Link to="/host/events" className="host-create-event__back">← My Events</Link>
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn&apos;t check organizer access. Please try again.</p>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void refetchOrganizers()}>
            Try Again
          </button>
        </div>
      </section>
    );
  }

  if (manageable.length === 0) {
    const hasMembership = organizers.length > 0;
    return (
      <section className="host-create-event">
        <Link to="/host/events" className="host-create-event__back">← My Events</Link>
        <section className="admin-card host-create-event__empty">
          <p className="host-dashboard__eyebrow">Create event</p>
          <h1>{hasMembership ? "You don't have create access" : "Create an Organizer first"}</h1>
          <p>
            {hasMembership
              ? "Only active Organizer owners and managers can create events. Ask an owner to update your access."
              : "You need an approved Organizer with owner or manager access before you can create events."}
          </p>
          <Link to="/host/events" className="admin-btn admin-btn--primary">Back to My Events</Link>
        </section>
      </section>
    );
  }

  return (
    <section className="host-create-event">
      <Link to="/host/events" className="host-create-event__back">← My Events</Link>
      <header className="host-create-event__header">
        <p className="host-dashboard__eyebrow">Create event</p>
        <h1>Create an event</h1>
        <p>Add the details dancers need to discover and attend your event.</p>
      </header>

      <form onSubmit={submit}>
        <section className="admin-card host-create-event__organizer" role="group" aria-labelledby="host-event-organizer-label">
          <p id="host-event-organizer-label">Creating event for</p>
          {manageable.length === 1 ? (
            <strong>{manageable[0].organizerName}</strong>
          ) : (
            <select
              id="host-event-organizer"
              aria-labelledby="host-event-organizer-label"
              value={selectedOrganizerId}
              onChange={(event) => setOrganizerId(event.target.value)}
              required
            >
              <option value="">Choose an organizer</option>
              {manageable.map((organizer) => (
                <option key={organizer.organizerId} value={organizer.organizerId}>
                  {organizer.organizerName}
                </option>
              ))}
            </select>
          )}
        </section>

        {error && <div className="admin-banner admin-banner--error" role="alert">{error}</div>}
        <EventForm
          draft={form}
          onChange={setForm}
          capabilities={CAPABILITIES.organizerCreate}
          renderFlyerField={() => (
            <EventFlyerField
              currentUrl={null}
              onFileChange={setFlyer}
              disabled={isSaving}
            />
          )}
        />
        <div className="host-create-event__actions">
          <Link to="/host/events" className="admin-btn admin-btn--secondary">Cancel</Link>
          <button type="submit" value="draft" className="admin-btn admin-btn--secondary" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save Draft"}
          </button>
          <button type="submit" value="publish" className="admin-btn admin-btn--primary" disabled={isSaving}>
            {isSaving ? "Publishing…" : "Publish Event"}
          </button>
        </div>
      </form>
    </section>
  );
}
