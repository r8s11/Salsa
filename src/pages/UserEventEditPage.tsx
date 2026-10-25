import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { XCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/useAuth";
import { useAccessibleDialog } from "../shared/a11y/useAccessibleDialog";
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
import { removeEventFlyer, uploadEventFlyers } from "../features/events/api/eventFlyers";
import EventForm, {
  CAPABILITIES,
  draftToUserPayload,
} from "../features/events/components/EventForm";
import type { EventFormDraft } from "../features/events/components/EventForm";
import EventFlyersField from "../features/events/components/EventFlyersField";
import {
  MAX_FLYERS_PER_EVENT,
  eventFlyerList,
  flyerPayload,
} from "../features/events/model/eventFlyers";
import { fromEventDateInstant } from "../features/events/model/eventDateTime";
import { eventTypeFieldsFrom } from "../features/events/model/eventTypeSelection";
import { validateSubmitForm } from "../features/submit-event/model/validation";
import { normalizeSubLocation } from "../features/metros/model/sublocation";
import { useMySubmissions } from "../features/account/hooks/useMySubmissions";
import "../styles/forms.css";
import "./UserEventEditPage.css";
import Button from "../components/ui/Button";

function buildUserDraft(event: DatabaseEvent): EventFormDraft {
  const { date, time } = fromEventDateInstant(event.event_date);
  return {
    title: event.title,
    description: event.description ?? "",
    ...eventTypeFieldsFrom(event),
    city: event.city,
    sublocation: normalizeSubLocation(event.city, event.sublocation) ?? "",
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
    image_urls: eventFlyerList(event),
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
  // A moderation submission has no canonical event id, so its flyers are not
  // editable here; the submitted flyers carry through approval untouched.
  const { image_url: _imageUrl, image_urls: _imageUrls, ...editedData } = payload;
  return editedData;
}

/**
 * One row of the edit page's flyer list: either an already-persisted flyer
 * (`url`) or a freshly chosen file that uploads on save (`file`).
 */
type EditFlyer = {
  id: string;
  url: string | null;
  file: File | null;
  previewUrl: string;
};

const persistedEditFlyers = (urls: readonly string[]): EditFlyer[] =>
  urls.map((url) => ({ id: url, url, file: null, previewUrl: url }));

const createPreviewUrl = (file: File) =>
  typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "";

const revokePreviewUrl = (flyer: EditFlyer) => {
  if (flyer.file && flyer.previewUrl) URL.revokeObjectURL(flyer.previewUrl);
};

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
  // Edited flyer lists per event id; absent until the person touches the flyers.
  const [flyerDrafts, setFlyerDrafts] = useState<Record<string, EditFlyer[]>>({});
  // Flyer URLs as last saved from this page, so later saves diff against them.
  const [savedFlyerUrls, setSavedFlyerUrls] = useState<Record<string, string[]>>({});
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
  const baselineFlyerUrls = editingEvent
    ? (savedFlyerUrls[editingEvent.id] ?? eventFlyerList(editingEvent))
    : [];
  const flyers = editingEvent
    ? (flyerDrafts[editingEvent.id] ?? persistedEditFlyers(baselineFlyerUrls))
    : [];
  const flyersDirty =
    flyers.length !== baselineFlyerUrls.length ||
    flyers.some((flyer, index) => flyer.url !== baselineFlyerUrls[index]);
  const isDirty =
    pristineSnapshot !== null && (JSON.stringify(form) !== pristineSnapshot || flyersDirty);

  // Object-URL previews of unsaved files; released when the page goes away.
  const flyerDraftsRef = useRef(flyerDrafts);
  useEffect(() => {
    flyerDraftsRef.current = flyerDrafts;
  }, [flyerDrafts]);
  useEffect(
    () => () => Object.values(flyerDraftsRef.current).flat().forEach(revokePreviewUrl),
    []
  );
  const setFlyers = (next: EditFlyer[]) => {
    if (!editingEvent) return;
    setFlyerDrafts((current) => ({ ...current, [editingEvent.id]: next }));
  };
  const handleFlyersAdd = (files: File[]) => {
    const added = files.slice(0, Math.max(0, MAX_FLYERS_PER_EVENT - flyers.length)).map((file) => ({
      id: crypto.randomUUID(),
      url: null,
      file,
      previewUrl: createPreviewUrl(file),
    }));
    if (added.length > 0) setFlyers([...flyers, ...added]);
  };
  const handleFlyerRemove = (id: string) => {
    // Stages a draft change only: persisted objects are deleted after a
    // successful save, so an accidental Remove is undone by not saving.
    flyers.filter((flyer) => flyer.id === id).forEach(revokePreviewUrl);
    setFlyers(flyers.filter((flyer) => flyer.id !== id));
  };
  const handleFlyerMove = (id: string, direction: "earlier" | "later") => {
    const next = [...flyers];
    const from = next.findIndex((flyer) => flyer.id === id);
    const to = direction === "earlier" ? from - 1 : from + 1;
    if (from < 0 || to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]];
    setFlyers(next);
  };

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
    mutationFn: async ({
      event,
      payload,
    }: {
      event: DatabaseEvent;
      payload: UserEventUpdatePayload;
    }) => {
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
      event_types: form.event_types,
      city: form.city,
      sublocation: form.sublocation,
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
    const submittedFlyers = flyers;
    let uploadedFlyerUrls: string[] = [];
    let finalFlyerUrls = baselineFlyerUrls;
    setIsSaving(true);
    try {
      const payload = draftToUserPayload(form);
      if (supportsFlyer) {
        const newFiles = submittedFlyers.flatMap((flyer) => (flyer.file ? [flyer.file] : []));
        const uploaded = newFiles.length
          ? await uploadEventFlyers({
              files: newFiles,
              ownerId: user.id,
              eventId: editingEvent.id,
            })
          : [];
        uploadedFlyerUrls = uploaded.map((flyer) => flyer.url);
        let nextUploaded = 0;
        finalFlyerUrls = submittedFlyers.map((flyer) =>
          flyer.file ? uploaded[nextUploaded++].url : (flyer.url as string)
        );
        Object.assign(payload, flyerPayload(finalFlyerUrls));
      }
      await saveMutation.mutateAsync({ event: editingEvent, payload });
    } catch (error) {
      await Promise.allSettled(uploadedFlyerUrls.map((url) => removeEventFlyer(url)));
      setSaveError(error instanceof Error ? error.message : "Unknown error");
      return;
    } finally {
      setIsSaving(false);
    }

    const removedFlyerUrls = baselineFlyerUrls.filter((url) => !finalFlyerUrls.includes(url));
    if (supportsFlyer) {
      submittedFlyers.forEach(revokePreviewUrl);
      setSavedFlyerUrls((current) => ({ ...current, [editingEvent.id]: finalFlyerUrls }));
      setFlyerDrafts((current) => ({
        ...current,
        [editingEvent.id]: persistedEditFlyers(finalFlyerUrls),
      }));
    }
    posthog.capture("event_submission_updated", {
      event_status: editingEvent.status,
      is_organizer: isOrganizer,
      flyer_updated: supportsFlyer && flyersDirty,
      flyer_count: supportsFlyer ? finalFlyerUrls.length : undefined,
    });
    setSaveSuccess("Changes saved.");
    // A successful save is the new "unsaved changes" baseline — clears the
    // beforeunload warning until the Host edits again.
    setPristineSnapshot(JSON.stringify(form));
    // Stale objects go only after the update committed; cleanup is best effort.
    await Promise.allSettled(removedFlyerUrls.map((url) => removeEventFlyer(url)));
  };

  const handleWithdraw = async () => {
    if (!editingEvent || withdrawMutation.isPending) return;
    setWithdrawError(null);
    try {
      await withdrawMutation.mutateAsync(editingEvent);
      posthog.capture("event_submission_withdrawn", { is_organizer: isOrganizer });
    } catch (error) {
      setWithdrawError(error instanceof Error ? error.message : "Unknown error");
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
            <p>
              <XCircle size={16} aria-hidden="true" style={{ verticalAlign: "-0.15em" }} />{" "}
              {loadError ?? "Event not found."}
            </p>
          </div>
        </div>
      </main>
    );

  const isEditable = editingEvent.status === "pending" || editingEvent.status === "rejected";
  const canWithdraw = editingEvent.status === "pending";
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
              <XCircle size={16} aria-hidden="true" style={{ verticalAlign: "-0.15em" }} /> This
              event has been approved and can no longer be edited. Contact an admin if you need
              changes.
            </p>
          </div>
        )}
        {saveError && (
          <div className="error-banner" role="alert">
            <p>
              <XCircle size={16} aria-hidden="true" style={{ verticalAlign: "-0.15em" }} />{" "}
              {saveError}
            </p>
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
                  <EventFlyersField
                    items={flyers.map((flyer) => ({
                      id: flyer.id,
                      url: flyer.previewUrl,
                      status: flyer.file ? undefined : "uploaded",
                      sizeCaption: flyer.file
                        ? `${(flyer.file.size / (1024 * 1024)).toFixed(1)} MB`
                        : null,
                    }))}
                    onAddFiles={handleFlyersAdd}
                    onRemove={handleFlyerRemove}
                    onMove={handleFlyerMove}
                    disabled={isSaving}
                  />
                ) : null
              }
            />
            <div className="user-edit-page__actions">
              <Button type="submit" loading={isSaving} loadingLabel="Saving…">
                Save changes
              </Button>
              <Button variant="secondary" onClick={() => navigate(returnPath)} disabled={isSaving}>
                Cancel
              </Button>
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
          <WithdrawConfirmDialog
            title={editingEvent.title}
            isBusy={withdrawMutation.isPending}
            error={withdrawError}
            onConfirm={handleWithdraw}
            onCancel={() => setShowWithdrawConfirm(false)}
          />
        )}
      </div>
    </main>
  );
}

