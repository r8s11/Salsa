import { ArrowUpRight, Clock, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { entityHref } from "../../entities/model";
import EventEntityLinks from "./EventEntityLinks";
import type { ScheduleXEvent } from "../../../types/events";
import { isRecentlyApproved } from "../model/recentlyApproved";
import { eventTypeCardLabel, scheduleXEventTypes } from "../model/eventTypeDisplay";
import { resolveEventFlyer } from "./event-modal/eventModalImage";
import "./Events.css";

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
        <span className="event-type-list">
          {scheduleXEventTypes(event).map((type) => (
            <span key={type} className={`event-type ${type}`}>
              {eventTypeCardLabel(type)}
            </span>
          ))}
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
              <MapPin size={14} aria-hidden="true" />{" "}
              {event.publicEntities?.venue
                ? <Link className="event-card-entity" to={entityHref(event.publicEntities.venue)}>{event.publicEntities.venue.name}</Link>
                : event.location}
            </span>
          )}
        </div>
        <EventEntityLinks entities={event.publicEntities} omit={["venue"]} />
        {event.description && <p className="featured-card-description">{event.description}</p>}
        <span className="featured-card-link" aria-hidden="true">
          <span>View details</span>
          <span className="featured-card-arrow"><ArrowUpRight size={24} strokeWidth={1.75} /></span>
        </span>
      </div>
    </article>
  );
}
