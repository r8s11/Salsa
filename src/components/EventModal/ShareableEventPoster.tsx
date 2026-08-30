import { Clock, MapPin } from "lucide-react";
import { ScheduleXEvent } from "../../types/events";
import { getEventTitleImageAlt } from "../../features/events/ui/eventTitleImage";
import { resolveEventModalImage } from "./eventModalImage";
import SalsaSeguraLogo from "../brand/SalsaSeguraLogo";
import "./ShareableEventPoster.css";

interface ShareableEventPosterProps {
  event: ScheduleXEvent;
  imageUrl?: string;
}

/**
 * Renders a Story-native social-media event poster.
 * Designed for 1080×1920 Instagram Stories.
 */
export default function ShareableEventPoster({ event, imageUrl }: ShareableEventPosterProps) {
  const toDate = (val: unknown): Date => {
    if (typeof val === "string") {
      return new Date(val.replace(" ", "T"));
    }
    if (val && typeof val === "object" && "epochMilliseconds" in val) {
      return new Date(Number((val as { epochMilliseconds: bigint }).epochMilliseconds));
    }
    return new Date(String(val));
  };

  const formatPosterDate = (dateVal: unknown) => {
    const date = toDate(dateVal);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (startVal: unknown, endVal: unknown) => {
    const startDate = toDate(startVal);
    const endDate = toDate(endVal);
    const opts: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
    };
    return `${startDate.toLocaleTimeString(
      "en-US",
      opts
    )} – ${endDate.toLocaleTimeString("en-US", opts)}`;
  };

  const isFree = event.priceType === "free" || event.priceAmount == null;
  const priceLabel = isFree ? "FREE" : `$${event.priceAmount}`;
  const resolvedImageUrl = imageUrl?.trim() || resolveEventModalImage(event);
  const isGeneratedTitleArt = !imageUrl?.trim() && !event.imageUrl?.trim();
  const imageAlt = isGeneratedTitleArt
    ? getEventTitleImageAlt({
        id: event.id,
        title: event.title,
        eventType: event.calendarId,
        city: event.city,
        start: typeof event.start === "string" ? event.start : String(event.start),
      })
    : `${event.title} flyer`;


  return (
    <div
      className="shareable-poster poster-story"
      role="img"
      aria-label={`Instagram Story poster for ${event.title}`}
    >
      {/* Background layer */}
      <div className="poster-bg">
        <img className="poster-bg-img" src={resolvedImageUrl} alt={imageAlt} />
        <div className="poster-bg-gradient" />
      </div>

      {/* Content layer */}
      <div className="poster-content">
        {/* Top strip */}
        <div className="poster-top">
          <SalsaSeguraLogo
            variant="mark"
            tone="white"
            className="poster-brand-mark"
            ariaLabel="Salsa Segura"
          />
        </div>

        {/* Spacer */}
        <div className="poster-spacer" />

        {/* Bottom details */}
        <div className="poster-bottom">
          <span className="poster-chip">{event.calendarId}</span>
          <p className="poster-date">{formatPosterDate(event.start)}</p>
          <h1 className="poster-title">{event.title}</h1>

          <div className="poster-meta">
            <span className="poster-meta-item">
              <Clock size={28} aria-hidden />
              {formatTime(event.start, event.end)}
            </span>
            {event.location && (
              <span className="poster-meta-item">
                <MapPin size={28} aria-hidden />
                {event.location}
              </span>
            )}
            <span className="poster-price">{priceLabel}</span>
          </div>

          <div className="poster-qr-section">
            <span className="poster-cta">
              {event.rsvpLink
                ? isFree
                  ? "RSVP at salsasegura.com"
                  : "Get tickets at salsasegura.com"
                : "More at salsasegura.com"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
