import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ArrowLeft,
  CalendarPlus,
  Clock,
  Eye,
  MoreHorizontal,
  Link2,
  MapPin,
  Repeat,
  Share2,
  Users,
  X,
} from "lucide-react";
import { ScheduleXEvent } from "../../types/events";
import { downloadIcs, mapsUrl, googleCalendarUrl } from "../../utils/ics";
import { getUpcomingSeriesDates } from "../../utils/series";
import { resolvePosterImageForEvent } from "../../features/calendar/api/posterFlyers";
import { useShareablePoster } from "../../features/calendar/hooks/useShareablePoster";
import { buildPublicEventUrl } from "../../features/events/model/eventSharing";
import { useAccessibleDialog } from "../../shared/a11y/useAccessibleDialog";
import { recordEventTouch } from "../../features/events/api/eventsRepo";
import { useEventViewTouch } from "../../features/events/hooks/useEventViewTouch";
import ShareableEventPoster from "./ShareableEventPoster";
import { resolveEventFlyer } from "./eventModalImage";
import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import ButtonLink from "../ui/ButtonLink";
import "./EventModal.css";

interface EventModalProps {
  event: ScheduleXEvent | null;
  onClose: () => void;
}

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

/**
 * Closed state renders nothing and — critically — mounts none of the dialog
 * mechanics. Escape handling, the focus trap, background `inert` and the body
 * scroll lock live in the inner component, so they exist only while a modal
 * is actually on screen.
 */
export default function EventModal({ event, onClose }: EventModalProps) {
  if (!event) return null;
  return <EventModalDialog event={event} onClose={onClose} />;
}

