import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useEscapeKey } from "../features/calendar/hooks/useEscapeKey";

type AccountDeletionDialogProps = {
  error: string | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function AccountDeletionDialog({
  error,
  isPending,
  onCancel,
  onConfirm,
}: AccountDeletionDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const isConfirmed = confirmation === "DELETE";

  const cancel = () => {
    if (!isPending) onCancel();
  };

  useEscapeKey(cancel);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    confirmationRef.current?.focus();

    return () => {
      if (previousFocusRef.current instanceof HTMLElement && previousFocusRef.current.isConnected) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      "input:not(:disabled), button:not(:disabled)"
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="account-page__dialog-overlay" onMouseDown={cancel}>
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="account-page__dialog"
        onKeyDown={trapFocus}
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <h2 id={titleId}>Permanently delete account?</h2>
        <div className="account-page__dialog-copy" id={descriptionId}>
          <p>
            This permanently removes your sign-in and the personal account data that is safe to remove.
            Event, organizer, and moderation records are never removed by this action.
          </p>
          <p>This cannot be undone through SalsaSegura.</p>
          <p>An access token already issued may remain usable until it expires.</p>
        </div>
        <label className="account-page__delete-confirmation" htmlFor="account-delete-confirmation">
          <span>Type DELETE to confirm</span>
          <input
            autoCapitalize="characters"
            autoComplete="off"
            disabled={isPending}
            id="account-delete-confirmation"
            onChange={(event) => setConfirmation(event.target.value)}
            ref={confirmationRef}
            spellCheck={false}
            type="text"
            value={confirmation}
          />
        </label>
        {error && (
          <p className="account-page__session-error" role="alert">
            {error}
          </p>
        )}
        <div className="account-page__dialog-actions">
          <button
            aria-label="Cancel account deletion"
            className="account-page__btn account-page__btn--outline"
            disabled={isPending}
            onClick={cancel}
            type="button"
          >
            Cancel
          </button>
          <button
            aria-label={isPending ? "Deleting account…" : "Permanently delete account"}
            className="account-page__btn account-page__btn--danger"
            disabled={!isConfirmed || isPending}
            onClick={onConfirm}
            type="button"
          >
            {isPending ? "Deleting account…" : "Delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}
