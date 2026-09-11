import "temporal-polyfill/global";
import { useEffect, useId, useRef, useState } from "react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import type { DatabaseEvent } from "../../features/events/model/types";
import { fromEventDateInstant } from "../../features/events/model/eventDateTime";
import "./AdminDuplicateEventDialog.css";

interface AdminDuplicateEventDialogProps {
  event: DatabaseEvent;
  isBusy: boolean;
  error: string | null;
  onConfirm: (input: { date: string; time: string; publish: boolean }) => void;
  onCancel: () => void;
}

type QuickSet = "1week" | "2weeks" | "1month";

// Recomputes from the ORIGINAL event date every time — clicking twice must
// not compound.
function resolveQuickSet(originalDate: string, quickSet: QuickSet): string {
  const plainDate = Temporal.PlainDate.from(originalDate);
  const shifted =
    quickSet === "1week"
      ? plainDate.add({ weeks: 1 })
      : quickSet === "2weeks"
        ? plainDate.add({ weeks: 2 })
        : plainDate.add({ months: 1 });
  return shifted.toString();
}

export default function AdminDuplicateEventDialog({
  event,
  isBusy,
  error,
  onConfirm,
  onCancel,
}: AdminDuplicateEventDialogProps) {
  const titleId = useId();
  const dateRef = useRef<HTMLInputElement>(null);

  const original = fromEventDateInstant(event.event_date);
  // Weekly recurrence is the dominant case for this product.
  const [date, setDate] = useState(() => resolveQuickSet(original.date, "1week"));
  const [time, setTime] = useState(original.time);
  const [publish, setPublish] = useState(false);

  useEscapeKey(onCancel);

  useEffect(() => {
    dateRef.current?.focus();
  }, []);

  const applyQuickSet = (quickSet: QuickSet) => {
    setDate(resolveQuickSet(original.date, quickSet));
  };

  return (
    <div className="admin-duplicate-dialog__overlay" onClick={onCancel}>
      <div
        className="admin-duplicate-dialog admin-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
      >
        <h2 id={titleId}>Duplicate &quot;{event.title}&quot;</h2>

        <div className="admin-field">
          <label htmlFor="admin-duplicate-date">Date</label>
          <input
            id="admin-duplicate-date"
            ref={dateRef}
            type="date"
            className="admin-input"
            value={date}
            onChange={(changeEvent) => setDate(changeEvent.target.value)}
          />
        </div>

        <div className="admin-field">
          <label htmlFor="admin-duplicate-time">Start time</label>
          <input
            id="admin-duplicate-time"
            type="time"
            className="admin-input"
            value={time}
            onChange={(changeEvent) => setTime(changeEvent.target.value)}
          />
        </div>

        <div className="admin-duplicate-dialog__quick-set">
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => applyQuickSet("1week")}
          >
            +1 week
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => applyQuickSet("2weeks")}
          >
            +2 weeks
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => applyQuickSet("1month")}
          >
            +1 month
          </button>
        </div>

        <p className="admin-duplicate-dialog__copied">
          Copied unchanged: title, venue, address, organizer, description, pricing, dance styles,
          contact details, flyer.
        </p>

        <label className="admin-duplicate-dialog__publish">
          <input
            type="checkbox"
            checked={publish}
            onChange={(changeEvent) => setPublish(changeEvent.target.checked)}
          />
          Publish immediately
        </label>

        {error && (
          <p className="admin-banner admin-banner--error" role="alert">
            {error}
          </p>
        )}

        <div className="admin-duplicate-dialog__actions">
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() => onConfirm({ date, time, publish })}
            disabled={isBusy}
          >
            {isBusy ? "Duplicating…" : "Duplicate event"}
          </button>
        </div>
      </div>
    </div>
  );
}
