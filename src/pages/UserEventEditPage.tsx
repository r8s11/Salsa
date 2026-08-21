import { useEffect, useState, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/useAuth";
import { useMySubmissions } from "../hooks/useMySubmissions";
import { validateSubmitForm, type SubmitForm } from "../features/submit-event/validation";
import { toEventDateInstant, fromEventDateInstant } from "../features/events/model/eventDateTime";
import type { DatabaseEvent, City } from "../features/events/model/types";
import {
  updateEventForUser,
  type UserEventUpdatePayload,
  deleteEventForUser,
} from "../features/events/api/eventsRepo";
import { removeEventFlyer, uploadEventFlyer } from "../features/events/api/eventFlyers";
import EventFlyerField from "../features/events/components/EventFlyerField";
import EventDetailsFieldset from "../features/submit-event/components/EventDetailsFieldset";
import LocationFieldset from "../features/submit-event/components/LocationFieldset";
import PricingFieldset from "../features/submit-event/components/PricingFieldset";
import "../styles/forms.css";
import "./UserEventEditPage.css";

function buildUserFormFromEvent(event: DatabaseEvent): SubmitForm {
  const { date, time } = fromEventDateInstant(event.event_date);
  return {
    title: event.title,
    description: event.description ?? "",
    event_type: event.event_type,
    city: event.city,
    event_date: date,
    event_time: time,
    location: event.location ?? "",
    address: event.address ?? "",
    price_type: event.price_type ?? "",
    price_amount: event.price_amount != null ? String(event.price_amount) : "",
    rsvp_link: event.rsvp_link ?? "",
    submitter_name: event.submitter_name ?? "",
    submitter_email: event.submitter_email ?? "",
    recurrence: event.recurrence === "weekly" ? "weekly" : "",
    dance_styles: event.taxonomy_terms
      .filter((term) => term.category === "dance_style")
      .map((term) => term.slug),
  };
}

function userFormToPayload(form: SubmitForm): UserEventUpdatePayload {
  return {
    title: form.title,
    description: form.description || null,
    event_type: form.event_type as UserEventUpdatePayload["event_type"],
    city: form.city as City,
    event_date: toEventDateInstant(form.event_date, form.event_time),
    event_time: form.event_time || null,
    location: form.location || null,
    address: form.address || null,
    price_type: form.price_type === "free" || form.price_type === "paid" ? form.price_type : null,
    price_amount: form.price_amount ? parseFloat(form.price_amount) : null,
    rsvp_link: form.rsvp_link || null,
    recurrence: form.recurrence || null,
    dance_styles: form.dance_styles,
  };
}

export default function UserEventEditPage() {
  const { user } = useAuth();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { submissions, isLoading, error: loadError } = useMySubmissions(user?.id);
  const [editingEvent, setEditingEvent] = useState<DatabaseEvent | null>(null);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [form, setForm] = useState<SubmitForm | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [selectedFlyer, setSelectedFlyer] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const update = (field: keyof SubmitForm, value: string | string[]) =>
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));

  // Resolve the event to edit from the user's submissions once they load.
  useEffect(() => {
    if (!eventId || !submissions) return;
    const event = submissions.find((e) => e.id === eventId);
    if (event) {
      setEditingEvent(event);
      setForm(buildUserFormFromEvent(event));
    } else {
      // Event not found among submissions — redirect to profile
      navigate("/profile");
    }
  }, [eventId, submissions, navigate]);

  useEffect(() => {
    // Redirect if not editable (approved or not found)
    if (editingEvent && editingEvent.status !== "pending" && editingEvent.status !== "rejected") {
      navigate("/profile");
    }
  }, [editingEvent, navigate]);
  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UserEventUpdatePayload }) =>
      updateEventForUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions", "mine", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["approved-events", "mine", user?.id] });
    },
  });

  // Allows the original submitter to withdraw (hard-delete) their own event
  // while it is still pending. The RLS DELETE policy enforces
  // submitter_id = auth.uid() AND status = 'pending' at the database layer.
  const withdrawMutation = useMutation({
    mutationFn: deleteEventForUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions", "mine", user?.id] });
      navigate("/profile");
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);
    if (!form || !editingEvent || !user) return;

    const validationError = validateSubmitForm(form);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    const previousFlyerUrl = editingEvent.image_url;
    let uploadedFlyerUrl: string | null = null;
    setIsSaving(true);
    try {
      const payload = userFormToPayload(form);
      if (selectedFlyer) {
        const uploadedFlyer = await uploadEventFlyer({
          file: selectedFlyer,
          ownerId: user.id,
          eventId: editingEvent.id,
        });
        uploadedFlyerUrl = uploadedFlyer.url;
        payload.image_url = uploadedFlyer.url;
      }

      await saveMutation.mutateAsync({ id: editingEvent.id, payload });
    } catch (err) {
      if (uploadedFlyerUrl) {
        try {
          await removeEventFlyer(uploadedFlyerUrl);
        } catch {
          // Preserve the primary save/upload error for the organizer.
        }
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      setSaveError(message);
      return;
    } finally {
      setIsSaving(false);
    }

    if (uploadedFlyerUrl) {
      setEditingEvent((event) => (event ? { ...event, image_url: uploadedFlyerUrl } : event));
      setSelectedFlyer(null);
    }
    setSaveSuccess("Changes saved.");

    if (uploadedFlyerUrl && previousFlyerUrl) {
      try {
        await removeEventFlyer(previousFlyerUrl);
      } catch {
        // The new flyer is already persisted; stale-object cleanup is best effort.
      }
    }
  };

  const handleWithdraw = async () => {
    if (!editingEvent) return;
    if (
      window.confirm(
        `Withdraw "${editingEvent.title}"? This will permanently delete the submission and cannot be undone.`
      )
    ) {
      await withdrawMutation.mutateAsync(editingEvent.id);
    }
  };

  if (!user) {
    navigate("/signin");
    return null;
  }

  if (isLoading || !submissions) {
    return (
      <main className="user-edit-page">
        <div className="container">
          <p className="user-edit-page__status" role="status">
            Loading your event…
          </p>
        </div>
      </main>
    );
  }

  if (!eventId || !editingEvent || !form) {
    return (
      <main className="user-edit-page">
        <div className="container">
          <p className="user-edit-page__status">
            {loadError
              ? `Couldn't load your submissions: ${loadError}`
              : "Event not found or no longer editable."}
          </p>
          <button type="button" className="btn-secondary" onClick={() => navigate("/profile")}>
            Back to Profile
          </button>
        </div>
      </main>
    );
  }

  const isEditable = editingEvent.status === "pending" || editingEvent.status === "rejected";
  const canWithdraw = editingEvent.status === "pending";

  return (
    <main className="user-edit-page">
      <div className="container user-edit-page__content">
        <header className="user-edit-page__header">
          <span className="user-edit-page__eyebrow">◆ Community</span>
          <h1>Edit event</h1>
          <p>
            Update your event details. Changes stay in review until they are ready for the public
            calendar.
          </p>
        </header>

        {!isEditable && (
          <div className="error-banner" role="alert">
            <p>
              ❌ This event has been approved and can no longer be edited. Contact an admin if you
              need changes.
            </p>
          </div>
        )}

        {saveError && (
          <div className="error-banner" role="alert">
            <p>❌ {saveError}</p>
          </div>
        )}

        {saveSuccess && (
          <p className="user-edit-page__success" role="status">
            {saveSuccess}
          </p>
        )}

        {isEditable && (
          <form onSubmit={handleSubmit} className="submit-form user-edit-page__form">
            <EventDetailsFieldset form={form} update={update} />
            <LocationFieldset form={form} update={update} />
            <PricingFieldset form={form} update={update} />
            <section className="user-edit-page__flyer" aria-labelledby="event-flyer-heading">
              <div>
                <h2 id="event-flyer-heading">Event artwork</h2>
                <p>Use a clear poster or banner so dancers recognize the night at a glance.</p>
              </div>
              <EventFlyerField
                key={editingEvent.image_url}
                currentUrl={editingEvent.image_url}
                onFileChange={setSelectedFlyer}
                disabled={isSaving}
              />
            </section>

            <div className="user-edit-page__actions">
              <button type="submit" className="btn-primary" disabled={isSaving || !isEditable}>
                {isSaving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate("/profile")}
                disabled={isSaving}
              >
                Cancel
              </button>
              {canWithdraw && (
                <button
                  type="button"
                  className="user-edit-page__withdraw"
                  onClick={() => setShowWithdrawConfirm(true)}
                  disabled={isSaving}
                >
                  Withdraw submission
                </button>
              )}
            </div>
          </form>
        )}

        {showWithdrawConfirm && canWithdraw && editingEvent && (
          <div
            className="user-withdraw-overlay"
            onClick={() => setShowWithdrawConfirm(false)}
            role="presentation"
          >
            <div
              className="user-withdraw-dialog"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="withdraw-title"
            >
              <h2 id="withdraw-title">Withdraw submission?</h2>
              <p>
                "{editingEvent.title}" will be permanently deleted. This action cannot be undone.
              </p>
              <div className="user-withdraw-dialog__actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowWithdrawConfirm(false)}
                >
                  Cancel
                </button>
                <button type="button" className="btn-danger" onClick={handleWithdraw}>
                  Withdraw submission
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
