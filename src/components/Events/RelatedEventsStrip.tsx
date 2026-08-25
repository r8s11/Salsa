import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { City, DatabaseEvent } from "../../features/events/model/types";
import "./RelatedEventsStrip.css";

const CITY_LABELS: Record<City, string> = {
  boston: "Greater Boston",
  "new-york-city": "New York City",
};

const MAX_EVENTS = 3;

interface RelatedEventsStripProps {
  events: readonly DatabaseEvent[];
  city: City;
  hasStrictWindowEvents: boolean;
}

export function RelatedEventsStrip({ events, city, hasStrictWindowEvents }: RelatedEventsStripProps) {
  const headingId = "related-events-heading";
  const cityLabel = CITY_LABELS[city];

  const cards = useMemo(() => {
    const dateFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
    const dayFormatter = new Intl.DateTimeFormat("en-US", { day: "numeric" });
    const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
    const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

    return events.slice(0, MAX_EVENTS).map((event) => {
      const date = new Date(event.event_date);
      const valid = !Number.isNaN(date.getTime());
      return {
        event,
        weekday: valid ? dateFormatter.format(date) : "",
        day: valid ? dayFormatter.format(date) : "",
        month: valid ? monthFormatter.format(date) : "",
        time: valid && event.event_time ? timeFormatter.format(date) : null,
      };
    });
  }, [events]);

  if (events.length === 0) return null;

  const heading = hasStrictWindowEvents
    ? `More this week in ${cityLabel}`
    : `More in ${cityLabel}`;

  return (
    <section className="related-events-strip" aria-labelledby={headingId}>
      <h2 id={headingId} className="related-events-strip__heading">
        {heading}
      </h2>
      <ul className="related-events-strip__list">
        {cards.map(({ event, weekday, day, month, time }) => (
          <li key={event.id} className="related-events-strip__item">
            <Link
              to={`/events/${event.id}`}
              className={`related-events-strip__card related-events-strip__card--${event.event_type}`}
            >
              <span className={`related-events-strip__badge related-events-strip__badge--${event.event_type}`} aria-hidden="true">
                <span className="related-events-strip__badge-weekday">{weekday}</span>
                <span className="related-events-strip__badge-day">{day}</span>
                <span className="related-events-strip__badge-month">{month}</span>
              </span>
              <span className="related-events-strip__body">
                <span className="related-events-strip__title">{event.title}</span>
                {time && <time className="related-events-strip__time">{time}</time>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
