import { useEffect, useRef, useState } from "react";
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
        type="button"
        className="admin-quality-badge__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
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
          className="admin-quality-badge__popover"
          role="dialog"
          aria-label={`Quality issues for ${eventTitle}`}
        >
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
