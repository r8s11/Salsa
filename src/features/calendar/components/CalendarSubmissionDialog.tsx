import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, Loader2, Lock, X, XCircle } from "lucide-react";
import Button from "../../../components/ui/Button";
import { useAuth } from "../../../contexts/useAuth";
import { useOwnProfile } from "../../account/hooks/useOwnProfile";
import { resolveIdentity } from "../../account/model/account";
import EventForm, { CAPABILITIES } from "../../events/components/EventForm";
import EventFlyerField from "../../events/components/EventFlyerField";
import { useSubmissionAccess } from "../../submit-event/hooks/useSubmissionAccess";
import { useSubmitEventForm } from "../../submit-event/hooks/useSubmitEventForm";
import type { SubmitFieldName } from "../../submit-event/model/validation";
import FormErrorSummary from "../../../shared/forms/FormErrorSummary";
import "./CalendarSubmissionDialog.css";

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

export interface CalendarSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CalendarSubmissionContentProps {
  onClose: () => void;
  onSubmittingChange: (submitting: boolean) => void;
}

function CalendarSubmissionContent({
  onClose,
  onSubmittingChange,
}: CalendarSubmissionContentProps) {
  const { user, isOrganizer } = useAuth();
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
    handleFlyerChange,
    handleFlyerRetry,
    handleFlyerRemove,
  } = useSubmitEventForm(authenticatedSubmitterName);

  const submissionAccess = useSubmissionAccess(Boolean(user));

  useEffect(() => {
    onSubmittingChange(isSubmitting);
  }, [isSubmitting, onSubmittingChange]);

  const errorItems = FIELD_ORDER.filter(({ field }) => fieldErrors[field]).map(({ field, id }) => ({
    fieldId: id,
    message: fieldErrors[field] as string,
  }));

  return (
    <>
      <div className="calendar-sub-dialog__header">
        <div className="calendar-sub-dialog__titles">
          <Dialog.Title className="calendar-sub-dialog__title">
            {isOrganizer ? "Create a New Event" : "Submit an Event"}
          </Dialog.Title>
          <Dialog.Description id="calendar-sub-dialog-desc" className="calendar-sub-dialog__desc">
            Share a dance event. No account needed. A moderator reviews each submission before it
            appears on the calendar.
          </Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <button
            type="button"
            className="calendar-sub-dialog__close"
            aria-label="Close dialog"
            disabled={isSubmitting}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </Dialog.Close>
      </div>

      {submissionAccess.isLoading ? (
        <div className="calendar-sub-dialog__status-card" role="status">
          <Loader2 className="calendar-sub-dialog__spinner" size={28} aria-hidden="true" />
          <p>Checking whether submissions are open…</p>
        </div>
      ) : submissionAccess.error ? (
        <div
          className="calendar-sub-dialog__status-card calendar-sub-dialog__status-card--error"
          role="alert"
        >
          <div className="calendar-sub-dialog__status-icon">
            <XCircle size={32} aria-hidden="true" />
          </div>
          <div className="calendar-sub-dialog__status-text">
            <h3>Submissions Unavailable</h3>
            <p>Event submissions are currently unavailable. Please try again later.</p>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : !submissionAccess.canSubmit ? (
        <div
          className="calendar-sub-dialog__status-card calendar-sub-dialog__status-card--closed"
          role="status"
        >
          <div className="calendar-sub-dialog__status-icon">
            <Lock size={32} aria-hidden="true" />
          </div>
          <div className="calendar-sub-dialog__status-text">
            <h3>Submissions Closed</h3>
            <p>Public event submissions are currently closed.</p>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : isSubmitted ? (
        <div className="calendar-sub-dialog__success-card" role="status">
          <div className="calendar-sub-dialog__success-icon">
            <CheckCircle2 size={36} aria-hidden="true" />
          </div>
          <h3 className="calendar-sub-dialog__success-title">Event Submitted for Review</h3>
          <p className="calendar-sub-dialog__success-body">
            Your event is awaiting moderator review. It will appear on the calendar only after
            approval.
          </p>
          <div className="calendar-sub-dialog__success-actions">
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
            <Button variant="secondary" onClick={resetSubmitted}>
              Submit Another Event
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="calendar-sub-dialog__form" noValidate>
          <div className="calendar-sub-dialog__scroll">
            <FormErrorSummary
              id="calendar-sub-dialog-error-summary"
              items={errorItems}
              serverMessage={serverError}
              focusKey={failedAttempt}
            />

            <div className="calendar-sub-dialog__flyer-box">
              <p className="calendar-sub-dialog__flyer-hint">
                No flyer? We’ll create a shareable poster from your event details once it’s
                approved.
              </p>
              <details>
                <summary className="calendar-sub-dialog__flyer-title">
                  Add a flyer <span className="calendar-sub-dialog__badge">Optional</span>
                </summary>
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
              </details>
            </div>

            <p className="calendar-sub-dialog__required-legend">* Required fields</p>

            <EventForm
              draft={form}
              onChange={onChange}
              capabilities={CAPABILITIES.submit}
              requireSubmitterContact={!user}
              authenticatedSubmitterName={authenticatedSubmitterName}
              errors={fieldErrors}
            />
          </div>

          <footer className="calendar-sub-dialog__footer">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              loadingLabel="Submitting…"
            >
              {isOrganizer ? "Submit for Review" : "Submit Event"}
            </Button>
          </footer>
        </form>
      )}
    </>
  );
}

export default function CalendarSubmissionDialog({
  open,
  onOpenChange,
}: CalendarSubmissionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="calendar-sub-dialog__overlay" />
        <Dialog.Content
          className="calendar-sub-dialog__content"
          aria-describedby="calendar-sub-dialog-desc"
          onOpenAutoFocus={() => {
            if (document.activeElement instanceof HTMLElement) {
              returnFocus.current = document.activeElement;
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
          onEscapeKeyDown={(e) => {
            if (isSubmitting) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (isSubmitting) e.preventDefault();
          }}
        >
          {open && (
            <CalendarSubmissionContent
              onClose={() => handleOpenChange(false)}
              onSubmittingChange={setIsSubmitting}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