function EventModalDialog({ event, onClose }: { event: ScheduleXEvent; onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeXRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragCloseTimerRef = useRef<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    lastY: number;
    lastT: number;
    velocity: number;
    handle: HTMLDivElement;
    onBlur: () => void;
  } | null>(null);

  const { onKeyDown, onBackdropClick } = useAccessibleDialog({
    dialogRef: modalRef,
    onDismiss: onClose,
    initialFocusRef: closeXRef,
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  // Visible action feedback, mirroring InstagramStoryShare: errors announce
  // via role="alert", confirmations via role="status". Scoped to the region
  // whose button was used, so exactly one live copy exists in the DOM.
  type ActionRegion = "desktop" | "mobile";
  const [feedback, setFeedback] = useState<{
    kind: "status" | "error";
    message: string;
    region: ActionRegion;
  } | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const { ensureContainer, capturePoster, posterFilename, downloadPoster, removeTarget } =
    useShareablePoster();

  useEventViewTouch(String(event.id));

  const canonicalUrl = buildPublicEventUrl(String(event.id));

  // Clear the "Copied" and drag-close timers on close/unmount.
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
      if (dragCloseTimerRef.current !== null) window.clearTimeout(dragCloseTimerRef.current);
    };
  }, []);
  const handleCopyLink = async (region: ActionRegion) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(canonicalUrl);
      setCopied(true);
      setFeedback(null);
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback({ kind: "error", message: "Could not copy event link.", region });
    }
  };

  // ── Sheet drag-to-dismiss (mobile) ──
  // The handle drags the sheet down; release past a distance or a flick
  // closes it. Interrupted gestures (pointercancel, lost capture, blur, or
  // a second finger landing mid-drag) end the drag cleanly and never
  // dismiss — and the next drag works without a reload.
  const DRAG_DISMISS_DISTANCE = 96;
  const DRAG_FLICK_VELOCITY = 0.5; // px/ms

  const finishSheetDrag = (mode: "snap" | "cancel" | "dismiss") => {
    const drag = dragRef.current;
    const content = contentRef.current;
    dragRef.current = null;
    if (drag) {
      window.removeEventListener("blur", drag.onBlur);
      try {
        drag.handle.releasePointerCapture(drag.pointerId);
      } catch {
        // capture already released (pointercancel / lostpointercapture)
      }
    }
    if (!content) return;
    content.classList.remove("is-dragging");
    if (mode === "dismiss") {
      content.style.setProperty("--sheet-drag", "100dvh");
      dragCloseTimerRef.current = window.setTimeout(onClose, 200);
    } else {
      content.style.setProperty("--sheet-drag", "0px");
    }
  };

  const onSheetDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (dragRef.current) return; // a second finger never steals the drag
    const content = contentRef.current;
    if (!content) return;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const onBlur = () => finishSheetDrag("cancel");
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
      handle,
      onBlur,
    };
    window.addEventListener("blur", onBlur);
    content.classList.add("is-dragging");
    event.preventDefault();
  };

  const onSheetDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const content = contentRef.current;
    if (!drag || !content || event.pointerId !== drag.pointerId) return;
    const dt = event.timeStamp - drag.lastT;
    if (dt > 0) drag.velocity = (event.clientY - drag.lastY) / dt;
    drag.lastY = event.clientY;
    drag.lastT = event.timeStamp;
    const dy = event.clientY - drag.startY;
    // Upward drags resist — the sheet never travels above its rest.
    content.style.setProperty("--sheet-drag", `${dy < 0 ? dy * 0.15 : dy}px`);
  };

  const onSheetDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dy = event.clientY - drag.startY;
    const flick = drag.velocity > DRAG_FLICK_VELOCITY;
    finishSheetDrag(dy > DRAG_DISMISS_DISTANCE || (flick && dy > 24) ? "dismiss" : "snap");
  };

  const onSheetDragAbort = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    finishSheetDrag("cancel");
  };

  // ── Shared action buttons (used in desktop sidebar + mobile sticky bar) ──
  const isFree = event.priceType === "free" || event.priceAmount == null;
  const priceLabel = isFree ? "Free" : `$${event.priceAmount}`;
  const rsvpLabel = isFree ? "RSVP · Free" : "Get Tickets";
  const seriesDates = event.recurrence === "weekly" ? getUpcomingSeriesDates(event.start) : [];
  const galleryThumbs = event.gallery?.slice(0, 4) ?? [];
  const galleryExtra = (event.gallery?.length ?? 0) - galleryThumbs.length;
  const resolvedImageUrl = resolveEventFlyer(event);

  const hasContacts = !!(event.contactEmail || event.contactInstagram || event.contactWebsite);
  const locationLabel = `${event.location}${event.address ? ` · ${event.address}` : ""}`;
  const locationUrl = mapsUrl(event);

  // Location link, rendered identically in quick facts and meta rows
  const renderLocationLink = () =>
    locationUrl ? (
      <a
        href={locationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="address-link"
        aria-label={`Open ${locationLabel} in Maps`}
      >
        {locationLabel}
      </a>
    ) : (
      <span>{locationLabel}</span>
    );

  // Contact block, rendered identically in desktop sidebar and mobile extras
  const renderContactBlock = () =>
    hasContacts ? (
      <div className="contact-block">
        <h3 className="contact-eyebrow">Contact</h3>
        {event.contactEmail && <a href={`mailto:${event.contactEmail}`}>{event.contactEmail}</a>}
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
    ) : null;

  // Series dates list, rendered identically in desktop sidebar and mobile extras
  const renderSeries = () =>
    seriesDates.length > 0 ? (
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
              <a
                href={event.rsvpLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void recordEventTouch(String(event.id), "rsvp_click")}
              >
                Reserve
              </a>
            )}
          </div>
        ))}
      </div>
    ) : null;

  // ── Poster sharing ──
  // Same pipeline as InstagramStoryShare: off-screen ShareableEventPoster,
  // capture, then the native files share with the canonical event URL in the
  // text so every shared poster returns a dancer to this exact event.
  // Failures surface as visible feedback (never console-only); a dismissed
  // share sheet stays silent because that is a choice, not a failure.
  const handleSharePoster = async (region: ActionRegion) => {
    if (isDownloading || !event) return;
    setIsDownloading(true);
    setFeedback(null);
    let root: Root | null = null;
    try {
      const resolution = await resolvePosterImageForEvent({
        eventId: String(event.id),
        sourceUrl: event.imageUrl ?? null,
        cachedUrl: event.posterImageUrl ?? null,
      });

      const posterImageUrl = resolution.status === "ready" ? resolution.dataUrl : undefined;

      const container = ensureContainer();
      root = createRoot(container);
      root.render(
        <ShareableEventPoster event={event} imageUrl={posterImageUrl} eventUrl={canonicalUrl} />
      );
      // Executor form: this project's tsconfig lib (ES2020) has no
      // Promise.withResolvers (see useShareablePoster's identical note).
      await new Promise((resolve) => setTimeout(resolve, 300));
      const poster = await capturePoster(container);
      const file = new File([poster], posterFilename(event), { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: event.title,
            text: `${event.title} — ${canonicalUrl}`,
          });
        } catch (err) {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            setFeedback({
              kind: "error",
              message: "Poster sharing failed. Please try again.",
              region,
            });
          }
        }
      } else {
        downloadPoster(event, poster);
        setFeedback({
          kind: "status",
          message: "Sharing isn't available here — the poster was downloaded instead.",
          region,
        });
      }
    } catch {
      setFeedback({
        kind: "error",
        message: "Could not create the poster. Please try again.",
        region,
      });
    } finally {
      root?.unmount();
      removeTarget();
      setIsDownloading(false);
    }
  };

  // Desktop keeps the full utility set in its sidebar. Mobile gets a booking
  // action plus two visible utilities; lower-frequency actions live under More.
  const renderCalendarAction = () => {
    const calUrl = googleCalendarUrl(event);
    return calUrl ? (
      <ButtonLink href={calUrl} external variant="secondary" className="ics-button">
        <CalendarPlus size={16} aria-hidden /> Add to calendar
      </ButtonLink>
    ) : (
      <Button variant="secondary" onClick={() => downloadIcs(event)} className="ics-button">
        <CalendarPlus size={16} aria-hidden /> Add to calendar
      </Button>
    );
  };

  // Feedback renders only in the region whose button produced it, so exactly
  // one live copy exists in the DOM.
  const renderFeedback = (region: ActionRegion) =>
    feedback && feedback.region === region ? (
      <p className="action-feedback" role={feedback.kind === "error" ? "alert" : "status"}>
        {feedback.message}
      </p>
    ) : null;

  // Price-aware attendance note. Never invents a walk-in policy: without an
  // RSVP link it only speaks when contact facts exist, and stays silent
  // otherwise. Desktop-only; the sidebar sits directly above the contact
  // block, so "below" is accurate there.
  const renderReassurance = () => {
    if (event.rsvpLink) {
      return (
        <p className="reassurance">
          {isFree ? "RSVP on the host's page · free entry" : "Tickets on the host's page"}
        </p>
      );
    }
    if (hasContacts) {
      return <p className="reassurance">No online tickets — reach the host below</p>;
    }
    return null;
  };

  const renderShareButton = (region: ActionRegion) => (
    <Button
      variant="secondary"
      onClick={() => void handleSharePoster(region)}
      disabled={isDownloading}
      loading={isDownloading}
      loadingLabel="Generating…"
    >
      <Share2 size={16} aria-hidden />
      Share poster
    </Button>
  );

  const renderCopyButton = (region: ActionRegion) => (
    <Button
      variant="secondary"
      onClick={() => void handleCopyLink(region)}
      className="copy-link-btn"
    >
      <Link2 size={16} aria-hidden />
      {copied ? "Copied" : "Copy link"}
    </Button>
  );

  const renderDesktopActions = () => (
    <>
      <ButtonLink to={`/events/${event.id}`} variant="secondary" onClick={onClose}>
        <Eye size={16} aria-hidden />
        Full details
      </ButtonLink>
      <div className="poster-download-section">{renderShareButton("desktop")}</div>
      {renderCalendarAction()}
      {renderCopyButton("desktop")}
      {renderReassurance()}
      {renderFeedback("desktop")}
    </>
  );

  const renderMobileActions = () => (
    <>
      {event.rsvpLink ? (
        <ButtonLink
          href={event.rsvpLink}
          external
          className="rsvp-button"
          onClick={() => void recordEventTouch(String(event.id), "rsvp_click")}
        >
          {rsvpLabel}
        </ButtonLink>
      ) : (
        <ButtonLink to={`/events/${event.id}`} className="rsvp-button" onClick={onClose}>
          <Eye size={16} aria-hidden />
          Full details
        </ButtonLink>
      )}
      <div className="poster-download-section">{renderShareButton("mobile")}</div>
      <details className="mobile-actions-overflow">
        <summary className="ui-button ui-button--secondary mobile-actions-overflow__toggle">
          <MoreHorizontal size={16} aria-hidden />
          More
        </summary>
        <div className="mobile-actions-overflow__menu">
          <ButtonLink to={`/events/${event.id}`} variant="secondary" onClick={onClose}>
            <Eye size={16} aria-hidden />
            Full details
          </ButtonLink>
          {renderCalendarAction()}
          {renderCopyButton("mobile")}
        </div>
      </details>
      {renderFeedback("mobile")}
    </>
  );

  return (
    <div
      className="modal-overlay"
      onClick={onBackdropClick}
      onKeyDown={onKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      ref={modalRef}
    >
      <div className="modal-content" ref={contentRef}>
        {/* Drag handle — visible only on mobile; drag down to dismiss */}
        <div
          className="modal-drag-handle"
          aria-hidden
          onPointerDown={onSheetDragStart}
          onPointerMove={onSheetDragMove}
          onPointerUp={onSheetDragEnd}
          onPointerCancel={onSheetDragAbort}
          onLostPointerCapture={onSheetDragAbort}
        />

        {/* Close is always visible on both layouts, so it owns initial focus.
            The Back pill is display:none on mobile and must never take it. */}
        <IconButton ref={closeXRef} aria-label="Close" onClick={onClose} className="modal-close-x">
          <X size={20} aria-hidden />
        </IconButton>

        {/* ── Poster header ── */}
        <div className="modal-poster" style={{ backgroundImage: `url(${resolvedImageUrl})` }}>
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

        {/* ── Decision strip ──
            The dancer sees the poster above; this is the first thing they
            read after it. Time, location, price on the left; the RSVP
            decision on the right. One compact row — the dancer's information
            is no longer scattered across three separate regions. */}
        <div className="decision-strip">
          <div className="decision-strip__facts">
            <div className="decision-strip__fact">
              <Clock size={14} aria-hidden />
              <span>{formatTime(event.start, event.end)}</span>
            </div>
            {event.location && (
              <div className="decision-strip__fact">
                <MapPin size={14} aria-hidden />
                <span>{renderLocationLink()}</span>
              </div>
            )}
            <div className="decision-strip__fact">
              <span className="decision-strip__price">{priceLabel}</span>
            </div>
          </div>
          {event.rsvpLink && (
            <ButtonLink
              href={event.rsvpLink}
              external
              className="decision-strip__rsvp"
              onClick={() => void recordEventTouch(String(event.id), "rsvp_click")}
            >
              {rsvpLabel}
            </ButtonLink>
          )}
        </div>

        {/* ── Dance styles (prominent, before description) ── */}
        {event.danceStyles && event.danceStyles.length > 0 && (
          <div className="modal-style-row">
            {event.danceStyles.map((style) => (
              <span key={style} className="style-chip">
                {style}
              </span>
            ))}
          </div>
        )}

        {/* ── Scrollable body (details + desktop sidebar) ── */}
        <div className="modal-body">
          <div className="modal-grid">
            <div className="modal-details">
              {event.recurrence && (
                <div className="meta-row">
                  <Repeat size={18} aria-hidden />
                  <span>{event.recurrence === "weekly" ? "Repeats weekly" : "Repeats"}</span>
                </div>
              )}
              {event.host && (
                <div className="meta-row">
                  <Users size={18} aria-hidden />
                  <span>with {event.host}</span>
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
                        alt={`${event.title} gallery image ${index + 1}`}
                        loading="lazy"
                      />
                    ))}
                    {galleryExtra > 0 && <span className="gallery-more">+{galleryExtra}</span>}
                  </div>
                </div>
              )}
            </div>

            <aside className="modal-sidebar">
              {renderDesktopActions()}
              {renderContactBlock()}
              {renderSeries()}
            </aside>
          </div>

          {/* Additional content shown inline on mobile (hidden in desktop sidebar) */}
          <div className="modal-mobile-extras">
            {renderContactBlock()}
            {renderSeries()}
          </div>
        </div>

        <div className="modal-mobile-actions">{renderMobileActions()}</div>
      </div>
    </div>
  );
}