function isEditableStatus(event: DatabaseEvent | null): boolean {
  return event?.status === "pending" || event?.status === "rejected";
}

interface WithdrawConfirmDialogProps {
  title: string;
  isBusy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function WithdrawConfirmDialog({
  title,
  isBusy,
  error,
  onConfirm,
  onCancel,
}: WithdrawConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { onKeyDown, onBackdropClick, onDialogClick } = useAccessibleDialog({
    dialogRef,
    onDismiss: onCancel,
    isBusy,
    initialFocusRef: cancelRef,
  });

  return (
    <div className="user-withdraw-overlay" onClick={onBackdropClick} role="presentation">
      <div
        className="user-withdraw-dialog"
        ref={dialogRef}
        onClick={onDialogClick}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-title"
        aria-describedby="withdraw-body"
      >
        <h2 id="withdraw-title">Withdraw &ldquo;{title}&rdquo;?</h2>
        <p id="withdraw-body">This permanently deletes the submission and cannot be undone.</p>
        {error && (
          <p className="user-withdraw-dialog__error" role="alert">
            <XCircle size={16} aria-hidden="true" style={{ verticalAlign: "-0.15em" }} /> {error}
          </p>
        )}
        <div className="user-withdraw-dialog__actions">
          <Button variant="secondary" ref={cancelRef} onClick={onCancel} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={isBusy}
            loading={isBusy}
            loadingLabel="Withdrawing…"
          >
            Withdraw submission
          </Button>
        </div>
      </div>
    </div>
  );
}
