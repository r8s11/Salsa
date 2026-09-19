import { useEffect, useId, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import "./AdminQualityBadge.css";

interface AdminQualityBadgeProps<T extends string> {
  issues: T[];
  labelFor: (issue: T) => string;
  eventTitle: string;
  cancellationReason?: string | null;
  triggerLabel?: string;
}

export default function AdminQualityBadge<T extends string>({
  issues,
  labelFor,
  eventTitle,
  cancellationReason,
  triggerLabel,
}: AdminQualityBadgeProps<T>) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useEscapeKey(() => {
    if (open) setOpen(false);
  });

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  if (issues.length === 0) return null;

  const [first, ...rest] = issues;

  return (
    <div className="admin-quality-badge" ref={wrapperRef}>
      <button
        aria-haspopup="true"
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        aria-controls={open ? popoverId : undefined}
        aria-label={`${issues.length} quality issue${issues.length === 1 ? "" : "s"}: ${issues
          .map(labelFor)
          .join(", ")}`}
        onClick={() => setOpen((value) => !value)}
      >
        <TriangleAlert size={12} />
        {triggerLabel ?? labelFor(first)}
        {!triggerLabel && rest.length > 0 && ` +${rest.length}`}
      </button>

      {open && (
        <div
          id={popoverId}
          className="admin-quality-badge__popover"
          role="tooltip"
          aria-live="polite"
        >
          <span className="sr-only">Quality issues for {eventTitle}: </span>
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{labelFor(issue)}</li>
            ))}
          </ul>
          {cancellationReason && (
            <p className="admin-quality-badge__reason">{cancellationReason}</p>
          )}
        </div>
      )}
    </div>
  );
}
