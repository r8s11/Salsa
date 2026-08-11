import { useState } from "react";
import "temporal-polyfill/global";
import type { DatabaseEvent } from "../../features/events/model/types";
import "./PendingEventCard.css";

interface Props {
  event: DatabaseEvent;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  decision: "approved" | "rejected" | null;
  error: string | null;
}

function formatInNewYork(isoDate: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options }).format(
    new Date(isoDate)
  );
}

function formatEventDateTime(isoDate: string): string {
  return formatInNewYork(isoDate, {
    weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function titleCase(value: string): string {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PendingEventCard({ event, onApprove, onReject, decision, error }: Props) {
  const [confirmReject, setConfirmReject] = useState(false);
  const [lastDecision, setLastDecision] = useState<"approved" | "rejected" | null>(null);
  const isFree = event.price_type === "free" || event.price_amount == null;
  const isDeciding = decision !== null;
  const rejectionFailed = lastDecision === "rejected" && error !== null;

  return (
    <article className="pending-event-card">
      <div className="pending-event-card__heading">
        <div>
          <p className="pending-event-card__eyebrow">Pending review</p>
          <h3>{event.title}</h3>
        </div>
        <div className="pending-event-card__chips" aria-label="Event details">
          <span>{titleCase(event.event_type)}</span>
          <span>{titleCase(event.city)}</span>
        </div>
      </div>
      <dl className="pending-event-card__metadata">
        <div><dt>When</dt><dd>{formatEventDateTime(event.event_date)}</dd></div>
        <div><dt>Price</dt><dd>{isFree ? "Free" : `$${event.price_amount}`}</dd></div>
        {event.location && <div><dt>Location</dt><dd>{event.location}</dd></div>}
        {event.address && <div><dt>Address</dt><dd>{event.address}</dd></div>}
        {event.host && <div><dt>Host</dt><dd>{event.host}</dd></div>}
        {event.recurrence && <div><dt>Schedule</dt><dd>Repeats: {event.recurrence}</dd></div>}
        <div><dt>Submitted</dt><dd>{formatInNewYork(event.created_at, { year: "numeric", month: "long", day: "numeric" })}</dd></div>
      </dl>
      {event.description && <p className="pending-event-card__description">{event.description}</p>}
      {(event.submitter_name || event.submitter_email) && (
        <p className="pending-event-card__submitter">
          Submitted by {event.submitter_name && <strong>{event.submitter_name}</strong>}
          {event.submitter_name && event.submitter_email && " · "}{event.submitter_email}
        </p>
      )}
      {event.rsvp_link && <a className="pending-event-card__rsvp" href={event.rsvp_link} target="_blank" rel="noopener noreferrer">View RSVP</a>}
      {error && <p className="pending-event-card__error" role="alert">{rejectionFailed ? `Rejection failed: ${error}` : `Approval failed: ${error}`}</p>}
      <div className="pending-event-card__actions">
        {isDeciding ? (
          <button type="button" className="btn-primary" disabled>{decision === "approved" ? "Approving…" : "Rejecting…"}</button>
        ) : confirmReject ? (
          <>
            <button type="button" className="pending-event-card__reject-confirm" onClick={() => { setLastDecision("rejected"); onReject(event.id); }}>
              {rejectionFailed ? "Retry rejection" : "Confirm rejection"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirmReject(false)}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" className="btn-primary" onClick={() => { setLastDecision("approved"); onApprove(event.id); }}>Approve</button>
            <button type="button" className="pending-event-card__reject" onClick={() => setConfirmReject(true)}>Reject event</button>
          </>
        )}
      </div>
    </article>
  );
}
