import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Clock3, ExternalLink, MapPin } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { fetchApprovedEventById } from "../features/events/api/eventsRepo";
import { databaseEventToScheduleX } from "../features/events/model/convert";
import { downloadIcs, googleCalendarUrl, mapsUrl } from "../utils/ics";
import { getUpcomingSeriesDates } from "../utils/series";
import NotFoundPage from "./NotFoundPage";
import "./EventDetailPage.css";

function formatDate(start: string): string {
  const [date] = start.split(" ");
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatTime(start: string): string {
  const [, time = "00:00"] = start.split(" ");
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
    new Date(2000, 0, 1, hour, minute)
  );
}

function formatSeriesDate(start: string): string {
  const [date, time] = start.split(" ");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(year, month - 1, day, hour, minute));
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    data: event,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["event", "approved", id],
    queryFn: () => fetchApprovedEventById(id!),
    enabled: Boolean(id),
  });

  if (isLoading)
    return (
      <main className="event-page event-page--status" role="status">
        Loading event…
      </main>
    );
  if (error) {
    return (
      <main className="event-page event-page--status" role="alert">
        We couldn&apos;t load this event. Please try again.
      </main>
    );
  }
  if (!event) return <NotFoundPage />;

  const scheduleEvent = databaseEventToScheduleX(event);
  const mapHref = mapsUrl(scheduleEvent);
  const calendarHref = googleCalendarUrl(scheduleEvent);
  const styles = event.taxonomy_terms.filter((term) => term.category === "dance_style");
  const attributes = event.taxonomy_terms.filter((term) => term.category === "event_attribute");
  const seriesDates =
    event.recurrence === "weekly" ? getUpcomingSeriesDates(scheduleEvent.start) : [];
  const price =
    event.price_type === "free"
      ? "Free"
      : event.price_type === "paid" && event.price_amount != null
        ? `$${event.price_amount}`
        : "Pricing unavailable";

  return (
    <main className="event-page">
      <header className="event-page__hero">
        {event.image_url ? (
          <img
            className="event-page__cover"
            src={event.image_url}
            alt={`${event.title} event flyer`}
          />
        ) : (
          <div className="event-page__cover event-page__cover--fallback" aria-hidden="true" />
        )}
        <div className="event-page__hero-overlay">
          <Link className="event-page__back" to="/calendar">
            ← The calendar
          </Link>
          <span className="event-page__badge">{event.event_type}</span>
          <h1>{event.title}</h1>
          <div className="event-page__hero-facts">
            <span>
              <Clock3 size={16} aria-hidden="true" /> {formatDate(scheduleEvent.start)} ·{" "}
              {formatTime(scheduleEvent.start)}
            </span>
            {event.location && (
              <span>
                <MapPin size={16} aria-hidden="true" /> {event.location}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="event-page__body">
        <section className="event-page__strip" aria-label="Event overview">
          <div>
            <strong>{price}</strong>
            {event.address && <span>{event.address}</span>}
          </div>
          <div className="event-page__actions">
            {event.rsvp_link && (
              <a
                className="event-page__primary"
                href={event.rsvp_link}
                target="_blank"
                rel="noopener noreferrer"
              >
                RSVP <ExternalLink size={15} aria-hidden="true" />
              </a>
            )}
            <button
              className="event-page__secondary"
              type="button"
              onClick={() => downloadIcs(scheduleEvent)}
            >
              <CalendarPlus size={16} aria-hidden="true" /> Add to calendar
            </button>
          </div>
        </section>

        <div className="event-page__columns">
          <article className="event-page__main">
            <section>
              <h2>About</h2>
              {event.description && <p className="event-page__description">{event.description}</p>}
              {(styles.length > 0 || attributes.length > 0) && (
                <div className="event-page__chips" aria-label="Event tags">
                  {styles.map((term) => (
                    <span className="event-page__chip" key={term.id}>
                      {term.name}
                    </span>
                  ))}
                  {attributes.map((term) => (
                    <span className="event-page__chip event-page__chip--attribute" key={term.id}>
                      {term.name}
                    </span>
                  ))}
                </div>
              )}
            </section>
            {event.gallery?.length ? (
              <section>
                <h2>Gallery</h2>
                <div className="event-page__gallery">
                  {event.gallery.map((url, index) => (
                    <img
                      key={url}
                      src={url}
                      alt={`${event.title} gallery image ${index + 1}`}
                      loading="lazy"
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </article>

          <aside className="event-page__details">
            <h2>Event details</h2>
            {(event.location || event.address) && (
              <div>
                <h3>Where</h3>
                {event.location && <strong>{event.location}</strong>}
                {event.address && <p>{event.address}</p>}
                {mapHref && (
                  <a href={mapHref} target="_blank" rel="noopener noreferrer">
                    Open map <ExternalLink size={14} aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
            <div>
              <h3>When</h3>
              <p>
                {formatDate(scheduleEvent.start)} at {formatTime(scheduleEvent.start)}
              </p>
              {seriesDates.length > 0 && (
                <p>
                  Repeats weekly:{" "}
                  {seriesDates
                    .map((date) => formatSeriesDate(date.toString().replace("T", " ")))
                    .join(" · ")}
                </p>
              )}
            </div>
            <div>
              <h3>Price</h3>
              <p>{price}</p>
            </div>
            {event.host && (
              <div>
                <h3>Hosted by</h3>
                <p>{event.host}</p>
              </div>
            )}
            {(event.contact_email || event.contact_instagram || event.contact_website) && (
              <div>
                <h3>Contact</h3>
                {event.contact_email && (
                  <a href={`mailto:${event.contact_email}`}>{event.contact_email}</a>
                )}
                {event.contact_instagram && (
                  <a
                    href={`https://instagram.com/${event.contact_instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @{event.contact_instagram.replace(/^@/, "")}
                  </a>
                )}
                {event.contact_website && (
                  <a href={event.contact_website} target="_blank" rel="noopener noreferrer">
                    Visit website <ExternalLink size={14} aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
            {calendarHref && (
              <a
                className="event-page__calendar-link"
                href={calendarHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Google Calendar <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
