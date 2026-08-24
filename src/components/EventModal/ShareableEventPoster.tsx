import React from "react";
import { Clock, MapPin } from "lucide-react";
import { ScheduleXEvent } from "../../types/events";
import "./ShareableEventPoster.css";

export type PosterFormat = "square" | "portrait";

interface ShareableEventPosterProps {
  event: ScheduleXEvent;
  format: PosterFormat;
}

/**
 * Renders a social-media-optimized event poster.
 * Designed for 1080×1080 (square — Instagram post) or
 * 1080×1920 (portrait — Instagram Story / TikTok).
 */
export default function ShareableEventPoster({
  event,
  format,
}: ShareableEventPosterProps) {
  const formatClass =
    format === "portrait" ? "poster-portrait" : "poster-square";

  const toDate = (val: unknown): Date => {
    if (typeof val === "string") {
      return new Date(val.replace(" ", "T"));
    }
    if (val && typeof val === "object" && "epochMilliseconds" in val) {
      return new Date(
        Number((val as { epochMilliseconds: bigint }).epochMilliseconds)
      );
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

  return (
    <div className={`shareable-poster ${formatClass}`}>
      {/* Background layer */}
      <div className="poster-bg">
        {event.imageUrl ? (
          <img
            className="poster-bg-img"
            src={event.imageUrl}
            alt=""
            crossOrigin="anonymous"
          />
        ) : null}
        <div className="poster-bg-gradient" />
      </div>

      {/* Content layer */}
      <div className={`poster-content${!event.imageUrl ? " poster-no-image" : ""}`}>
        {/* Top strip */}
        <div className="poster-top">
          <span className="poster-brand">Salsa Segura</span>
          <span className="poster-chip">{event.calendarId}</span>
        </div>

        {/* Spacer */}
        <div className="poster-spacer" />

        {/* Bottom details */}
        <div className="poster-bottom">
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