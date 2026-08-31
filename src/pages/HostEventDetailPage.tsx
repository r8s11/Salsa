import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  ExternalLink,
  Users,
  QrCode,
  Mail,
  AtSign,
  Globe,
  Info,
} from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { useMySubmissions } from "../hooks/useMySubmissions";
import { useMyOrganizerEvents } from "../features/host/hooks/useMyOrganizerEvents";
import { useMyOrganizers } from "../features/host/hooks/useMyOrganizers";
import { deriveHostEventRows } from "../features/host/model/hostEvents";
import type { DatabaseEvent } from "../features/events/model/types";
import { fromEventDateInstant, formatTimeLabel } from "../features/events/model/eventDateTime";
import AdminStatusBadge from "../components/Admin/AdminStatusBadge";
import SalsaSeguraFallbackImage from "../components/brand/SalsaSeguraFallbackImage";
import { getFallbackTemplate } from "../utils/eventFallbacks";
import EventShareControls from "../features/events/components/EventShareControls";
import { useEventAttendees } from "../features/host/hooks/useEventAttendees";
import { useEventCheckIns } from "../features/host/hooks/useEventCheckIns";
import "./HostEventDetailPage.css";

/* ── Formatting helpers ── */

function formatPrice(event: DatabaseEvent): string {
  if (event.price_type === "free") return "Free";
  if (event.price_type === "paid" && event.price_amount != null) return `$${event.price_amount}`;
  return "Pricing unavailable";
}

function formatEventType(eventType: string): string {
  return eventType.charAt(0).toUpperCase() + eventType.slice(1);
}

