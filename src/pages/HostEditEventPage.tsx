import { useState, useEffect, useMemo } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { useMyOrganizers } from "../features/host/hooks/useMyOrganizers";
import { useMyOrganizerEvents } from "../features/host/hooks/useMyOrganizerEvents";
import {
  updateOrganizerEvent,
  OrganizerAccessError,
} from "../features/host/api/organizerAccessRepo";
import { assertOrganizerAccess } from "../features/host/api/organizerAccessRepo";
import {
  CAPABILITIES,
  draftToOrganizerUpdatePayload,
} from "../features/events/components/EventForm";
import type { EventFormDraft } from "../features/events/components/EventForm";
import EventForm from "../features/events/components/EventForm";
import EventFlyerField from "../features/events/components/EventFlyerField";
import { removeEventFlyer, uploadEventFlyer } from "../features/events/api/eventFlyers";
import { validateAdminEventForm } from "../features/admin/model/adminEventForm";
import { fromEventDateInstant } from "../features/events/model/eventDateTime";
import type { DatabaseEvent } from "../features/events/model/types";
import "./HostEditEventPage.css";

function eventToDraft(event: DatabaseEvent): EventFormDraft {
  const { date, time } = fromEventDateInstant(event.event_date);
  return {
    title: event.title,
    description: event.description ?? "",
    event_type: event.event_type,
    city: event.city,
    event_date: date,
    event_time: time,
    recurrence: event.recurrence === "weekly" ? "weekly" : "",
    location: event.location ?? "",
    address: event.address ?? "",
    venue_id: event.venue_id ?? "",
    price_type: event.price_type ?? "",
    price_amount: event.price_amount != null ? String(event.price_amount) : "",
    rsvp_link: event.rsvp_link ?? "",
    image_url: event.image_url ?? "",
    host: event.host ?? "",
    contact_email: event.contact_email ?? "",
    contact_instagram: event.contact_instagram ?? "",
    contact_website: event.contact_website ?? "",
    submitter_name: "",
    submitter_email: "",
    dance_styles: event.dance_styles ?? [],
    taxonomy_term_ids: [],
  };
}

