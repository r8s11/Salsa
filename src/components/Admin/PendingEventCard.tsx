import "temporal-polyfill/global";
import type { DatabaseEvent } from "../../features/events/model/types";
import "./PendingEventCard.css";

interface Props {
  event: DatabaseEvent;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isDeciding: boolean;
  error: string | null;
}

// event_date is timestamp with time zone — parse as an Instant and render
// in America/New_York, same rule convert.ts uses, so pending events never
// display at the visitor's browser timezone offset.
function formatEventDateTime(isoDate: string): string {
  const zdt = Temporal.Instant.from(isoDate).toZonedDateTimeISO("America/New_York");
  const dateLabel = zdt.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeLabel = zdt.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateLabel} at ${timeLabel}`;
}

export default function PendingEventCard({
  event,
  onApprove,
  onReject,
  isDeciding,
  error,
}: Props) {
  const isFree = event.price_type === "free" || event.price_amount == null;
  const priceLabel = isFree ? "Free" : `$${event.price_amount}`;
  const cityLabel = event.city === "boston" ? "Boston" : "New York City";

  return (
    <div className="pending-event-card">
      <h3>{event.title}</h3>
      <p className="pending-event-meta">
        {formatEventDateTime(event.event_date)} · {cityLabel} · {priceLabel}
      </p>
      {event.description && <p className="pending-event-description">{event.description}</p>}
      <p className="pending-event-submitter">
        Submitted by {event.submitter_name ?? "Anonymous"}
        {event.submitter_email ? ` (${event.submitter_email})` : ""}
      </p>
      {error && <p className="pending-event-error">{error}</p>}
      <div className="pending-event-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={isDeciding}
          onClick={() => onApprove(event.id)}
        >
          {isDeciding ? "Working…" : "Approve"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={isDeciding}
          onClick={() => onReject(event.id)}
        >
          {isDeciding ? "Working…" : "Reject"}
        </button>
      </div>
    </div>
  );
}
