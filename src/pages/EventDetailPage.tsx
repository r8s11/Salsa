import { useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarPlus,
  Clock3,
  ExternalLink,
  LinkIcon,
  MapPin,
  MessageCircle,
  Share2,
  Users,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { RelatedEventsStrip } from "../components/Events/RelatedEventsStrip";
import { fetchApprovedEventById, fetchApprovedEvents } from "../features/events/api/eventsRepo";
import InstagramStoryShare from "../features/events/components/InstagramStoryShare";
import VenueMapCard from "../features/events/components/VenueMapCard";
import { databaseEventToScheduleX } from "../features/events/model/convert";
import { selectRelatedEvents } from "../features/events/model/relatedEvents";
import type { City, EventType } from "../features/events/model/types";
import {
  buildNativeSharePayload,
  buildPublicEventUrl,
} from "../features/events/model/eventSharing";
import { downloadIcs, mapsUrl } from "../utils/ics";
import { resolveEventModalImage } from "../components/EventModal/eventModalImage";
import Button from "../components/ui/Button";
import ButtonLink from "../components/ui/ButtonLink";
import NotFoundPage from "./NotFoundPage";
import "./EventDetailPage.css";

const TYPE_LABELS: Record<EventType, string> = {
  social: "Social",
  class: "Class",
  workshop: "Workshop",
};

// Public-surface city labels, matching RelatedEventsStrip on this same page.
const CITY_LABELS: Record<City, string> = {
  boston: "Greater Boston",
  "new-york-city": "New York City",
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

  const tabListId = useId();
  const aboutTabId = `${tabListId}-tab-about`;
  const albumTabId = `${tabListId}-tab-album`;
  const aboutPanelId = `${tabListId}-panel-about`;
  const albumPanelId = `${tabListId}-panel-album`;

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [tab, setTab] = useState<"about" | "album">("about");

  const focusTab = (index: number) => {
    const tabs: Array<"about" | "album"> = ["about", "album"];
    const next = ((index % tabs.length) + tabs.length) % tabs.length;
    tabRefs.current[next]?.focus();
    setTab(tabs[next]);
  };
  const [copied, setCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<{
    kind: "status" | "error";
    message: string;
  } | null>(null);

  if (isLoading)
    return (
      <div className="event-page event-page--status" role="status">
        Loading event…
      </div>
    );
  if (error) {
    return (
      <div className="event-page event-page--status" role="alert">
        We couldn&apos;t load this event. Please try again.
      </div>
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
  const shareUrl = buildPublicEventUrl(event.id);
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${event.title} — ${shareUrl}`)}`;

  const handleCopyLink = async (
    successMessage = "Event link copied.",
    failureMessage = "Could not copy event link."
  ) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setShareFeedback({ kind: "status", message: successMessage });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareFeedback({ kind: "error", message: failureMessage });
    }
  };

  const handleShare = async () => {
    setShareFeedback(null);
    if (!navigator.share) {
      await handleCopyLink("Event link copied. Paste it into Instagram.");
      return;
    }

    try {
      await navigator.share(
        buildNativeSharePayload({
          title: event.title,
          location: event.location,
          publicUrl: shareUrl,
        })
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await handleCopyLink(
        "Couldn't open sharing. Event link copied. Paste it into Instagram.",
        "Couldn't share or copy the event link."
      );
    }
  };

  return (
    <div className="event-page">
      <div className="event-page__cover">
        <img className="event-page__cover-img" src={resolveEventModalImage(scheduleEvent)} alt="" />
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
            {event.host && (
              <span>
                <Users size={16} aria-hidden="true" /> {event.host}
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
              <ButtonLink href={event.rsvp_link} external>
                RSVP <ExternalLink size={15} aria-hidden="true" />
              </ButtonLink>
            )}
            <Button variant="ghost" onClick={() => downloadIcs(scheduleEvent)}>
              <CalendarPlus size={16} aria-hidden="true" /> Add to calendar
            </Button>
          </div>
        </div>

        <nav
          className="event-page__tabs"
          aria-label="Sections"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            id={aboutTabId}
            aria-controls={aboutPanelId}
            aria-selected={tab === "about"}
            tabIndex={tab === "about" ? 0 : -1}
            className="event-page__tab"
            ref={(el) => { tabRefs.current[0] = el; }}
            onClick={() => setTab("about")}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); focusTab(1); }
              else if (e.key === "ArrowLeft") { e.preventDefault(); focusTab(1); }
              else if (e.key === "Home") { e.preventDefault(); focusTab(0); }
              else if (e.key === "End") { e.preventDefault(); focusTab(1); }
            }}
          >
            About the night
          </button>
          <button
            type="button"
            role="tab"
            id={albumTabId}
            aria-controls={albumPanelId}
            aria-selected={tab === "album"}
            tabIndex={tab === "album" ? 0 : -1}
            className="event-page__tab"
            ref={(el) => { tabRefs.current[1] = el; }}
            onClick={() => setTab("album")}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); focusTab(0); }
              else if (e.key === "ArrowLeft") { e.preventDefault(); focusTab(0); }
              else if (e.key === "Home") { e.preventDefault(); focusTab(0); }
              else if (e.key === "End") { e.preventDefault(); focusTab(1); }
            }}
          >
            Photo album
            {event.gallery?.length ? (
              <span className="event-page__tab-count">{event.gallery.length}</span>
            ) : null}
          </button>
        </nav>

        {tab === "about" ? (
          <div
            id={aboutPanelId}
            role="tabpanel"
            aria-labelledby={aboutTabId}
            className="event-page__columns"
          >
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

              <VenueMapCard
                venueName={event.location}
                streetAddress={event.address}
                cityLabel={CITY_LABELS[event.city]}
                directionsHref={mapHref}
              />

              <div className="event-page__card">
                <div className="event-page__aside-label">Share this night</div>
                <div className="event-page__share">
                  <Button variant="ghost" size="compact" onClick={() => void handleCopyLink()}>
                    <LinkIcon size={14} aria-hidden="true" /> {copied ? "Copied" : "Copy link"}
                  </Button>
                  <Button variant="ghost" size="compact" onClick={handleShare}>
                    <Share2 size={14} aria-hidden="true" /> Share
                  </Button>
                  <ButtonLink href={whatsappHref} external variant="ghost" size="compact">
                    <MessageCircle size={14} aria-hidden="true" /> WhatsApp
                  </ButtonLink>
                </div>
                <InstagramStoryShare
                  event={scheduleEvent}
                  flyerUrl={event.image_url}
                  cachedFlyerUrl={event.poster_image_url ?? null}
                  shareUrl={shareUrl}
                />
                {shareFeedback && (
                  <p role={shareFeedback.kind === "error" ? "alert" : "status"}>
                    {shareFeedback.message}
                  </p>
                )}
              </div>
            </aside>
          </div>
        ) : (
          <section
            id={albumPanelId}
            role="tabpanel"
            aria-labelledby={albumTabId}
            className="event-page__album"
          >
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
    </div>
  );
}