function formatCity(city: string): string {
  return city
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatLegacyDanceStyle(style: string): string {
  return style
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAddressLines(event: DatabaseEvent): { venue: string | null; street: string | null } {
  // address may contain "Street, City" or just the street
  const addr = event.address;
  return { venue: event.location ?? null, street: addr ?? null };
}

function formatHostName(host: string | null): string | null {
  return host && host.trim() ? host.trim() : null;
}

/* ── Status copy ── */

const STATUS_MESSAGE: Partial<Record<DatabaseEvent["status"], string>> = {
  draft: "Saved as a draft. It stays private until you publish it.",
  pending: "Awaiting review. You can update or withdraw this submission.",
  rejected: "This submission was not approved. You can revise it.",
  approved: "Published on SalsaSegura. You can view and share the public event.",
};

/* ── Component ── */

export default function HostEventDetailPage() {
  const { user } = useAuth();
  const { eventId } = useParams<{ eventId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { submissions, approvedEvents, isLoading, error, refetch } = useMySubmissions(user?.id);
  const organizerEvents = useMyOrganizerEvents();
  const { data: organizers = [] } = useMyOrganizers();
  const { attendees } = useEventAttendees(eventId);
  const { checkIns } = useEventCheckIns(eventId);
  const flyerWarning =
    typeof location.state === "object" &&
    location.state !== null &&
    "flyerWarning" in location.state &&
    typeof location.state.flyerWarning === "string"
      ? location.state.flyerWarning
      : null;

  // Merge all owned events into one list (submission + approved + organizer-created)
  const owned = useMemo(() => {
    const byId = new Map(
      [...submissions, ...approvedEvents, ...organizerEvents.events].map(
        (candidate) => [candidate.id, candidate] as const
      )
    );
    return [...byId.values()];
  }, [submissions, approvedEvents, organizerEvents.events]);

  const event = owned.find((candidate) => candidate.id === eventId) ?? null;

  useEffect(() => {
    if (!isLoading && !organizerEvents.isLoading && !error && eventId && !event) {
      navigate("/host/events");
    }
  }, [isLoading, organizerEvents.isLoading, error, eventId, event, navigate]);

  /* ── Loading / Error / Not-found ── */

  if (isLoading || organizerEvents.isLoading) {
    return (
      <main className="host-event-detail">
        <p role="status" className="host-event-detail__status">
          Loading event…
        </p>
      </main>
    );
  }

  if (error || organizerEvents.error) {
    return (
      <main className="host-event-detail">
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn&apos;t load this event.</p>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={refetch}>
            Try Again
          </button>
        </div>
      </main>
    );
  }

  if (!event) return null;

  /* ── Derived data ── */

  const membership = organizers.find((o) => o.organizerId === event.organizer_id);
  const canEdit = membership && (membership.memberRole === "owner" || membership.memberRole === "manager");
  const isEditor = membership && membership.memberRole === "editor";
  const organizer = organizers.find((o) => o.organizerId === event.organizer_id);

  const [row] = deriveHostEventRows([event]);
  const taxonomyDanceStyles = event.taxonomy_terms.filter((term) => term.category === "dance_style");
  const danceStyles =
    taxonomyDanceStyles.length > 0
      ? taxonomyDanceStyles
      : (event.dance_styles ?? []).filter(Boolean).map((style) => ({
          id: `legacy-${style}`,
          name: formatLegacyDanceStyle(style),
        }));
  const price = formatPrice(event);

  // Date/time
  let dateDisplay = "Date unavailable";
  let timeDisplay = "Time unavailable";
  try {
    const { date, time } = fromEventDateInstant(event.event_date);
    const [year, month, day] = date.split("-").map(Number);
    dateDisplay = new Date(year, month - 1, day).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (time) timeDisplay = formatTimeLabel(time);
  } catch {
    // invalid event_date — keep fallback labels
  }

  const { venue, street } = formatAddressLines(event);
  const hostName = formatHostName(event.host);
  const isPublic = event.status === "approved";
  const isCancelled = event.status === "cancelled";

  return (
    <main className="host-event-detail">
      {/* ── Back link ── */}
      <Link to="/host/events" className="host-event-detail__back">
        <ArrowLeft size={16} aria-hidden="true" />
        My Events
      </Link>

      {/* ── Header ── */}
      <header className="host-event-detail__header">
        <div className="host-event-detail__title-row">
          <AdminStatusBadge status={event.status} />
        </div>
        <h1 className="host-event-detail__event-title">{event.title}</h1>
        <p className="host-event-detail__meta">
          <Calendar size={14} aria-hidden="true" />
          {dateDisplay}
          {event.location && (
            <>
              <span className="host-event-detail__meta-sep">·</span>
              <MapPin size={14} aria-hidden="true" />
              {event.location}
            </>
          )}
        </p>

        {/* Organizer context */}
        {organizer && (
          <div className="host-event-detail__organizer-context">
            <span className="host-event-detail__organizer-label">Organizer</span>
            <span className="host-event-detail__organizer-name">{organizer.organizerName}</span>
          </div>
        )}
      </header>

      {/* ── Status message ── */}
      {STATUS_MESSAGE[event.status] && (
        <div className={`host-event-detail__status-banner host-event-detail__status-banner--${event.status}`}>
          <Info size={16} aria-hidden="true" />
          <p>{STATUS_MESSAGE[event.status]}</p>
        </div>
      )}

      {flyerWarning && (
        <div className="admin-banner admin-banner--error" role="status">
          <p>{flyerWarning}</p>
        </div>
      )}

      {isCancelled && event.cancellation_reason && (
        <div className="host-event-detail__status-banner host-event-detail__status-banner--cancelled">
          <p><strong>Cancellation reason:</strong> {event.cancellation_reason}</p>
        </div>
      )}

      {/* ── Primary actions ── */}
      <div className="host-event-detail__actions">
        {canEdit && (
          <Link className="admin-btn admin-btn--primary" to={`/host/events/${event.id}/edit`}>
            Edit Event
          </Link>
        )}
        {isEditor && (
          <span className="host-event-detail__view-only">View only</span>
        )}
        {event.status === "pending" && !canEdit && !membership && (
          <Link className="admin-btn admin-btn--primary" to={`/profile/edit/${event.id}`}>
            Edit event
          </Link>
        )}
        {event.status === "rejected" && !canEdit && !membership && (
          <Link className="admin-btn admin-btn--primary" to={`/profile/edit/${event.id}`}>
            Revise event
          </Link>
        )}
      </div>

      {/* ── Share (approved events) ── */}
      {isPublic && (
        <section className="admin-card host-event-detail__share">
          <EventShareControls
            eventId={event.id}
            title={event.title}
            dateLabel={row.dateLabel}
            location={event.location}
          />
        </section>
      )}

      {/* ── Main grid ── */}
      <div className="host-event-detail__grid">
        {/* Overview */}
        <section className="admin-card host-event-detail__overview">
          <h2>Overview</h2>
          <dl>
            <div>
              <dt>Date</dt>
              <dd>{dateDisplay}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{timeDisplay}</dd>
            </div>
            {(venue || street) && (
              <div>
                <dt>Location</dt>
                <dd>
                  {venue && <span className="host-event-detail__venue">{venue}</span>}
                  {street && <span className="host-event-detail__street">{street}</span>}
                </dd>
              </div>
            )}
            <div>
              <dt>Event Type</dt>
              <dd>{formatEventType(event.event_type)}</dd>
            </div>
            {event.city && (
              <div>
                <dt>City</dt>
                <dd>{formatCity(event.city)}</dd>
              </div>
            )}
            {danceStyles.length > 0 && (
              <div>
                <dt>Dance Styles</dt>
                <dd className="host-event-detail__chips">
                  {danceStyles.map((style) => (
                    <span key={style.id} className="admin-chip">
                      {style.name}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            <div>
              <dt>Price</dt>
              <dd>{price}</dd>
            </div>
            {event.recurrence === "weekly" && (
              <div>
                <dt>Recurrence</dt>
                <dd>Repeats weekly</dd>
              </div>
            )}
            {hostName && (
              <div>
                <dt>Host</dt>
                <dd>{hostName}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Flyer */}
        <section className="admin-card host-event-detail__flyer">
          <h2>Event Flyer</h2>
          {event.image_url ? (
            <img src={event.image_url} alt={`${event.title} flyer`} />
          ) : (
            <SalsaSeguraFallbackImage
              title={event.title}
              template={getFallbackTemplate({
                id: event.id,
                title: event.title,
                danceStyles: event.dance_styles,
              })}
              variant="detail"
              showTitle={false}
            />
          )}
          {canEdit && (
            <Link
              to={`/host/events/${event.id}/edit`}
              className="admin-btn admin-btn--secondary host-event-detail__flyer-action"
            >
              Manage Flyer
              <ExternalLink size={14} aria-hidden="true" />
            </Link>
          )}
        </section>
      </div>

      {/* ── Description ── */}
      {event.description && (
        <section className="admin-card host-event-detail__description">
          <h2>Description</h2>
          <p>{event.description}</p>
        </section>
      )}

      {/* ── Links & Contact ── */}
      <section className="admin-card host-event-detail__links">
        <h2>Links &amp; Contact</h2>
        <div className="host-event-detail__links-grid">
          {/* Public event */}
          {isPublic && (
            <div className="host-event-detail__link-card">
              <span className="host-event-detail__link-label">Public Event</span>
              <Link
                to={`/events/${event.id}`}
                className="admin-btn admin-btn--secondary"
              >
                View public event
                <ExternalLink size={14} aria-hidden="true" />
              </Link>
            </div>
          )}

          {/* RSVP / Tickets */}
          <div className="host-event-detail__link-card">
            <span className="host-event-detail__link-label">RSVP / Tickets</span>
            {event.rsvp_link ? (
              <a
                href={event.rsvp_link}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-btn admin-btn--secondary"
              >
                Open Link
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : (
              <p className="host-event-detail__empty-text">No ticket link added.</p>
            )}
          </div>

          {/* Contact Email */}
          <div className="host-event-detail__link-card">
            <span className="host-event-detail__link-label">
              <Mail size={14} aria-hidden="true" />
              Contact Email
            </span>
            {event.contact_email ? (
              <a href={`mailto:${event.contact_email}`} className="host-event-detail__contact-value">
                {event.contact_email}
              </a>
            ) : (
              <p className="host-event-detail__empty-text">No contact email added.</p>
            )}
          </div>

          {/* Instagram */}
          <div className="host-event-detail__link-card">
            <span className="host-event-detail__link-label">
              <AtSign size={14} aria-hidden="true" />
              Instagram
            </span>
            {event.contact_instagram ? (
              <a
                href={`https://instagram.com/${event.contact_instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="host-event-detail__contact-value"
              >
                {event.contact_instagram}
              </a>
            ) : (
              <p className="host-event-detail__empty-text">No Instagram added.</p>
            )}
          </div>

          {/* Website */}
          <div className="host-event-detail__link-card">
            <span className="host-event-detail__link-label">
              <Globe size={14} aria-hidden="true" />
              Website
            </span>
            {event.contact_website ? (
              <a
                href={event.contact_website}
                target="_blank"
                rel="noopener noreferrer"
                className="host-event-detail__contact-value"
              >
                {event.contact_website.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <p className="host-event-detail__empty-text">No website added.</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Event Operations ── */}
      <section className="admin-card host-event-detail__operations">
        <h2>Event Operations</h2>
        <div className="host-event-detail__operations-grid">
          <Link
            to={`/host/events/${event.id}/attendees`}
            className="host-event-detail__operation-card"
          >
            <div className="host-event-detail__operation-icon">
              <Users size={20} aria-hidden="true" />
            </div>
            <div className="host-event-detail__operation-content">
              <h3>Attendees</h3>
              <p>
                {attendees.length === 0
                  ? "No attendees yet."
                  : `${attendees.length} ${attendees.length === 1 ? "person" : "people"} on the roster.`}
              </p>
            </div>
            <ExternalLink size={14} aria-hidden="true" className="host-event-detail__operation-link" />
          </Link>

          <Link
            to={`/host/events/${event.id}/check-in`}
            className="host-event-detail__operation-card"
          >
            <div className="host-event-detail__operation-icon">
              <QrCode size={20} aria-hidden="true" />
            </div>
            <div className="host-event-detail__operation-content">
              <h3>Check-in</h3>
              <p>
                {checkIns.filter((c) => !c.reversedAt).length === 0
                  ? "No one checked in yet."
                  : `${checkIns.filter((c) => !c.reversedAt).length} checked in.`}
              </p>
            </div>
            <ExternalLink size={14} aria-hidden="true" className="host-event-detail__operation-link" />
          </Link>
        </div>
      </section>
    </main>
  );
}
