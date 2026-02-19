// Purpose: Display event cards on the homepage
import { useMemo } from "react";
import { Link } from "react-router-dom";
import "./Events.css";
import { useEvents } from "../../hooks/useEvent";
import EventCard from "./EventCard";

function Events() {
  const { events: allEvents, loading, error } = useEvents();

  // Only show future events, limit to 6
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return allEvents.filter((event) => new Date(event.start.replace(" ", "T")) >= now).slice(0, 6);
  }, [allEvents]);

  if (loading) {
    return (
      <section id="events" className="events">
        <div className="container">
          <h2 className="section-title">Upcoming Events</h2>
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
          <h2 className="section-title">Upcoming Events</h2>
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
        <h2 className="section-title">Upcoming Events</h2>
        <p className="events-intro">
          Join us for pop-up salsa classes and social dance events around Boston!
        </p>

        {upcomingEvents.length > 0 ? (
          <div className="events-grid">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="no-events">
            <p>
              No upcoming events scheduled. Check back soon or follow us on Instagram for updates!
            </p>
          </div>
        )}

        <div className="events-footer">
          <Link to="/calendar" className="cta-button cta-secondary">
            View Full Calendar
          </Link>
          <div className="events-cta">
            <p>Want to host a pop-up class or private event?</p>
            <Link to="/submit" className="cta-button">
              Submit an Event
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Events;
