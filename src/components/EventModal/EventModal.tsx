import React from "react";
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

  // Normalize a start/end value that may be a string or a Temporal.ZonedDateTime
  const toDate = (val: unknown): Date => {
    if (typeof val === "string") {
      return new Date(val.replace(" ", "T"));
    }
    // Temporal.ZonedDateTime — convert via epochMilliseconds
    if (val && typeof val === "object" && "epochMilliseconds" in val) {
      return new Date(Number((val as { epochMilliseconds: bigint }).epochMilliseconds));
    }
    return new Date(String(val));
  };

  // Format date from "YYYY-MM-DD HH:mm" string
  const formatDate = (dateVal: unknown) => {
    const date = toDate(dateVal);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (startVal: unknown, endVal: unknown) => {
    const startDate = toDate(startVal);
    const endDate = toDate(endVal);
    const opts: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
    };
    return `${startDate.toLocaleTimeString("en-US", opts)} - ${endDate.toLocaleTimeString("en-US", opts)}`;
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
          <button className="modal-close" onClick={onClose} aria-label="Close Modal">
            x
          </button>
        </div>
        <div className="modal-body">
          <span className={`event-type-badge ${event.calendarId}`}>{event.calendarId}</span>
          <div className="event-detail">
            <span className="event-detail-label">Date: </span>
            <span className="event-detail-value">{formatDate(event.start)}</span>
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
