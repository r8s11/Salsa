import React from "react";
import { ScheduleXEvent } from "../../types/events";
import { useNavigate } from "react-router-dom";

export default function EventCard({ event }: { event: ScheduleXEvent }) {
  const navigate = useNavigate();
  const startDate = new Date(event.start.replace(" ", "T"));

  const month = startDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = startDate.getDate().toString();
  const weekday = startDate.toLocaleDateString("en-US", { weekday: "short" });
  const time = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // Badge colors per event type
  const typeLabels: Record<string, string> = {
    social: "Social Dance",
    class: "Class",
    workshop: "Workshop",
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on links
    if ((e.target as HTMLElement).tagName === "A") return;
    navigate(`/calendar?event=${event.id}`);
  };

  return (
    <article className="event-card" onClick={handleCardClick} role="button" tabIndex={0}>
      <div className="event-date">
        <span className="event-weekday">{weekday}</span>
        <span className="event-day">{day}</span>
        <span className="event-month">{month}</span>
      </div>

      <div className="event-details">
        <div className="event-details-top">
          <span className={`event-type ${event.calendarId}`}>
            {typeLabels[event.calendarId] ?? event.calendarId}
          </span>
          <span className="event-time">🕐 {time}</span>
        </div>

        <h3>{event.title}</h3>

        {event.location && <p className="event-location">📍 {event.location}</p>}

        {event.description && (
          <p className="event-description">
            {event.description.length > 80
              ? `${event.description.slice(0, 80)}…`
              : event.description}
          </p>
        )}

        <div className="event-card-footer">
          <button className="details-button">View Details</button>
          {event.rsvpLink && (
            <a
              href={event.rsvpLink}
              className="rsvp-button"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`RSVP for ${event.title}`}
              onClick={(e) => e.stopPropagation()}
            >
              RSVP
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
