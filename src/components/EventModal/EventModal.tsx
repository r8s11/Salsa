import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowLeft,
  CalendarPlus,
  Clock,
  Download,
  Eye,
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
import { useShareablePoster } from "../../features/calendar/hooks/useShareablePoster";
import { buildPublicEventUrl } from "../../features/events/model/eventSharing";
import { buildShortEventUrl, shortEventLabel } from "../../features/events/model/shortLink";
import { useAccessibleDialog } from "../../shared/a11y/useAccessibleDialog";
import { recordEventTouch } from "../../features/events/api/eventsRepo";
import { useEventViewTouch } from "../../features/events/hooks/useEventViewTouch";
import SleeveCover from "./SleeveCover";
import { POSTER_SIZE, type PosterFormat } from "./posterFormat";
import { ensurePosterFonts } from "./posterFonts";
import { resolveEventFlyer } from "./eventModalImage";
import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import ButtonLink from "../ui/ButtonLink";
import "./EventModal.css";

// The full poster carries the QR encoder; it loads only when a dancer opens
// the preview. The thumbnail uses SleeveCover, which does not need it.
const ShareableEventPoster = lazy(() => import("./ShareableEventPoster"));

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

  // The poster preview is a second view inside the same dialog. Escape backs
  // out of it first; a second Escape closes the event.
  const [view, setView] = useState<"card" | "poster">("card");
  const [format, setFormat] = useState<PosterFormat>("story");
  const sleeveButtonRef = useRef<HTMLButtonElement>(null);
  const previewBackRef = useRef<HTMLButtonElement>(null);

  const closePreview = () => {
    setView("card");
    // Return focus to the sleeve that opened the preview.
    window.requestAnimationFrame(() => sleeveButtonRef.current?.focus());
  };

  const { onKeyDown, onBackdropClick } = useAccessibleDialog({
    dialogRef: modalRef,
    onDismiss: view === "poster" ? closePreview : onClose,
    initialFocusRef: closeXRef,
  });
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  // Visible action feedback, mirroring InstagramStoryShare: errors announce
  // via role="alert", confirmations via role="status". Scoped to the region
  // whose button was used, so exactly one live copy exists in the DOM.
  type ActionRegion = "card" | "bar" | "preview" | "utilities";
  const [feedback, setFeedback] = useState<{
    kind: "status" | "error";
    message: string;
    region: ActionRegion;
  } | null>(null);
  const [shareFallback, setShareFallback] = useState<{
    poster: Blob;
    format: PosterFormat;
    region: ActionRegion;
  } | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const { createPoster, posterFilename, downloadPoster } = useShareablePoster();

  useEventViewTouch(String(event.id));

  // The sleeve thumbnail and preview set the poster's own faces.
  useEffect(() => {
    void ensurePosterFonts();
  }, []);

  useEffect(() => {
    if (view === "poster") previewBackRef.current?.focus();
  }, [view]);

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

  // ── Shared facts and actions ──
  const isFree = event.priceType === "free" || event.priceAmount == null;
  const priceLabel = isFree ? "Free" : `$${event.priceAmount}`;
  const rsvpLabel = isFree ? "RSVP · Free" : "Get Tickets";
  const seriesDates = event.recurrence === "weekly" ? getUpcomingSeriesDates(event.start) : [];
  const galleryThumbs = event.gallery?.slice(0, 4) ?? [];
  const galleryExtra = (event.gallery?.length ?? 0) - galleryThumbs.length;
  const coverUrl = resolveEventFlyer(event);
  const coverKind = event.imageUrl?.trim() ? "flyer" : "fallback";
  const shortUrl = buildShortEventUrl(String(event.id));
  const shortLabel = shortEventLabel(String(event.id));

  const hasContacts = !!(event.contactEmail || event.contactInstagram || event.contactWebsite);
  const locationLabel = `${event.location}${event.address ? ` · ${event.address}` : ""}`;
  const locationUrl = mapsUrl(event);

  // Contact block, in the side column of "About the night"
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

  // Series dates list, beside the contact block
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
  // The sleeve is rendered off-screen at export size, captured, and handed
  // to the native share with the event URL as both a URL and text value, so
  // share targets can make it tappable while retaining the image. The poster
  // itself keeps its QR and printed short link for cross-device use.
  // Failures surface as visible feedback; a dismissed share sheet stays silent.
  const handleSharePoster = async (region: ActionRegion, posterFormat: PosterFormat) => {
    if (isSharing) return;
    setIsSharing(true);
    setFeedback(null);
    setShareFallback(null);
    try {
      const poster = await createPoster(event, posterFormat);
      const file = new File([poster], posterFilename(event, posterFormat), { type: "image/png" });
      const shareData = {
        files: [file],
        title: event.title,
        text: `${event.title} — ${canonicalUrl}`,
        url: canonicalUrl,
      };

      if (navigator.canShare?.(shareData)) {
        try {
          await navigator.share(shareData);
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          const needsFreshActivation = err instanceof DOMException && err.name === "NotAllowedError";
          if (needsFreshActivation) {
            setShareFallback({ poster, format: posterFormat, region });
          }
          setFeedback({
            kind: "error",
            message: needsFreshActivation
              ? "Sharing needs a fresh tap. Download the poster instead."
              : "Sending the poster failed. Please try again.",
            region,
          });
        }
      } else {
        downloadPoster(event, poster, posterFormat);
        setFeedback({
          kind: "status",
          message: "Sharing isn't available here, so the poster was downloaded instead.",
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
      setIsSharing(false);
    }
  };

  const handleSavePoster = async () => {
    if (isSharing) return;
    setIsSharing(true);
    setFeedback(null);
    try {
      downloadPoster(event, await createPoster(event, format), format);
      setFeedback({
        kind: "status",
        message: "Poster saved to your downloads.",
        region: "preview",
      });
    } catch {
      setFeedback({
        kind: "error",
        message: "Could not create the poster. Please try again.",
        region: "preview",
      });
    } finally {
      setIsSharing(false);
    }
  };
  const handleDownloadShareFallback = () => {
    if (!shareFallback) return;
    try {
      downloadPoster(event, shareFallback.poster, shareFallback.format);
      setShareFallback(null);
      setFeedback({
        kind: "status",
        message: "Poster saved to your downloads.",
        region: shareFallback.region,
      });
    } catch {
      setFeedback({
        kind: "error",
        message: "Could not download the poster. Please try again.",
        region: shareFallback.region,
      });
    }
  };


  const renderCalendarAction = () => {
    const calUrl = googleCalendarUrl(event);
    return calUrl ? (
      <ButtonLink href={calUrl} external variant="ghost" className="night-utility">
        <CalendarPlus size={16} aria-hidden /> Add to calendar
      </ButtonLink>
    ) : (
      <Button variant="ghost" onClick={() => downloadIcs(event)} className="night-utility">
        <CalendarPlus size={16} aria-hidden /> Add to calendar
      </Button>
    );
  };

  // Feedback renders only in the region whose button produced it, so exactly
  // one live copy exists in the DOM.
  const renderFeedback = (region: ActionRegion) =>
    feedback && feedback.region === region ? (
      <div className="action-feedback" role={feedback.kind === "error" ? "alert" : "status"}>
        {feedback.message}
        {shareFallback?.region === region && (
          <Button variant="secondary" onClick={handleDownloadShareFallback}>
            <Download size={16} aria-hidden />
            Download poster
          </Button>
        )}
      </div>
    ) : null;

  // Price-aware attendance note. Never invents a walk-in policy: without an
  // RSVP link it only speaks when contact facts exist, and stays silent
  // otherwise. The contact block sits in the details below it.
  const renderReassurance = () => {
    if (event.rsvpLink) {
      return (
        <p className="reassurance">
          {isFree ? "RSVP on the host's page · free entry" : "Tickets on the host's page"}
        </p>
      );
    }
    if (hasContacts) {
      return <p className="reassurance">No online tickets. Reach the host below.</p>;
    }
    return null;
  };

  // The two decisions, equal in size: bring friends, or commit. Rendered in
  // the card on desktop and in the sheet's thumb-zone bar on mobile; CSS
  // shows exactly one region per layout.
  const renderDecisions = (region: "card" | "bar") => (
    <div className={`night-actions night-actions--${region}`}>
      <Button
        variant="primary"
        className="night-actions__send"
        onClick={() => void handleSharePoster(region, "story")}
        disabled={isSharing}
        loading={isSharing}
        loadingLabel="Pressing poster…"
      >
        <Share2 size={16} aria-hidden />
        Send to friends
      </Button>
      {event.rsvpLink ? (
        <ButtonLink
          href={event.rsvpLink}
          external
          variant="secondary"
          className="night-actions__rsvp"
          onClick={() => void recordEventTouch(String(event.id), "rsvp_click")}
        >
          {rsvpLabel}
        </ButtonLink>
      ) : (
        <ButtonLink
          to={`/events/${event.id}`}
          variant="secondary"
          className="night-actions__rsvp"
          onClick={onClose}
        >
          <Eye size={16} aria-hidden />
          Full details
        </ButtonLink>
      )}
      {renderFeedback(region)}
    </div>
  );

  const hasDetails =
    Boolean(event.recurrence || event.host || event.description) ||
    galleryThumbs.length > 0 ||
    hasContacts ||
    seriesDates.length > 0;

  const renderNight = () => (
    <>
      <div className="modal-scroll">
        {/* ── Night card: the sleeve your friends get, beside the four facts ── */}
        <header className="night-card">
          <button
            ref={sleeveButtonRef}
            type="button"
            className="night-card__sleeve"
            onClick={() => setView("poster")}
            aria-label="Preview the poster your friends get"
          >
            <span className={`sleeve sleeve--thumb sleeve--${event.calendarId}`} aria-hidden="true">
              <SleeveCover event={event} imageUrl={coverUrl} artKind={coverKind} />
            </span>
            <span className="night-card__sleeve-hint" aria-hidden="true">
              <Eye size={14} /> Preview poster
            </span>
          </button>

          <div className="night-card__facts">
            <p className="night-card__date">{formatDate(event.start)}</p>
            <ul className="night-card__list">
              <li>
                <Clock size={16} aria-hidden />
                <span>{formatTime(event.start, event.end)}</span>
              </li>
              {event.location && (
                <li>
                  <MapPin size={16} aria-hidden />
                  <span className="night-card__venue">
                    {locationUrl ? (
                      <a
                        href={locationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="address-link"
                        aria-label={`Open ${locationLabel} in Maps`}
                      >
                        {event.location}
                      </a>
                    ) : (
                      <span>{event.location}</span>
                    )}
                    {event.address && <span className="night-card__address">{event.address}</span>}
                  </span>
                </li>
              )}
              <li className="night-card__price">
                <span className="night-card__price-amount">{priceLabel}</span>
                <span className={`style-chip chip-${event.calendarId}`}>{event.calendarId}</span>
              </li>
            </ul>
          </div>
        </header>

        <h2 id="modal-title" className="night-card__title">
          {event.title}
        </h2>

        {event.danceStyles && event.danceStyles.length > 0 && (
          <div className="modal-style-row">
            {event.danceStyles.map((style) => (
              <span key={style} className="style-chip">
                {style}
              </span>
            ))}
          </div>
        )}

        {renderDecisions("card")}
        {renderReassurance()}

        <div className="night-utilities">
          {renderCalendarAction()}
          <Button
            variant="ghost"
            onClick={() => void handleCopyLink("utilities")}
            className="night-utility copy-link-btn"
          >
            <Link2 size={16} aria-hidden />
            {copied ? "Copied" : "Copy link"}
          </Button>
          {event.rsvpLink && (
            <ButtonLink
              to={`/events/${event.id}`}
              variant="ghost"
              className="night-utility"
              onClick={onClose}
            >
              <Eye size={16} aria-hidden />
              Full details
            </ButtonLink>
          )}
        </div>
        {renderFeedback("utilities")}

        {hasDetails && (
          <section className="night-details" aria-labelledby="night-details-title">
            <h3 id="night-details-title" className="night-details__title">
              About the night
            </h3>
            <div className="night-details__grid">
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
              {(hasContacts || seriesDates.length > 0) && (
                <div className="night-details__side">
                  {renderContactBlock()}
                  {renderSeries()}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {renderDecisions("bar")}
    </>
  );

  // ── Poster preview: exactly what friends receive, at either format ──
  const renderPosterPreview = () => (
    <section className="poster-preview" aria-labelledby="modal-title">
      <div className="poster-preview__head">
        <button
          ref={previewBackRef}
          type="button"
          className="poster-preview__back"
          onClick={closePreview}
        >
          <ArrowLeft size={16} aria-hidden /> Back to the night
        </button>
        <h2 id="modal-title" className="poster-preview__title">
          The poster your friends get
        </h2>
      </div>

      <div className="poster-preview__formats" role="group" aria-label="Poster format">
        {(["story", "feed"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className="poster-preview__format"
            aria-pressed={format === option}
            onClick={() => setFormat(option)}
          >
            {option === "story" ? "Story · 9:16" : "Feed · 4:5"}
          </button>
        ))}
      </div>

      <PosterStage format={format}>
        <Suspense fallback={null}>
          <ShareableEventPoster
            event={event}
            format={format}
            imageUrl={coverUrl}
            artKind={coverKind}
            shortUrl={shortUrl}
            shortLabel={shortLabel}
          />
        </Suspense>
      </PosterStage>

      <div className="poster-preview__actions">
        <Button
          variant="primary"
          onClick={() => void handleSharePoster("preview", format)}
          disabled={isSharing}
          loading={isSharing}
          loadingLabel="Pressing poster…"
        >
          <Share2 size={16} aria-hidden />
          Send this poster
        </Button>
        <Button variant="secondary" onClick={() => void handleSavePoster()} disabled={isSharing}>
          <Download size={16} aria-hidden />
          Save image
        </Button>
      </div>
      {renderFeedback("preview")}
    </section>
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
      <div className={`modal-content modal-content--${view}`} ref={contentRef}>
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

        {/* Close is always visible on both layouts, so it owns initial focus. */}
        <IconButton ref={closeXRef} aria-label="Close" onClick={onClose} className="modal-close-x">
          <X size={20} aria-hidden />
        </IconButton>

        {view === "card" ? renderNight() : renderPosterPreview()}
      </div>
    </div>
  );
}

/**
 * Shows an export-size poster scaled to the width it is given, so the
 * preview is the real artwork rather than an approximation of it.
 */
function PosterStage({ format, children }: { format: PosterFormat; children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const size = POSTER_SIZE[format];

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setWidth(stage.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const scale = width / size.width;
  return (
    <div
      ref={stageRef}
      className={`poster-stage poster-stage--${format}`}
      style={{ height: size.height * scale }}
    >
      <div
        className="poster-stage__canvas"
        style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
