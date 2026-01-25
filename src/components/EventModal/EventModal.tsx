import { ScheduleXEvent } from "../../types/events";
import "./EventModal.css";
interface EventModalProps {
  event: ScheduleXEvent | null;
  onClose: () => void;
}
export default function EventModal({ event, onClose }: EventModalProps) {
  if (!event) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Format date and time from Temporal.ZoneDataTime
  const formatDate = (dt: Temporal.ZonedDateTime) => {
    return dt.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };
  const formatTime = (
    start: Temporal.ZonedDateTime,
    end: Temporal.ZonedDateTime
  ) => {
    const startTime = start.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const endTime = end.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${startTime} - ${endTime}`;
  };
  return (
    <div
      className="modal-overlay"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2 id="modal-title">{event.title}</h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close Modal"
          >
            x
          </button>
        </div>
        <div className="modal-body">
          <span className={`event-type-badge ${event.calendarId}`}>
            {event.calendarId}
          </span>
          <div className="event-detail">
            <span className="event-detail-label">Date: </span>
            <span className="event-detail-value">
              {formatDate(event.start)}
            </span>
            </div>
          <div className="event-detail">
          <span className="event-detail-label">Time: </span>
            <span className="event-detail-value">{formatTime(event.start, event.end)}</span>
          </div>
          {event.location && (
            <div>
              <span>Location: </span>
              <span>{event.location}</span>
            </div>
          )}
          {event.address && (
            <div className="event-detail">
              <span className="event-detail label">Address: </span>
              <span className="event-detail-value">{event.address}</span>
            </div>
          )}
          {event.description && (
            <div className="event-description">
              <p>{event.description}</p>
            </div>
          )}
        </div>
        {event.rsvpLink && (
          <div className="modal-footer">
            <a
              href={event.rsvpLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rsvp-button"
            >
              More info
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
