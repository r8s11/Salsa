import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import type { DatabaseEvent } from "../features/events/model/types";
import {
  deleteEventForUser,
  updateEventForUser,
  type UserEventUpdatePayload,
} from "../features/events/api/eventsRepo";
import {
  updateOwnEventSubmission,
  withdrawOwnEventSubmission,
} from "../features/admin/api/submissionsRepo";
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

// Status-specific heading/copy shown only to Organizers (Host workspace
// context). Non-Organizer community submitters keep the existing generic
// copy unchanged — this table intentionally has no "approved" entry because
// the existing redirect effect below navigates away before it would render.
const ORGANIZER_STATUS_COPY: Partial<
  Record<DatabaseEvent["status"], { heading: string; description: string }>
> = {
  pending: {
    heading: "Edit event submission",
    description: "Update the details of your event while it is being reviewed.",
  },
  rejected: {
    heading: "Revise event submission",
    description: "Review the feedback, update the event, and save your changes.",
  },
};

function statusLabel(status: DatabaseEvent["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function submissionEditedData(payload: UserEventUpdatePayload): Record<string, unknown> {
  const { image_url: _imageUrl, ...editedData } = payload;
  return editedData;
}

export default function UserEventEditPage() {
  const { user, isOrganizer } = useAuth();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { submissions, isLoading, error: loadError } = useMySubmissions(user?.id);
  const editingEvent = submissions?.find((candidate) => candidate.id === eventId) ?? null;
  // Organizers return to their Host workspace; everyone else keeps the
  // existing community Profile destination.
  const returnPath = isOrganizer ? "/host/events" : "/profile";
  const [drafts, setDrafts] = useState<Record<string, EventFormDraft>>({});
  const form = editingEvent ? (drafts[editingEvent.id] ?? buildUserDraft(editingEvent)) : null;
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [selectedFlyer, setSelectedFlyer] = useState<File | null>(null);
  const [savedFlyerUrl, setSavedFlyerUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Snapshot of the loaded (unedited) draft, captured once per event id via
  // the "adjust state during render" pattern (not an effect) — React's
  // documented way to derive state from a prop change without a spurious
  // extra render pass: https://react.dev/learn/you-might-not-need-an-effect
  const [pristineSnapshotId, setPristineSnapshotId] = useState<string | null>(null);
  const [pristineSnapshot, setPristineSnapshot] = useState<string | null>(null);
  if (editingEvent && editingEvent.id !== pristineSnapshotId) {
    setPristineSnapshotId(editingEvent.id);
    setPristineSnapshot(JSON.stringify(buildUserDraft(editingEvent)));
  }
  const isDirty =
    pristineSnapshot !== null &&
    (JSON.stringify(form) !== pristineSnapshot || selectedFlyer !== null);

  useEffect(() => {
    if (!isLoading && eventId && submissions && !editingEvent) navigate(returnPath);
  }, [editingEvent, eventId, isLoading, navigate, submissions, returnPath]);

  useEffect(() => {
    if (editingEvent && editingEvent.status !== "pending" && editingEvent.status !== "rejected")
      navigate(returnPath);
  }, [editingEvent, navigate, returnPath]);

  // Only warns once the event has loaded and the Host/submitter has
  // unsaved input — never before data loads, never on a clean form.
  useEffect(() => {
    if (!isEditableStatus(editingEvent) || !isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editingEvent, isDirty]);

  const saveMutation = useMutation({
    mutationFn: async ({ event, payload }: { event: DatabaseEvent; payload: UserEventUpdatePayload }) => {
      if (event.submission_id) {
        await updateOwnEventSubmission(event.submission_id, submissionEditedData(payload));
        return;
      }
      await updateEventForUser(event.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions", "mine", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["event-submissions", "mine", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["approved-events", "mine", user?.id] });
    },
  });
  const withdrawMutation = useMutation({
    mutationFn: async (event: DatabaseEvent) => {
      if (event.submission_id) {
        await withdrawOwnEventSubmission(event.submission_id);
        return;
      }
      await deleteEventForUser(event.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["submissions", "mine", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["event-submissions", "mine", user?.id] });
      navigate(returnPath);
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

    const supportsFlyer = !editingEvent.submission_id;
    const previousFlyerUrl = savedFlyerUrl ?? editingEvent.image_url;
    let uploadedFlyerUrl: string | null = null;
    setIsSaving(true);
    try {
      const payload = draftToUserPayload(form);
      if (selectedFlyer && supportsFlyer) {
        const uploadedFlyer = await uploadEventFlyer({
          file: selectedFlyer,
          ownerId: user.id,
          eventId: editingEvent.id,
        });
        uploadedFlyerUrl = uploadedFlyer.url;
        payload.image_url = uploadedFlyer.url;
      }
      await saveMutation.mutateAsync({ event: editingEvent, payload });
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
    // A successful save is the new "unsaved changes" baseline — clears the
    // beforeunload warning until the Host edits again.
    setPristineSnapshot(JSON.stringify(form));
    if (uploadedFlyerUrl && previousFlyerUrl) {
      try {
        await removeEventFlyer(previousFlyerUrl);
      } catch {
        /* Stale-object cleanup is best effort. */
      }
    }
  };

  const handleWithdraw = async () => {
    if (!editingEvent || withdrawMutation.isPending) return;
    if (
      window.confirm(
        `Withdraw "${editingEvent.title}"? This will permanently delete the submission and cannot be undone.`
      )
    ) {
      setWithdrawError(null);
      try {
        await withdrawMutation.mutateAsync(editingEvent);
      } catch (error) {
        setWithdrawError(error instanceof Error ? error.message : "Unknown error");
      }
    }
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
  const organizerCopy = ORGANIZER_STATUS_COPY[editingEvent.status];
  return (
    <main className="user-edit-page">
      <div className="container user-edit-page__content">
        <header className="user-edit-page__header">
          {isOrganizer ? (
            <>
              <span className="user-edit-page__eyebrow">Host · Edit Event</span>
              <div className="user-edit-page__title-row">
                <h1>{organizerCopy?.heading ?? "Event submission"}</h1>
                <span className="user-edit-page__status-badge">
                  {statusLabel(editingEvent.status)}
                </span>
              </div>
              <p>
                {organizerCopy?.description ??
                  "This submission's current review status is shown below."}
              </p>
            </>
          ) : (
            <>
              <span className="user-edit-page__eyebrow">◆ Community</span>
              <h1>Edit event</h1>
              <p>
                Update your event details. Changes stay in review until they are ready for the
                public calendar.
              </p>
            </>
          )}
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
        {withdrawError && (
          <div className="error-banner" role="alert">
            <p>❌ {withdrawError}</p>
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
              capabilities={
                editingEvent.submission_id
                  ? CAPABILITIES.organizerSubmissionEdit
                  : CAPABILITIES.organizerEdit
              }
              renderFlyerField={() =>
                !editingEvent.submission_id ? (
                  <EventFlyerField
                    key={flyerUrl}
                    currentUrl={flyerUrl}
                    onFileChange={setSelectedFlyer}
                    disabled={isSaving}
                  />
                ) : null
              }
            />
            <div className="user-edit-page__actions">
              <button type="submit" className="btn-primary" disabled={isSaving}>
                {isSaving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate(returnPath)}
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
              <p>This removes "{editingEvent.title}" from review and cannot be undone.</p>
              <div className="user-withdraw-dialog__actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowWithdrawConfirm(false)}
                  disabled={withdrawMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleWithdraw}
                  disabled={withdrawMutation.isPending}
                >
                  {withdrawMutation.isPending ? "Withdrawing…" : "Withdraw submission"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function isEditableStatus(event: DatabaseEvent | null): boolean {
  return event?.status === "pending" || event?.status === "rejected";
}
