// Purpose: Display the home page event feed — a featured event plus a
// filterable grid of the rest of this week's floor.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Events.css";
import { useEvents } from "../../hooks/useEvent";
import EventCard from "./EventCard";
import FeaturedEventCard from "./FeaturedEventCard";
import { filterEventsByType, TypeFilter } from "../../utils/filterEvents";

const FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "social", label: "Social" },
  { value: "class", label: "Class" },
  { value: "workshop", label: "Workshop" },
];

function Events() {
  const { events: allEvents, loading, error } = useEvents();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return allEvents
      .filter((event) => new Date(event.start.replace(" ", "T")) >= now)
      .sort(
        (a, b) =>
          new Date(a.start.replace(" ", "T")).getTime() -
          new Date(b.start.replace(" ", "T")).getTime()
      );
  }, [allEvents]);

  const featuredEvent = upcomingEvents[0] ?? null;
  const feedSource = featuredEvent ? upcomingEvents.slice(1) : upcomingEvents;
  const feedEvents = useMemo(
    () => filterEventsByType(feedSource, typeFilter).slice(0, 6),
    [feedSource, typeFilter]
  );
  const activeFilterLabel =
    FILTER_OPTIONS.find((o) => o.value === typeFilter)?.label.toLowerCase() ?? "";

  if (loading) {
    return (
      <section id="events" className="events">
        <div className="container">
          <div className="events-feed-header">
            <h2 className="events-feed-title">This Week&apos;s Floor</h2>
          </div>
          <div className="events-grid events-skeleton" aria-live="polite" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="event-card skeleton" aria-hidden />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="events" className="events">
        <div className="container">
          <div className="events-feed-header">
            <h2 className="events-feed-title">This Week&apos;s Floor</h2>
          </div>
          <div className="events-error">
            <p>Failed to load events: {error}</p>
            <button onClick={() => window.location.reload()}>Try again</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="events" className="events">
      <div className="container">
        {featuredEvent && (
          <div className="events-featured-wrap">
            <h2 className="events-eyebrow">◆ Featured Tonight</h2>
            <FeaturedEventCard event={featuredEvent} />
          </div>
        )}

        <div className="events-feed-header">
          <h2 className="events-feed-title">This Week&apos;s Floor</h2>
          <div className="feed-filters" role="group" aria-label="Filter by event type">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`feed-filter ${typeFilter === opt.value ? "feed-filter-active" : ""}`}
                aria-pressed={typeFilter === opt.value}
                onClick={() => setTypeFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="no-events">
            <p>
              No upcoming events scheduled. Check back soon, or follow @SalsaSegura on Instagram
              for updates!
            </p>
          </div>
        ) : feedEvents.length > 0 ? (
          <div className="events-grid">
            {feedEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="no-events">
            <p>No additional {activeFilterLabel} events this week. Try another filter.</p>
          </div>
        )}

        <div className="events-footer">
          <Link to="/calendar" className="btn-secondary">
            View Full Calendar
          </Link>
          <div className="events-cta">
            <p>Want to host a pop-up class or private event?</p>
            <Link to="/submit" className="btn-primary">
              Submit an Event
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Events;
