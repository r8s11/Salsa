import "./FormFieldError.css";

interface FormFieldErrorProps {
  /** Stable id the field points at through `aria-describedby`. */
  id: string;
  /** Error copy, or null/undefined when the field is valid. */
  message?: string | null;
}

/**
 * Announced, programmatically associated field error for public forms —
 * the pattern FounderRequestForm established, extracted so /submit, /contact
 * and the auth forms stop inventing their own.
 *
 * Pair it with `fieldErrorProps` so the control and the message stay in sync.
 */
export default function FormFieldError({ id, message }: FormFieldErrorProps) {
  if (!message) return null;
  return (
    <span className="field-error" id={id} role="alert">
      {message}
    </span>
  );
}
