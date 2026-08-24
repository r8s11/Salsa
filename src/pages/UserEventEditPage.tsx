import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import type { DatabaseEvent } from "../features/events/model/types";
import { deleteEventForUser, updateEventForUser } from "../features/events/api/eventsRepo";
import { removeEventFlyer, uploadEventFlyer } from "../features/events/api/eventFlyers";
import EventForm, {
  CAPABILITIES,
  draftToUserPayload,
} from "../features/events/components/EventForm";
import type { EventFormDraft } from "../features/events/components/EventForm";
import EventFlyerField from "../features/events/components/EventFlyerField";
import { fromEventDateInstant } from "../features/events/model/eventDateTime";
import { validateSubmitForm } from "../features/submit-event/validation";
import { useMySubmissions } from "../hooks/useMySubmissions";
import "../styles/forms.css";
import "./UserEventEditPage.css";

function buildUserDraft(event: DatabaseEvent): EventFormDraft {
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
    price_amount: event.price_amount == null ? "" : String(event.price_amount),
    rsvp_link: event.rsvp_link ?? "",
    image_url: event.image_url ?? "",
    host: event.host ?? "",
    contact_email: event.contact_email ?? "",
    contact_instagram: event.contact_instagram ?? "",
    contact_website: event.contact_website ?? "",
    submitter_name: event.submitter_name ?? "",
    submitter_email: event.submitter_email ?? "",
    dance_styles: event.taxonomy_terms
      .filter((term) => term.category === "dance_style")
      .map((term) => term.slug),
    taxonomy_term_ids: event.taxonomy_term_ids ?? [],
  };
}

export default function UserEventEditPage() {
  const { user } = useAuth();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { submissions, isLoading, error: loadError } = useMySubmissions(user?.id);
  const editingEvent = submissions?.find((candidate) => candidate.id === eventId) ?? null;
  const [drafts, setDrafts] = useState<Record<string, EventFormDraft>>({});
  const form = editingEvent ? (drafts[editingEvent.id] ?? buildUserDraft(editingEvent)) : null;
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [selectedFlyer, setSelectedFlyer] = useState<File | null>(null);
  const [savedFlyerUrl, setSavedFlyerUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (eventId && submissions && !editingEvent) navigate("/profile");
  }, [editingEvent, eventId, navigate, submissions]);

  useEffect(() => {
    if (editingEvent && editingEvent.status !== "pending" && editingEvent.status !== "rejected")
      navigate("/profile");
  }, [editingEvent, navigate]);

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReturnType<typeof draftToUserPayload> }) =>
      updateEventForUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions", "mine", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["approved-events", "mine", user?.id] });
    },
  });
  const withdrawMutation = useMutation({
    mutationFn: deleteEventForUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions", "mine", user?.id] });
      navigate("/profile");
    },
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);
    if (!form || !editingEvent || !user) return;
    const validationError = validateSubmitForm({
      title: form.title,
      description: form.description,
      event_type: form.event_type,
      city: form.city,
      event_date: form.event_date,
      event_time: form.event_time,
      location: form.location,
      address: form.address,
      price_type: form.price_type,
      price_amount: form.price_amount,
      rsvp_link: form.rsvp_link,
      submitter_name: form.submitter_name,
      submitter_email: form.submitter_email,
      recurrence: form.recurrence,
      dance_styles: form.dance_styles,
    });
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    const previousFlyerUrl = savedFlyerUrl ?? editingEvent.image_url;
    let uploadedFlyerUrl: string | null = null;
    setIsSaving(true);
    try {
      const payload = draftToUserPayload(form);
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
    } catch (error) {
      if (uploadedFlyerUrl) {
        try {
          await removeEventFlyer(uploadedFlyerUrl);
        } catch {
          /* Preserve the primary save or upload error. */
        }
      }
      setSaveError(error instanceof Error ? error.message : "Unknown error");
      return;
    } finally {
      setIsSaving(false);
    }

    if (uploadedFlyerUrl) {
      setSavedFlyerUrl(uploadedFlyerUrl);
      setSelectedFlyer(null);
    }
    setSaveSuccess("Changes saved.");
    if (uploadedFlyerUrl && previousFlyerUrl) {
      try {
        await removeEventFlyer(previousFlyerUrl);
      } catch {
        /* Stale-object cleanup is best effort. */
      }
    }
  };

  const handleWithdraw = async () => {
    if (!editingEvent) return;
    if (
      window.confirm(
        `Withdraw "${editingEvent.title}"? This will permanently delete the submission and cannot be undone.`
      )
    )
      await withdrawMutation.mutateAsync(editingEvent.id);
  };

  if (!user) {
    navigate("/signin");
    return null;
  }
  if (isLoading || !submissions)
    return (
      <main className="user-edit-page">
        <div className="container user-edit-page__content">
          <p>Loading event…</p>
        </div>
      </main>
    );
  if (loadError || !eventId || !editingEvent || !form)
    return (
      <main className="user-edit-page">
        <div className="container user-edit-page__content">
          <div className="error-banner" role="alert">
            <p>❌ {loadError ?? "Event not found."}</p>
          </div>
        </div>
      </main>
    );

  const isEditable = editingEvent.status === "pending" || editingEvent.status === "rejected";
  const canWithdraw = editingEvent.status === "pending";
  const flyerUrl = savedFlyerUrl ?? editingEvent.image_url;
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
            <EventForm
              draft={form}
              onChange={(next) => setDrafts((current) => ({ ...current, [editingEvent.id]: next }))}
              capabilities={CAPABILITIES.organizerEdit}
              renderFlyerField={() => (
                <EventFlyerField
                  key={flyerUrl}
                  currentUrl={flyerUrl}
                  onFileChange={setSelectedFlyer}
                  disabled={isSaving}
                />
              )}
            />
            <div className="user-edit-page__actions">
              <button type="submit" className="btn-primary" disabled={isSaving}>
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
        {showWithdrawConfirm && canWithdraw && (
          <div
            className="user-withdraw-overlay"
            onClick={() => setShowWithdrawConfirm(false)}
            role="presentation"
          >
            <div
              className="user-withdraw-dialog"
              onClick={(event) => event.stopPropagation()}
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
