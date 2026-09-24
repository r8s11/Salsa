import { Clock, MapPin } from "lucide-react";
import type { ScheduleXEvent } from "../../types/events";
import { isRecentlyApproved } from "../../features/events/model/recentlyApproved";
import { resolveEventFlyer } from "../EventModal/eventModalImage";
import "./Events.css";

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

  const imageUrl = resolveEventFlyer(event);
  const showRecentlyApproved = isRecentlyApproved({
    createdAt: event.createdAt,
    sourceType: event.sourceType,
  });

  return (
    <article className="featured-card">
      <div
        className={`featured-card-media featured-card-media--${event.calendarId}`}
        style={{ backgroundImage: `url(${imageUrl})` }}
      >
        {showRecentlyApproved && <span className="recently-approved-badge">Just approved</span>}
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
        <h3>
          <button type="button" className="event-card-open" onClick={openDetail}>
            {event.title}
          </button>
        </h3>
        <div className="featured-card-meta">
          <span>
            <Clock size={14} aria-hidden="true" /> {time}
          </span>
          {event.location && (
            <span>
              <MapPin size={14} aria-hidden="true" /> {event.location}
            </span>
          )}
        </div>
        {event.description && <p className="featured-card-description">{event.description}</p>}
        <span className="featured-card-link" aria-hidden="true">
          View details →
        </span>
      </div>
    </article>
  );
}
