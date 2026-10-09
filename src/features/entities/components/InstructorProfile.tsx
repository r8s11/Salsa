import { Link } from "react-router-dom";
import { useDocumentMeta } from "../../../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../../../utils/seo";
import { entityExternalLinks } from "../externalLinks";
import { entityLocation, eventDateParts, formatEventDate } from "../format";
import { ENTITY_LABELS, entityHref, type EntityDetail, type EventSummary } from "../model";
import { InstructorPortrait } from "./InstructorPortrait";
import "./InstructorProfile.css";
import { EntityClaimControl } from "../../workspaces/components/public/EntityClaimControl";

function NightRow({ event }: { event: EventSummary }) {
  const parts = eventDateParts(event.event_date);
  return (
    <Link className="instructor-profile__night" to={entityHref({ kind: "event", slug: event.slug })}>
      <span className="instructor-profile__date" aria-hidden="true">
        {parts ? (
          <>
            <span className="instructor-profile__day">{parts.day}</span>
            <span className="instructor-profile__month">{parts.month}</span>
          </>
        ) : null}
      </span>
      <span className="instructor-profile__night-copy">
        <strong>{event.title}</strong>
        <span>
          {parts ? `${parts.weekday} · ${parts.time}` : formatEventDate(event.event_date)}
          {event.location ? ` · ${event.location}` : ""}
        </span>
      </span>
    </Link>
  );
}

export function InstructorProfile({ detail }: { detail: EntityDetail }) {
  const { entity, upcoming, past, related } = detail;
  const { website, instagram } = entityExternalLinks(entity);
  const location = entityLocation(entity);
  useDocumentMeta({
    title: entity.name,
    description: entity.description ?? `Classes, workshops, and events with ${entity.name} on Salsa Segura.`,
    canonical: canonicalUrl(entityHref(entity)),
    robots: "index, follow",
    image: entity.image_url,
  });

  return (
    <article className="instructor-profile" aria-labelledby="instructor-profile-title">
      <header className="instructor-profile__hero">
        <InstructorPortrait name={entity.name} imageUrl={entity.image_url} alt={`Portrait of ${entity.name}`} className="instructor-profile__portrait" />
        <div className="instructor-profile__intro">
          <h1 id="instructor-profile-title">{entity.name}</h1>
          {location && <p className="instructor-profile__location">{location}</p>}
          {entity.description && <p className="instructor-profile__bio">{entity.description}</p>}
          {(website || instagram) && (
            <nav className="instructor-profile__links" aria-label={`${entity.name} external links`}>
              {instagram && <a className="ui-button ui-button--secondary" href={instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
              {website && <a className="ui-button ui-button--secondary" href={website} target="_blank" rel="noopener noreferrer">Website</a>}
            </nav>
          )}
          {entity.origin === "flyer" && (
            <p className="instructor-profile__note">Added from an event flyer after review. Details have not been independently verified.</p>
          )}
        </div>
      </header>

      <div className="instructor-profile__body">
        <div className="instructor-profile__nights">
          <section aria-labelledby="instructor-upcoming">
            <h2 id="instructor-upcoming">Teaching next</h2>
            {upcoming.length === 0 ? (
              <p className="instructor-profile__empty">No upcoming classes or events listed yet.</p>
            ) : (
              <ul>{upcoming.map((event) => <li key={event.id}><NightRow event={event} /></li>)}</ul>
            )}
          </section>
          {past.length > 0 && (
            <section className="instructor-profile__past" aria-labelledby="instructor-past">
              <h2 id="instructor-past">Past nights</h2>
              <ul>{past.map((event) => <li key={event.id}><NightRow event={event} /></li>)}</ul>
            </section>
          )}
        </div>
        {related.length > 0 && (
          <aside className="instructor-profile__related" aria-labelledby="instructor-related">
            <h2 id="instructor-related">Listed alongside</h2>
            <ul>
              {related.map((item) => (
                <li key={`${item.kind}:${item.id}`}>
                  <Link to={entityHref(item)}>{item.name}<span>{ENTITY_LABELS[item.kind]}</span></Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
      <footer className="instructor-profile__footer">
        <EntityClaimControl kind="instructor" entity={entity} />
        <Link className="instructor-profile__browse" to="/instructors">All instructors</Link>
      </footer>
    </article>
  );
}
