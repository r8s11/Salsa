import React from "react";
import { ScheduleXEvent } from "../../types/events";

const TYPE_LABELS: Record<string, string> = {
  social: "Social Dance",
  class: "Class",
  workshop: "Workshop",
};

export default function FeaturedEventCard({
  event,
  onSelect,
}: {
  event: ScheduleXEvent;
  onSelect: (event: ScheduleXEvent) => void;
}) {
  const startDate = new Date(event.start.replace(" ", "T"));

  const weekday = startDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const day = startDate.getDate().toString();
  const month = startDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
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

  return (
    <article
      className="featured-card"
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={handleKeyDown}
      aria-label={`Featured event: ${event.title} on ${weekday} ${month} ${day} at ${time}`}
    >
      <div
        className={`featured-card-media featured-card-media--${event.calendarId}`}
        style={event.imageUrl ? { backgroundImage: `url(${event.imageUrl})` } : undefined}
      >
        <div className="featured-card-date">
          <span>{weekday}</span>
          <strong>{day}</strong>
          <span>{month}</span>
        </div>
      </div>

      <div className="featured-card-body">
        <span className={`event-type ${event.calendarId}`}>
          {TYPE_LABELS[event.calendarId] ?? event.calendarId}
        </span>
        <h3>{event.title}</h3>
        <div className="featured-card-meta">
          <span>🕐 {time}</span>
          {event.location && <span>📍 {event.location}</span>}
        </div>
        {event.description && <p className="featured-card-description">{event.description}</p>}
        <span className="featured-card-link">View details →</span>
      </div>
    </article>
  );
}
