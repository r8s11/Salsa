import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useDocumentMeta } from "../../../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../../../utils/seo";
import { entityExternalLinks } from "../externalLinks";
import { entityLocation, eventDateParts, formatEventDate } from "../format";
import { entityHref, type EntityDetail, type EventSummary, type PublicEntityRef } from "../model";
import { EntityClaimControl } from "../../workspaces/components/public/EntityClaimControl";
import "./DjProfile.css";

function GigRow({ event }: { event: EventSummary }) {
  const parts = eventDateParts(event.event_date);
  return (
    <Link className="dj-profile__gig" to={entityHref({ kind: "event", slug: event.slug })}>
      <span className="dj-profile__date" aria-hidden="true">
        {parts ? (
          <>
            <span className="dj-profile__day">{parts.day}</span>
            <span className="dj-profile__month">{parts.month}</span>
          </>
        ) : null}
      </span>
      <span className="dj-profile__gig-copy">
        <strong>{event.title}</strong>
        <span>
          {parts ? `${parts.weekday} · ${parts.time}` : formatEventDate(event.event_date)}
          {event.location ? ` · ${event.location}` : ""}
        </span>
      </span>
    </Link>
  );
}

/** The display name breaks before its last word, which takes the rose accent. */
function nameLines(name: string): string[] {
  const words = name.trim().split(/\s+/);
  return words.length < 2 ? words : [words.slice(0, -1).join(" "), words[words.length - 1]];
}

function DjName({ name }: { name: string }) {
  const [first, accent] = nameLines(name);
  if (!accent) return <span className="dj-profile__name-line">{first}</span>;
  return (
    <>
      <span className="dj-profile__name-line">{`${first} `}</span>
      <span className="dj-profile__name-line dj-profile__name-accent">{accent}</span>
    </>
  );
}

function NextGigLink({ event }: { event: EventSummary }) {
  const parts = eventDateParts(event.event_date);
  const when = parts ? `${parts.weekday} ${parts.day} ${parts.month}` : formatEventDate(event.event_date);
  const label = `See next gig: ${event.title}, ${when}${event.location ? ` at ${event.location}` : ""}`;
  return (
    <Link className="dj-profile__next" to={entityHref({ kind: "event", slug: event.slug })} aria-label={label}>
      <span>
        <span className="dj-profile__next-verb">See </span>next gig · {when}
      </span>
      <ArrowRight size={18} aria-hidden="true" />
    </Link>
  );
}

function PlaceRow({ place }: { place: PublicEntityRef }) {
  const where = place.kind === "venue" ? entityLocation(place) : place.city?.replace(/-/g, " ");
  return (
    <Link className="dj-profile__place" to={entityHref(place)}>
      <span className="dj-profile__place-copy">
        <strong>{place.name}</strong>
        {where && <span>{where}</span>}
      </span>
      <span className="dj-profile__place-kind">{place.kind === "series" ? "Residency" : "Venue"}</span>
    </Link>
  );
}

export function DjProfile({ detail }: { detail: EntityDetail }) {
  const { entity, upcoming, past, related } = detail;
  const { website, instagram } = entityExternalLinks(entity);
  const location = entityLocation(entity);
  const [portraitFailed, setPortraitFailed] = useState(false);
  const portrait = entity.image_url && !portraitFailed ? entity.image_url : null;
  const styles = related.filter((item) => item.kind === "style");
  // Residencies (series) lead; venues follow. Both come from approved gigs, so no schedule is claimed.
  const places = [...related.filter((item) => item.kind === "series"), ...related.filter((item) => item.kind === "venue")];
  const next = upcoming[0];

  useDocumentMeta({
    title: entity.name,
    description: entity.description ?? `Upcoming gigs, residencies, and venues for ${entity.name} on Salsa Segura.`,
    canonical: canonicalUrl(entityHref(entity)),
    robots: "index, follow",
    image: entity.image_url,
  });

  return (
    <article className={`dj-profile${portrait ? " dj-profile--portrait" : ""}`} aria-labelledby="dj-profile-title">
      <header className="dj-profile__hero">
        {portrait && (
          <div className="dj-profile__portrait">
            <img
              src={portrait}
              alt={`Portrait of ${entity.name}`}
              fetchPriority="high"
              decoding="async"
              onError={() => setPortraitFailed(true)}
            />
          </div>
        )}
        <div className="dj-profile__intro">
          <h1
            id="dj-profile-title"
            className="dj-profile__name"
            style={{ "--dj-name-chars": nameLines(entity.name).reduce((longest, line) => Math.max(longest, line.length), 0) } as CSSProperties}
          >
            <DjName name={entity.name} />
          </h1>
          {(location || styles.length > 0) && (
            <div className="dj-profile__meta">
              {location && <p className="dj-profile__location">{location}</p>}
              {styles.length > 0 && (
                <ul className="dj-profile__styles" aria-label="Dance styles">
                  {styles.map((style) => (
                    <li key={style.id}>
                      <Link className="dj-profile__style" to={entityHref(style)}>{style.name}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {next && <NextGigLink event={next} />}
          {entity.description && <p className="dj-profile__bio">{entity.description}</p>}
          {(instagram || website) && (
            <nav className="dj-profile__links" aria-label={`${entity.name} external links`}>
              {instagram && <a className="ui-button ui-button--secondary" href={instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
              {website && <a className="ui-button ui-button--secondary" href={website} target="_blank" rel="noopener noreferrer">Website</a>}
            </nav>
          )}
        </div>
      </header>

      <section className="dj-profile__upcoming" aria-labelledby="dj-upcoming">
        <div className="dj-profile__band">
          <h2 id="dj-upcoming">Upcoming gigs</h2>
          {upcoming.length === 0 ? (
            <p className="dj-profile__empty">No upcoming gigs listed yet.</p>
          ) : (
            <ul className="dj-profile__list">{upcoming.map((event) => <li key={event.id}><GigRow event={event} /></li>)}</ul>
          )}
        </div>
      </section>

      {(places.length > 0 || past.length > 0) && (
        <div className="dj-profile__body">
          {places.length > 0 && (
            <section className="dj-profile__places" aria-labelledby="dj-places">
              <h2 id="dj-places">Venues and residencies</h2>
              <ul className="dj-profile__list">{places.map((place) => <li key={`${place.kind}:${place.id}`}><PlaceRow place={place} /></li>)}</ul>
            </section>
          )}
          {past.length > 0 && (
            <section className="dj-profile__past" aria-labelledby="dj-past">
              <h2 id="dj-past">Past gigs</h2>
              <ul className="dj-profile__list">{past.map((event) => <li key={event.id}><GigRow event={event} /></li>)}</ul>
            </section>
          )}
        </div>
      )}

      <footer className="dj-profile__footer">
        <EntityClaimControl kind="dj" entity={entity} />
        <Link className="dj-profile__browse" to="/djs">All DJs</Link>
      </footer>
    </article>
  );
}
