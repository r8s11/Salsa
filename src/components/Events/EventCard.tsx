import React from "react";
import { ScheduleXEvent } from "../../types/events";
import SalsaSeguraFallbackImage from "../brand/SalsaSeguraFallbackImage";
import { getFallbackTemplate } from "../../utils/eventFallbacks";

const TYPE_LABELS: Record<string, string> = {
  social: "Social Dance",
  class: "Class",
  workshop: "Workshop",
};

export default function EventCard({
  event,
  onSelect,
}: {
  event: ScheduleXEvent;
  onSelect: (event: ScheduleXEvent) => void;
}) {
  const startDate = new Date(event.start.replace(" ", "T"));

  const month = startDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = startDate.getDate().toString();
  const weekday = startDate.toLocaleDateString("en-US", { weekday: "short" });
  const time = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const openDetail = () => onSelect(event);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetail();
    }
  };

  const hasImage = Boolean(event.imageUrl);

  return (
    <article
      className="event-card"
      onClick={openDetail}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${event.title} on ${weekday} ${month} ${day} at ${time}`}
    >
      <div
        className={`event-card-thumb event-card-thumb--${event.calendarId}`}
        style={hasImage ? { backgroundImage: `url(${event.imageUrl})` } : undefined}
      >
        {!hasImage && (
          <SalsaSeguraFallbackImage
            title={event.title}
            template={getFallbackTemplate(event)}
            variant="card"
            decorative
          />
        )}
        <span className={`event-card-chip event-card-chip--${event.calendarId}`}>
          {TYPE_LABELS[event.calendarId] ?? event.calendarId}
        </span>
        <div className="event-card-date-overlay">
          <span className="event-card-day">{day}</span>
          <span className="event-card-monthday">
            {month}
            <br />
            {weekday}
          </span>
        </div>
      </div>

      <div className="event-card-body">
        <h3>{event.title}</h3>
        <div className="event-card-meta">
          <span>🕐 {time}</span>
          {event.location && <span className="event-card-location">📍 {event.location}</span>}
        </div>
      </div>
    </article>
  );
}
