import { useEffect, useRef } from "react";
import "./FormErrorSummary.css";

export interface FormErrorSummaryItem {
  /** id of the control (or group container) this error belongs to. */
  fieldId: string;
  message: string;
}

interface FormErrorSummaryProps {
  /** Stable id so callers can point at the summary. */
  id: string;
  /** Field errors, in form order. */
  items: FormErrorSummaryItem[];
  /** Failure with no identifiable field (server/network). */
  serverMessage?: string | null;
  /**
   * Changes whenever a submit attempt fails; the summary takes focus and
   * scrolls into view on each new value. Without it a second failed attempt
   * would leave the summary silently off-screen — the exact defect the P2-4
   * audit measured at ~1000px above the viewport.
   */
  focusKey: number;
  heading?: string;
}

/**
 * Error summary for the one long public form that needs it (/submit).
 * Short forms focus their first invalid control instead.
 */
export default function FormErrorSummary({
  id,
  items,
  serverMessage,
  focusKey,
  heading = "Please fix the following:",
}: FormErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hasContent = items.length > 0 || Boolean(serverMessage);

  useEffect(() => {
    if (focusKey === 0 || !ref.current) return;
    ref.current.focus();
    // Optional call: jsdom and some embedded webviews do not implement it.
    ref.current.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [focusKey]);

  if (!hasContent) return null;

  return (
    <div className="form-error-summary" id={id} ref={ref} role="alert" tabIndex={-1}>
      <p className="form-error-summary__heading">{serverMessage ? "We couldn't submit this" : heading}</p>
      {serverMessage && <p className="form-error-summary__server">{serverMessage}</p>}
      {items.length > 0 && (
        <ul className="form-error-summary__list">
          {items.map((item) => (
            <li key={item.fieldId}>
              <a
                href={`#${item.fieldId}`}
                onClick={(event) => {
                  // Focus the control itself: a bare fragment jump scrolls but
                  // leaves keyboard focus in the summary.
                  const target = document.getElementById(item.fieldId);
                  if (!target) return;
                  event.preventDefault();
                  target.scrollIntoView?.({ block: "center", behavior: "smooth" });
                  target.focus();
                }}
              >
                {item.message}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
