import { useEffect, useRef, type FormEvent, type ReactNode } from "react";

type OfferingFormShellProps = {
  /** Names the form for assistive technology, e.g. "New class". */
  label: string;
  submitLabel: string;
  pending: boolean;
  /** The server's refusal, verbatim. */
  error: string | null;
  /** Bumped on every failed validation so focus can move to the first bad field. */
  invalidAttempt: number;
  onSubmit: () => void;
  onCancel: () => void;
  children: ReactNode;
};

/** The in-place form every offering row opens into: fields, save, cancel, one status line. */
export default function OfferingFormShell({
  label,
  submitLabel,
  pending,
  error,
  invalidAttempt,
  onSubmit,
  onCancel,
  children,
}: OfferingFormShellProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (invalidAttempt === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [invalidAttempt]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!pending) onSubmit();
  };

  return (
    <form
      ref={formRef}
      className="ws-form"
      aria-label={label}
      noValidate
      onSubmit={handleSubmit}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) onCancel();
      }}
    >
      <div className="ws-form__grid">{children}</div>
      {error && (
        <p className="ws-form__alert" role="alert">
          {error}
        </p>
      )}
      <div className="ws-form__actions">
        <button type="submit" className="desk__action desk__action--primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="desk__action" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
