import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Clock3, ExternalLink, MapPin } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { RelatedEventsStrip } from "../components/Events/RelatedEventsStrip";
import { fetchApprovedEventById, fetchApprovedEvents } from "../features/events/api/eventsRepo";
import { databaseEventToScheduleX } from "../features/events/model/convert";
import { selectRelatedEvents } from "../features/events/model/relatedEvents";
import type { EventType } from "../features/events/model/types";
import { downloadIcs, mapsUrl } from "../utils/ics";
import NotFoundPage from "./NotFoundPage";
import "./EventDetailPage.css";

const TYPE_LABELS: Record<EventType, string> = {
  social: "Social",
  class: "Class",
  workshop: "Workshop",
};

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

function chipParts(start: string): { weekday: string; day: string; month: string } {
  const [date] = start.split(" ");
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(parsed).toUpperCase(),
    day: String(day),
    month: new Intl.DateTimeFormat("en-US", { month: "short" }).format(parsed).toUpperCase(),
  };
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

  const relatedEventsQuery = useQuery({
    queryKey: ["events", "approved", event?.city],
    queryFn: () => fetchApprovedEvents(event!.city),
    enabled: Boolean(event?.city),
  });

  const [tab, setTab] = useState<"about" | "album">("about");
  const [copied, setCopied] = useState(false);

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
  const relatedSelection = relatedEventsQuery.data
    ? selectRelatedEvents(event, relatedEventsQuery.data)
    : { events: [], hasStrictWindowEvents: false };

  const mapHref = mapsUrl(scheduleEvent);
  const styles = event.taxonomy_terms.filter((term) => term.category === "dance_style");
  const attributes = event.taxonomy_terms.filter((term) => term.category === "event_attribute");
  const price =
    event.price_type === "free"
      ? "Free"
      : event.price_type === "paid" && event.price_amount != null
        ? `$${event.price_amount}`
        : "Pricing unavailable";
  const { weekday, day, month } = chipParts(scheduleEvent.start);
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${event.title} — ${shareUrl}`)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — nothing to do.
    }
  };

  const handleInstagramShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text: event.title, url: shareUrl });
      } catch {
        // Share sheet dismissed — nothing to do.
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <main className="event-page">
      <div className="event-page__cover">
        {event.image_url ? (
          <img className="event-page__cover-img" src={event.image_url} alt="" />
        ) : null}
        <div className="event-page__cover-art" />
        <div className="event-page__cover-bar">
          <Link to="/calendar" className="event-page__back">
            ← The calendar
          </Link>
        </div>
        <div className="event-page__cover-body">
          <span className="event-page__badge">{TYPE_LABELS[event.event_type]}</span>
          <h1 className="event-page__title">{event.title}</h1>
          <div className="event-page__facts">
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
      </div>

      <div className="event-page__body">
        <div className="event-page__strip">
          <div className="event-page__datechip">
            <span className="event-page__datechip-weekday">{weekday}</span>
            <span className="event-page__datechip-day">{day}</span>
            <span className="event-page__datechip-month">{month}</span>
          </div>
          <div className="event-page__strip-body">
            <div className="event-page__strip-price">{price}</div>
            {event.address && <div className="event-page__muted">{event.address}</div>}
          </div>
          <div className="event-page__strip-actions">
            {event.rsvp_link && (
              <a
                className="event-page__btn event-page__btn--primary"
                href={event.rsvp_link}
                target="_blank"
                rel="noopener noreferrer"
              >
                RSVP <ExternalLink size={15} aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              className="event-page__btn event-page__btn--ghost"
              onClick={() => downloadIcs(scheduleEvent)}
            >
              <CalendarPlus size={16} aria-hidden="true" /> Add to calendar
            </button>
          </div>
        </div>

        <nav className="event-page__tabs" aria-label="Sections">
          <button
            type="button"
            role="tab"
            className="event-page__tab"
            aria-selected={tab === "about"}
            onClick={() => setTab("about")}
          >
            About the night
          </button>
          <button
            type="button"
            role="tab"
            className="event-page__tab"
            aria-selected={tab === "album"}
            onClick={() => setTab("album")}
          >
            Photo album
            {event.gallery?.length ? (
              <span className="event-page__tab-count">{event.gallery.length}</span>
            ) : null}
          </button>
        </nav>

        {tab === "about" ? (
          <div className="event-page__columns">
            <div className="event-page__main">
              <section>
                <h2 className="event-page__h2">About the night</h2>
                {event.description && <p className="event-page__desc">{event.description}</p>}
                {styles.length > 0 && (
                  <div className="event-page__chips event-page__styles">
                    {styles.map((term) => (
                      <span className="event-page__badge event-page__badge--chip" key={term.id}>
                        {term.name}
                      </span>
                    ))}
                  </div>
                )}
                {attributes.length > 0 && (
                  <div className="event-page__chips event-page__tags">
                    {attributes.map((term) => (
                      <span className="event-page__badge event-page__badge--warn" key={term.id}>
                        {term.name}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="event-page__aside">
              {event.host && (
                <div className="event-page__card event-page__hostcard">
                  <div className="event-page__aside-label">Hosted by</div>
                  <div className="event-page__host">
                    <span className="event-page__avatar event-page__host-avatar">
                      {event.host.charAt(0)}
                    </span>
                    <span className="event-page__host-name">{event.host}</span>
                  </div>
                </div>
              )}

              {(event.location || event.address) && (
                <div className="event-page__card">
                  <div className="event-page__aside-label">Where</div>
                  {event.location && <div className="event-page__venue">{event.location}</div>}
                  {event.address && <div className="event-page__muted">{event.address}</div>}
                  {mapHref && (
                    <a
                      className="event-page__map-link"
                      href={mapHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open map <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  )}
                </div>
              )}

              <div className="event-page__card">
                <div className="event-page__aside-label">Share this night</div>
                <div className="event-page__share">
                  <button
                    type="button"
                    className="event-page__btn event-page__btn--ghost event-page__btn--sm"
                    onClick={handleCopyLink}
                  >
                    {copied ? "Copied" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    className="event-page__btn event-page__btn--ghost event-page__btn--sm"
                    onClick={handleInstagramShare}
                  >
                    Instagram
                  </button>
                  <a
                    className="event-page__btn event-page__btn--ghost event-page__btn--sm"
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <section className="event-page__album">
            <div className="event-page__album-head">
              <h2 className="event-page__album-title">Photo album</h2>
            </div>
            {event.gallery?.length ? (
              <div className="event-page__gallery">
                {event.gallery.map((url, index) => (
                  <img
                    key={url}
                    className="event-page__shot"
                    src={url}
                    alt={`${event.title} gallery image ${index + 1}`}
                    loading="lazy"
                  />
                ))}
              </div>
            ) : (
              <p className="event-page__muted">No photos yet.</p>
            )}
          </section>
        )}

        <RelatedEventsStrip
          events={relatedSelection.events}
          city={event.city}
          hasStrictWindowEvents={relatedSelection.hasStrictWindowEvents}
        />
      </div>
    </main>
  );
}
