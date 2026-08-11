import { useEffect, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import { QUALITY_ISSUE_LABEL, type QualityIssue } from "../../features/admin/model/overviewMetrics";

interface AdminQualityBadgeProps {
  issues: QualityIssue[];
  eventTitle: string;
  cancellationReason?: string | null;
}

export default function AdminQualityBadge({
  issues,
  eventTitle,
  cancellationReason,
}: AdminQualityBadgeProps) {
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
        aria-label={`${issues.length} quality issue${issues.length === 1 ? "" : "s"}`}
        onClick={() => setOpen((value) => !value)}
      >
        <TriangleAlert size={12} />
        {QUALITY_ISSUE_LABEL[first]}
        {rest.length > 0 && ` +${rest.length}`}
      </button>

      {open && (
        <div
          className="admin-quality-badge__popover"
          role="dialog"
          aria-label={`Quality issues for ${eventTitle}`}
        >
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{QUALITY_ISSUE_LABEL[issue]}</li>
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
