import React, { useEffect, useRef } from "react";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  CalendarPlus,
  Clock,
  MapPin,
  Repeat,
  Users,
} from "lucide-react";
import { ScheduleXEvent } from "../../types/events";
import { downloadIcs } from "../../utils/ics";
import { getUpcomingSeriesDates } from "../../utils/series";
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

  const isFree = event.priceType === "free" || event.priceAmount == null;
  const priceLabel = isFree ? "Free" : `$${event.priceAmount}`;
  const rsvpLabel = isFree ? "RSVP · Free" : "Get Tickets";
  const seriesDates =
    event.recurrence === "weekly" ? getUpcomingSeriesDates(event.start) : [];
  const galleryThumbs = event.gallery?.slice(0, 4) ?? [];
  const galleryExtra = (event.gallery?.length ?? 0) - galleryThumbs.length;

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
        <div
          className="modal-poster"
          style={
            event.imageUrl
              ? { backgroundImage: `url(${event.imageUrl})` }
              : undefined
          }
        >
          <button className="modal-close back-pill" onClick={onClose}>
            <ArrowLeft size={16} aria-hidden /> Back to calendar
          </button>
          <div className="poster-overlay">
            <span className={`style-chip chip-${event.calendarId}`}>
              {event.calendarId}
            </span>
            <h2 id="modal-title">{event.title}</h2>
          </div>
        </div>

        <div className="modal-grid">
          <div className="modal-details">
            <div className="meta-row">
              <CalendarIcon size={18} aria-hidden />
              <span>{formatDate(event.start)}</span>
              {event.recurrence && (
                <span className="repeat-pill">
                  <Repeat size={12} aria-hidden />
                  {event.recurrence === "weekly" ? "Repeats weekly" : "Repeats"}
                </span>
              )}
            </div>
            {event.location && (
              <div className="meta-row">
                <MapPin size={18} aria-hidden />
                <span>
                  {event.location}
                  {event.address ? ` · ${event.address}` : ""}
                </span>
              </div>
            )}
            <div className="meta-row">
              <Clock size={18} aria-hidden />
              <span>{formatTime(event.start, event.end)}</span>
            </div>
            {event.host && (
              <div className="meta-row">
                <Users size={18} aria-hidden />
                <span>with {event.host}</span>
              </div>
            )}
            {event.description && (
              <p className="modal-description">{event.description}</p>
            )}
            {galleryThumbs.length > 0 && (
              <div className="gallery">
                <h3 className="gallery-eyebrow">Photos from past nights</h3>
                <div className="gallery-row">
                  {galleryThumbs.map((src, index) => (
                    <img
                      key={src}
                      className="gallery-thumb"
                      src={src}
                      alt={`Past night photo ${index + 1}`}
                    />
                  ))}
                  {galleryExtra > 0 && (
                    <span className="gallery-more">+{galleryExtra}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="modal-rsvp">
            <div className="price-row">
              <span className="price-amount">{priceLabel}</span>
              <span className="price-note">per person</span>
            </div>
            {event.rsvpLink && (
              <a
                className="btn-primary rsvp-button"
                href={event.rsvpLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {rsvpLabel}
              </a>
            )}
            <button className="btn-secondary ics-button" onClick={() => downloadIcs(event)}>
              <CalendarPlus size={16} aria-hidden /> Add to calendar
            </button>
            <p className="reassurance">
              RSVP opens the host's page · pay at the door
            </p>
            {seriesDates.length > 0 && (
              <div className="series">
                <h3>More dates in this series</h3>
                {seriesDates.map((date) => (
                  <div key={date.toString()} className="series-item">
                    <span>
                      {date.toLocaleString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    {event.rsvpLink && (
                      <a href={event.rsvpLink} target="_blank" rel="noopener noreferrer">
                        Reserve
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
