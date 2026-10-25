import { useId, type ReactNode } from "react";

export type FieldControlProps = {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

type WorkspaceFieldProps = {
  label: string;
  error?: string;
  hint?: string;
  /** Spans both columns of the form grid. */
  wide?: boolean;
  children: (control: FieldControlProps) => ReactNode;
};

/** A labelled control that states its own problem in words, tied to the control. */
export default function WorkspaceField({ label, error, hint, wide, children }: WorkspaceFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const describedBy = error || hint ? messageId : undefined;

  return (
    <div className={`admin-field ws-field${wide ? " ws-field--wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {error ? (
        <p id={messageId} className="ws-field__error">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="ws-field__hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
