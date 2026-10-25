/**
 * ARIA wiring for a control paired with a `FormFieldError`. `hintId` is
 * preserved alongside the error id so an existing hint is never dropped when
 * validation fails.
 *
 * Lives beside the component rather than inside it so the component module
 * only exports a component (react-refresh boundary).
 */
export function fieldErrorProps(
  errorId: string,
  message: string | null | undefined,
  hintId?: string
): { "aria-invalid": "true" | "false"; "aria-describedby": string | undefined } {
  const describedBy = [message ? errorId : null, hintId].filter(Boolean).join(" ");
  return {
    "aria-invalid": message ? "true" : "false",
    "aria-describedby": describedBy || undefined,
  };
}
