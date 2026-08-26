import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { useMySubmissions } from "../hooks/useMySubmissions";
import { deriveHostEventRows } from "../features/host/model/hostEvents";
import type { DatabaseEvent } from "../features/events/model/types";
import AdminStatusBadge from "../components/Admin/AdminStatusBadge";
import EventShareControls from "../features/events/components/EventShareControls";
import "./HostEventDetailPage.css";

const STATUS_MESSAGE: Partial<Record<DatabaseEvent["status"], string>> = {
  pending: "Awaiting review. You can update or withdraw this submission.",
  rejected: "This submission was not approved. You can revise it.",
  approved: "Published on SalsaSegura. You can view and share the public event.",
};

function formatPrice(event: DatabaseEvent): string {
  if (event.price_type === "free") return "Free";
  if (event.price_type === "paid" && event.price_amount != null) return `$${event.price_amount}`;
  return "Pricing unavailable";
}

export default function HostEventDetailPage() {
  const { user } = useAuth();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { submissions, approvedEvents, isLoading, error, refetch } = useMySubmissions(user?.id);

  // Owner-scoped by construction: submissions/approvedEvents only ever
  // contain rows RLS already restricted to this submitter (or admin-visible
  // approved rows filtered client-side by ownership downstream). An unknown
  // or another Organizer's event simply never appears here — unknown and
  // unowned IDs are indistinguishable, by design.
  const owned = useMemo(() => {
    const byId = new Map(
      [...submissions, ...approvedEvents].map((candidate) => [candidate.id, candidate] as const)
    );
    return [...byId.values()];
  }, [submissions, approvedEvents]);
  const event = owned.find((candidate) => candidate.id === eventId) ?? null;

  useEffect(() => {
    if (!isLoading && !error && eventId && !event) {
      navigate("/host/events");
    }
  }, [isLoading, error, eventId, event, navigate]);

  if (isLoading) {
    return (
      <main className="host-event-detail">
        <p role="status" className="host-event-detail__status">
          Loading event…
        </p>
      </main>
    );
  }

  if (error) {
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

  // Not found (or redirecting away as unowned/unknown) — render nothing so
  // no private event content ever flashes before navigation completes.
  if (!event) return null;

  const [row] = deriveHostEventRows([event]);
  const danceStyles = event.taxonomy_terms.filter((term) => term.category === "dance_style");
  const price = formatPrice(event);

  return (
    <main className="host-event-detail">
      <Link to="/host/events" className="host-event-detail__back">
        <ArrowLeft size={16} aria-hidden="true" />
        My Events
      </Link>

      <header className="host-event-detail__header">
        <div className="host-event-detail__title-row">
          <h1>{event.title}</h1>
          <AdminStatusBadge status={event.status} />
        </div>
        <p className="host-event-detail__meta">
          {row.dateLabel}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      </header>

      {STATUS_MESSAGE[event.status] && (
        <p className="host-event-detail__status-message">{STATUS_MESSAGE[event.status]}</p>
      )}

      <div className="host-event-detail__actions">
        {event.status === "pending" && (
          <Link className="admin-btn admin-btn--primary" to={`/profile/edit/${event.id}`}>
            Edit submission
          </Link>
        )}
        {event.status === "rejected" && (
          <Link className="admin-btn admin-btn--primary" to={`/profile/edit/${event.id}`}>
            Revise submission
          </Link>
        )}
        {event.status === "approved" && (
          <Link className="admin-btn admin-btn--primary" to={`/events/${event.id}`}>
            View public event
            <ExternalLink size={14} aria-hidden="true" />
          </Link>
        )}
      </div>

      {event.status === "approved" && (
        <section className="admin-card host-event-detail__share">
          <EventShareControls
            eventId={event.id}
            title={event.title}
            dateLabel={row.dateLabel}
            location={event.location}
          />
        </section>
      )}

      <div className="host-event-detail__grid">
        <section className="admin-card host-event-detail__overview">
          <h2>Event details</h2>
          <dl>
            {event.address && (
              <div>
                <dt>Address</dt>
                <dd>{event.address}</dd>
              </div>
            )}
            <div>
              <dt>Price</dt>
              <dd>{price}</dd>
            </div>
            {event.rsvp_link && (
              <div>
                <dt>RSVP</dt>
                <dd>
                  <a href={event.rsvp_link} target="_blank" rel="noopener noreferrer">
                    RSVP or tickets
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </dd>
              </div>
            )}
            {event.recurrence === "weekly" && (
              <div>
                <dt>Recurrence</dt>
                <dd>Repeats weekly</dd>
              </div>
            )}
            {danceStyles.length > 0 && (
              <div>
                <dt>Dance styles</dt>
                <dd className="host-event-detail__chips">
                  {danceStyles.map((style) => (
                    <span key={style.id} className="admin-chip">
                      {style.name}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {event.contact_email && (
              <div>
                <dt>Contact email</dt>
                <dd>{event.contact_email}</dd>
              </div>
            )}
          </dl>
        </section>

        {event.description && (
          <section className="admin-card host-event-detail__description">
            <h2>Description</h2>
            <p>{event.description}</p>
          </section>
        )}

        {event.image_url && (
          <section className="admin-card host-event-detail__flyer">
            <h2>Flyer</h2>
            <img src={event.image_url} alt={`${event.title} flyer`} />
          </section>
        )}
      </div>
    </main>
  );
}
