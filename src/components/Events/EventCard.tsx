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

  const imageUrl = resolveEventFlyer(event);
  const fallbackUrl = resolveEventFlyer({ ...event, imageUrl: undefined });
  const showRecentlyApproved = isRecentlyApproved({
    createdAt: event.createdAt,
    sourceType: event.sourceType,
  });

  // The card is an article with a real heading; the title's button is the one
  // control, and its ::after stretches over the whole card so any click on
  // it still opens the event.
  return (
    <article className="event-card">
      <div className={`event-card-thumb event-card-thumb--${event.calendarId}`}>
        <img
          className="event-card-image"
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={
            event.imageUrl
              ? (imageEvent) => {
                  imageEvent.currentTarget.onerror = null;
                  imageEvent.currentTarget.src = fallbackUrl;
                }
              : undefined
          }
        />
        <span className={`event-card-chip event-card-chip--${event.calendarId}`}>
          {TYPE_LABELS[event.calendarId] ?? event.calendarId}
        </span>
        {showRecentlyApproved && <span className="recently-approved-badge">Just approved</span>}
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
        <h3>
          <button type="button" className="event-card-open" onClick={openDetail}>
            {event.title}
          </button>
        </h3>
        <div className="event-card-meta">
          <span>
            <Clock size={13} aria-hidden="true" /> {time}
          </span>
          {event.location && (
            <span className="event-card-location">
              <MapPin size={13} aria-hidden="true" /> {event.location}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
