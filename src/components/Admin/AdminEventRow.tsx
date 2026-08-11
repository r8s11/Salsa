import { useState } from "react";
import type { DatabaseEvent } from "../../features/events/model/types";
import { fromEventDateInstant } from "../../features/events/model/eventDateTime";
import "./AdminEventRow.css";

interface Props {
  event: DatabaseEvent;
  onEdit: (event: DatabaseEvent) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  decision: "approved" | "rejected" | null;
  isDeleting: boolean;
  error: string | null;
}

function titleCase(value: string): string {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatEventDateTime(iso: string): string {
  const { date, time } = fromEventDateInstant(iso);
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const formattedTime = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}, ${formattedTime}`;
}

export default function AdminEventRow({
  event,
  onEdit,
  onApprove,
  onReject,
  onDelete,
  decision,
  isDeleting,
  error,
}: Props) {
  const [confirming, setConfirming] = useState<"reject" | "delete" | null>(null);
  const isBusy = decision !== null || isDeleting;

  const confirmReject = () => {
    setConfirming(null);
    onReject(event.id);
  };

  const confirmDelete = () => {
    setConfirming(null);
    onDelete(event.id);
  };

  return (
    <article className="admin-event-row">
      <div className="admin-event-row__details">
        <div className="admin-event-row__heading">
          <h3>{event.title}</h3>
          <span className={`admin-event-row__status admin-event-row__status--${event.status}`}>
            {titleCase(event.status)}
          </span>
        </div>
        <div className="admin-event-row__chips" aria-label="Event details">
          <span>{titleCase(event.event_type)}</span>
          <span>{titleCase(event.city)}</span>
        </div>
        <p className="admin-event-row__when">{formatEventDateTime(event.event_date)}</p>
        {event.location && <p className="admin-event-row__venue">{event.location}</p>}
      </div>

      {error && decision === null && !isDeleting && (
        <p className="admin-event-row__error" role="alert">Action failed: {error}</p>
      )}

      <div className="admin-event-row__actions">
        {isBusy ? (
          <button type="button" className="btn-primary" disabled>
            {decision === "approved" ? "Approving…" : decision === "rejected" ? "Rejecting…" : "Deleting…"}
          </button>
        ) : confirming === "reject" ? (
          <>
            <button type="button" className="admin-event-row__danger-confirm" onClick={confirmReject}>
              Confirm rejection
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirming(null)}>
              Cancel
            </button>
          </>
        ) : confirming === "delete" ? (
          <>
            <button type="button" className="admin-event-row__danger-confirm" onClick={confirmDelete}>
              Confirm delete
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirming(null)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-secondary" onClick={() => onEdit(event)}>
              Edit
            </button>
            {event.status === "pending" && (
              <>
                <button type="button" className="btn-primary" onClick={() => onApprove(event.id)}>
                  Approve
                </button>
                <button type="button" className="admin-event-row__danger" onClick={() => setConfirming("reject")}>
                  Reject event
                </button>
              </>
            )}
            <button type="button" className="admin-event-row__danger" onClick={() => setConfirming("delete")}>
              Delete
            </button>
          </>
        )}
      </div>
    </article>
  );
}
