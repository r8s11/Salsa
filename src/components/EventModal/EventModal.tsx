import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarPlus,
  Clock,
  Image as ImageIcon,
  MapPin,
  Repeat,
  RectangleVertical,
  Square,
  Users,
  X,
} from "lucide-react";
import { ScheduleXEvent } from "../../types/events";
import { downloadIcs, mapsUrl, googleCalendarUrl } from "../../utils/ics";
import { getUpcomingSeriesDates } from "../../utils/series";
import { useShareablePoster } from "../../features/calendar/hooks/useShareablePoster";
import ShareableEventPoster, { PosterFormat } from "./ShareableEventPoster";
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
  const seriesDates = event.recurrence === "weekly" ? getUpcomingSeriesDates(event.start) : [];
  const galleryThumbs = event.gallery?.slice(0, 4) ?? [];
  const galleryExtra = (event.gallery?.length ?? 0) - galleryThumbs.length;

  // ── Poster download ──
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPosterOptions, setShowPosterOptions] = useState(false);
  const { ensureContainer, captureAndDownload } = useShareablePoster();

  const handleDownloadPoster = async (format: PosterFormat) => {
    if (isDownloading || !event) return;
    setIsDownloading(true);
    setShowPosterOptions(false);
    try {
      const container = ensureContainer();
      const root = createRoot(container);
      root.render(<ShareableEventPoster event={event} format={format} />);
      // Wait for the poster to render before capturing
      await new Promise((resolve) => setTimeout(resolve, 300));
      await captureAndDownload(event, container, format);
      root.unmount();
    } catch (err) {
      console.error("Failed to download poster:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Shared action buttons (used in desktop sidebar + mobile sticky bar) ──
  const renderActions = (inSidebar: boolean) => (
    <>
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

      <Link className="btn-secondary modal-full-details" to={`/events/${event.id}`} onClick={onClose}>
        Full details
      </Link>

      {/* Shareable Poster Download */}
      <div className="poster-download-section">
        {!showPosterOptions ? (
          <button
            className="btn-secondary poster-toggle-btn"
            onClick={() => setShowPosterOptions(true)}
            disabled={isDownloading}
          >
            <ImageIcon size={16} aria-hidden />
            {isDownloading ? "Generating…" : "Download Poster"}
          </button>
        ) : (
          <div className="poster-format-options">
            <span className="poster-format-label">Format:</span>
            <button
              className="btn-secondary poster-format-btn"
              onClick={() => handleDownloadPoster("square")}
              disabled={isDownloading}
            >
              <Square size={16} aria-hidden /> 1:1
            </button>
            <button
              className="btn-secondary poster-format-btn"
              onClick={() => handleDownloadPoster("portrait")}
              disabled={isDownloading}
            >
              <RectangleVertical size={16} aria-hidden /> 9:16
            </button>
          </div>
        )}
      </div>

      {/* Add to Calendar */}
      {(() => {
        const calUrl = googleCalendarUrl(event);
        return calUrl ? (
          <a
            className="btn-secondary ics-button"
            href={calUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Add to calendar"
          >
            <CalendarPlus size={16} aria-hidden /> Add to calendar
          </a>
        ) : (
          <button className="btn-secondary ics-button" onClick={() => downloadIcs(event)}>
            <CalendarPlus size={16} aria-hidden /> Add to calendar
          </button>
        );
      })()}

      {inSidebar && (
        <p className="reassurance">RSVP opens the host's page · pay at the door</p>
      )}
    </>
  );

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
        {/* Drag handle — visible only on mobile */}
        <div className="modal-drag-handle" aria-hidden />

        <button type="button" className="modal-close-x" aria-label="Close" onClick={onClose}>
          <X size={20} aria-hidden />
        </button>

        {/* ── Poster header ── */}
        <div
          className="modal-poster"
          style={event.imageUrl ? { backgroundImage: `url(${event.imageUrl})` } : undefined}
        >
          <button className="modal-close back-pill" onClick={onClose}>
            <ArrowLeft size={16} aria-hidden /> Back to calendar
          </button>
          <div className="poster-overlay">
            <div className="quick-look-header">
              <span className={`style-chip chip-${event.calendarId}`}>{event.calendarId}</span>
              <span className="quick-look-date">{formatDate(event.start)}</span>
            </div>
            <h2 id="modal-title">{event.title}</h2>
          </div>
        </div>

        {/* ── Quick facts strip ── */}
        <div className="quick-facts">
          <div className="fact">
            <Clock size={16} aria-hidden />
            <span>{formatTime(event.start, event.end)}</span>
          </div>
          {event.location && (
            <div className="fact">
              <MapPin size={16} aria-hidden />
              <span>
                {(() => {
                  const url = mapsUrl(event);
                  const label = `${event.location}${event.address ? ` · ${event.address}` : ""}`;
                  return url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label} in Maps`}>{label}</a>
                  ) : <span>{label}</span>;
                })()}
              </span>
            </div>
          )}
          <div className="fact">
            <span className="price-tag">{priceLabel}</span>
          </div>
        </div>

        {/* ── Scrollable body (details + desktop sidebar) ── */}
        <div className="modal-body">
          <div className="modal-grid">
            <div className="modal-details">
              {event.recurrence && (
                <>
                <div className="meta-row">
                  <Repeat size={18} aria-hidden />
                  <span>{event.recurrence === "weekly" ? "Repeats weekly" : "Repeats"}</span>
                </div>
                <div className="meta-row">
                  <MapPin size={18} aria-hidden />
                  <span>
                    {(() => {
                      const url = mapsUrl(event);
                      const label = `${event.location}${event.address ? ` · ${event.address}` : ""}`;
                      return url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="address-link"
                          aria-label={`Open ${label} in Maps`}
                        >
                          {label}
                        </a>
                      ) : (
                        <span>{label}</span>
                      );
                    })()}
                  </span>
                </div>
                </>
              )}
              {event.host && (
                <div className="meta-row">
                  <Users size={18} aria-hidden />
                  <span>with {event.host}</span>
                </div>
              )}
              {event.danceStyles && event.danceStyles.length > 0 && (
                <div className="meta-row">
                  <span className="dance-styles">
                    {event.danceStyles.map((style) => (
                      <span key={style} className="style-chip">{style}</span>
                    ))}
                  </span>
                </div>
              )}
              {event.description && <p className="modal-description">{event.description}</p>}
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
                    {galleryExtra > 0 && <span className="gallery-more">+{galleryExtra}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop sidebar — hidden on mobile */}
            <aside className="modal-rsvp">
              {renderActions(true)}

              {(event.contactEmail || event.contactInstagram || event.contactWebsite) && (
                <div className="contact-block">
                  <h3 className="contact-eyebrow">Contact</h3>
                  {event.contactEmail && (
                    <a href={`mailto:${event.contactEmail}`}>{event.contactEmail}</a>
                  )}
                  {event.contactInstagram && (
                    <a
                      href={`https://instagram.com/${event.contactInstagram.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      @{event.contactInstagram.replace(/^@/, "")}
                    </a>
                  )}
                  {event.contactWebsite && (
                    <a href={event.contactWebsite} target="_blank" rel="noopener noreferrer">
                      Visit website
                    </a>
                  )}
                </div>
              )}
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

          {/* Additional content shown inline on mobile (hidden in desktop sidebar) */}
          <div className="modal-mobile-extras">
            {(event.contactEmail || event.contactInstagram || event.contactWebsite) && (
              <div className="contact-block">
                <h3 className="contact-eyebrow">Contact</h3>
                {event.contactEmail && (
                  <a href={`mailto:${event.contactEmail}`}>{event.contactEmail}</a>
                )}
                {event.contactInstagram && (
                  <a
                    href={`https://instagram.com/${event.contactInstagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @{event.contactInstagram.replace(/^@/, "")}
                  </a>
                )}
                {event.contactWebsite && (
                  <a href={event.contactWebsite} target="_blank" rel="noopener noreferrer">
                    Visit website
                  </a>
                )}
              </div>
            )}
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
          </div>
        </div>

        {/* ── Mobile sticky action bar ── */}
        <div className="modal-mobile-actions">
          {renderActions(false)}
        </div>
      </div>
    </div>
  );
}