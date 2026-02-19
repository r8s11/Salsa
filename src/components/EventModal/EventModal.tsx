import React, { useEffect, useRef } from "react";
import { ScheduleXEvent } from "../../types/events";
import "./EventModal.css";

interface EventModalProps {
  event: ScheduleXEvent | null;
  onClose: () => void;
}
export default function EventModal({ event, onClose }: EventModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus management: move focus into modal on open, restore on close
  useEffect(() => {
    if (event) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus the close button after render
      const closeBtn = modalRef.current?.querySelector<HTMLButtonElement>(".modal-close");
      closeBtn?.focus();
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [event]);

  // Trap focus inside modal
  useEffect(() => {
    if (!event || !modalRef.current) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, [event]);

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
      ref={modalRef}
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
            <div className="event-detail">
              <span className="event-detail-label">Location: </span>
              <span className="event-detail-value">{event.location}</span>
            </div>
          )}
          {event.address && (
            <div className="event-detail">
              <span className="event-detail-label">Address: </span>
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
