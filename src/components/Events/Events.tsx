import { useMemo } from "react";
import fm from "front-matter";
import { marked } from "marked";
import "./Events.css";
import "../../lib/supabase"
import { useEvents } from "../../hooks/useEvent";
import { useSupabaseEvents } from "../../hooks/useSupabaseEvents"



interface DanceEvent {
  id: string;
  title: string;
  type: string;
  month: string;
  day: string;
  time: string;
  location: string;
  address: string;
  description: string;
  rsvpLink: string;
  date: Date;
}

interface EventFrontmatter {
  title: string;
  type: string;
  date: string | Date;
  time: string;
  location: string;
  address: string;
  rsvpLink: string;
}

function Events() {
  const upcomingEvents = useMemo(() => {
    // Import all markdown files from the content/events directory
    const eventFiles = import.meta.glob("../content/events/*.md", {
      query: "?raw",
      eager: true,
      import: "default",
    });
const {events, loading , error} = useSupabaseEvents()
    const eventsList: DanceEvent[] = [];

    // Helper to format date
    const getMonthName = (d: Date) =>
      d.toLocaleString("default", { month: "short" }).toUpperCase();
    const getDayNumber = (d: Date) => d.getDate().toString();

    for (const path in eventFiles) {
      const rawContent = eventFiles[path] as string;
      const { attributes, body } = fm<EventFrontmatter>(rawContent);

      const eventDate = new Date(attributes.date);

      // Render markdown body to HTML
      const htmlDescription = marked.parse(body);

      eventsList.push({
        id: path,
        title: attributes.title,
        type: attributes.type,
        month: getMonthName(eventDate),
        day: getDayNumber(eventDate),
        time: attributes.time,
        location: attributes.location,
        address: attributes.address,
        description: htmlDescription as string,
        rsvpLink: attributes.rsvpLink,
        date: eventDate,
      });
    }

    // Sort by date (asc)
    eventsList.sort((a, b) => a.date.getTime() - b.date.getTime());

    return eventsList;
  }, []);

  return (
    <section id="events" className="events">
      <div className="container">
        <h2 className="section-title">Upcoming Events</h2>
        <p className="events-intro">
          Join us for pop-up salsa classes and social dance events around
          Boston!
        </p>

        <div className="events-grid">
          {upcomingEvents.map((event) => (
            <div key={event.id} className="event-card">
              <div className="event-date">
                <span className="event-month">{event.month}</span>
                <span className="event-day">{event.day}</span>
              </div>
              <div className="event-details">
                <span className="event-type">{event.type}</span>
                <h3>{event.title}</h3>
                <p className="event-location">🏙️ {event.location}</p>
                <p className="event-time">🕐 {event.time}</p>
                {event.address && (
                  <p className="event-address">
                    📍
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        event.address
                      )}`}
                      target="_blank"
                      rel="noopener"
                      aria-label={`Open ${event.address} in Maps`}
                      className="event-address-link"
                    >
                      {event.address}
                    </a>
                  </p>
                )}
                <div
                  className="event-description"
                  dangerouslySetInnerHTML={{ __html: event.description }}
                />
                {event.rsvpLink && (
                  <a
                    href={event.rsvpLink}
                    className="rsvp-button"
                    aria-label={`RSVP for ${event.title}`}
                  >
                    RSVP Now
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {upcomingEvents.length === 0 && (
          <div className="no-events">
            <p>
              No upcoming events scheduled. Check back soon or follow us on
              Instagram for updates!
            </p>
          </div>
        )}

        <div className="events-cta">
          <p>Want to host a pop-up class or private event?</p>
          <a href="#contact" className="cta-button">
            Get in Touch
          </a>
        </div>
      </div>
    </section>
  );
}

export default Events;