export default function HostEditEventPage() {
  const { user } = useAuth();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { events, isLoading: eventsLoading } = useMyOrganizerEvents();
  const { data: organizers = [], isLoading: organizersLoading } = useMyOrganizers();

  const event = useMemo(
    () => events.find((e) => e.id === eventId) ?? null,
    [events, eventId]
  );

  const [form, setForm] = useState<EventFormDraft | null>(null);
  const [flyer, setFlyer] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasWriteAccess, setHasWriteAccess] = useState(false);

  const accessDenied = useMemo(() => {
    if (!event) return false;
    if (!event.organizer_id) return true;
    return false;
  }, [event]);

  // Initialize form when event loads (or when navigating to a different event)
  const [prevEventId, setPrevEventId] = useState<string | null>(null);
  if (event && event.id !== prevEventId) {
    setPrevEventId(event.id);
    setForm(eventToDraft(event));
  }

  // Check write access for the event's organizer
  useEffect(() => {
    if (!event || !user || !event.organizer_id) return;

    const checkAccess = async () => {
      try {
        const membership = await assertOrganizerAccess(event.organizer_id!);
        setHasWriteAccess(
          membership.memberRole === "owner" || membership.memberRole === "manager"
        );
      } catch {
        setHasWriteAccess(false);
      }
    };

    void checkAccess();
  }, [event, user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSaving || !form || !event) return;

    setError(null);
    const validationError = validateAdminEventForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      await updateOrganizerEvent(event.id, draftToOrganizerUpdatePayload(form));

      let flyerWarning: string | null = null;
      if (flyer && user) {
        try {
          const uploaded = await uploadEventFlyer({ file: flyer, ownerId: user.id, eventId: event.id });
          try {
            await updateOrganizerEvent(event.id, { image_url: uploaded.url });
          } catch {
            try {
              await removeEventFlyer(uploaded.url);
            } catch {
              // Best-effort cleanup
            }
            flyerWarning = "Event saved, but we couldn't attach the flyer. You can add it later.";
          }
        } catch {
          flyerWarning = "Event saved, but the flyer couldn't be uploaded. You can add it later.";
        }
      }

      navigate(`/host/events/${event.id}`, {
        state: flyerWarning ? { flyerWarning } : undefined,
      });
    } catch (submissionError) {
      if (
        submissionError instanceof OrganizerAccessError ||
        (submissionError instanceof Error &&
          /permission|owner or manager|organizer access/i.test(submissionError.message))
      ) {
        setError("You don't have permission to edit this event.");
      } else {
        setError("We couldn't save your changes. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = eventsLoading || organizersLoading;

  if (isLoading) {
    return (
      <main className="host-edit-event">
        <p className="host-edit-event__status" role="status">
          Loading event…
        </p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="host-edit-event">
        <Link to="/host/events" className="host-edit-event__back">
          <ArrowLeft size={16} aria-hidden="true" />
          My Events
        </Link>
        <section className="admin-card host-edit-event__empty">
          <h1>Event not found</h1>
          <p>The event you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.</p>
          <Link to="/host/events" className="admin-btn admin-btn--primary">
            Back to My Events
          </Link>
        </section>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="host-edit-event">
        <Link to="/host/events" className="host-edit-event__back">
          <ArrowLeft size={16} aria-hidden="true" />
          My Events
        </Link>
        <section className="admin-card host-edit-event__empty">
          <h1>You don&apos;t have access to edit this event</h1>
          <p>Only active Organizer owners and managers can edit events.</p>
          <Link to="/host/events" className="admin-btn admin-btn--primary">
            Back to My Events
          </Link>
        </section>
      </main>
    );
  }

  if (!hasWriteAccess) {
    return (
      <main className="host-edit-event">
        <Link to="/host/events" className="host-edit-event__back">
          <ArrowLeft size={16} aria-hidden="true" />
          My Events
        </Link>
        <section className="admin-card host-edit-event__empty">
          <h1>You don&apos;t have edit access</h1>
          <p>Only active Organizer owners and managers can edit events.</p>
          <Link to="/host/events" className="admin-btn admin-btn--primary">
            Back to My Events
          </Link>
        </section>
      </main>
    );
  }

  const organizer = organizers.find((o) => o.organizerId === event.organizer_id);

  return (
    <main className="host-edit-event">
      <Link to={`/host/events/${event.id}`} className="host-edit-event__back">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to event
      </Link>

      <header className="host-edit-event__header">
        <p className="host-dashboard__eyebrow">Edit event</p>
        <h1>Edit event</h1>
        {organizer && <p className="host-edit-event__organizer-name">{organizer.organizerName}</p>}
        <p className="host-edit-event__event-title">{event.title}</p>
      </header>

      <form onSubmit={submit}>
        {error && (
          <div className="admin-banner admin-banner--error" role="alert">
            {error}
          </div>
        )}

        {organizer && (
          <section className="admin-card host-edit-event__organizer" role="group" aria-labelledby="host-edit-organizer-label">
            <p id="host-edit-organizer-label">Organizer</p>
            <strong>{organizer.organizerName}</strong>
          </section>
        )}

        {form && (
          <EventForm
            draft={form}
            onChange={setForm}
            capabilities={CAPABILITIES.organizerEdit}
            renderFlyerField={() => (
              <EventFlyerField
                currentUrl={event.image_url}
                onFileChange={setFlyer}
                disabled={isSaving}
                onRemove={() => {
                  setForm((prev) => (prev ? { ...prev, image_url: "" } : prev));
                }}
              />
            )}
          />
        )}

        <div className="host-edit-event__actions">
          <Link to={`/host/events/${event.id}`} className="admin-btn admin-btn--secondary">
            Cancel
          </Link>
          <button
            type="submit"
            className="admin-btn admin-btn--primary"
            disabled={isSaving || !form}
          >
            {isSaving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </main>
  );
}
