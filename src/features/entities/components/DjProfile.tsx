import { Link } from "react-router-dom";
import { useDocumentMeta } from "../../../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../../../utils/seo";
import { entityExternalLinks } from "../externalLinks";
import { entityLocation, eventDateParts, eventSummaryTimeZone, formatEventDate } from "../format";
import { entityHref, profileMedia, type EntityDetail, type EventSummary, type PublicEntityRef } from "../model";
import { EntityClaimControl } from "../../workspaces/components/public/EntityClaimControl";
import { ProfileLinks, ProfileNext, ProfileNight, ProfileShell, type ProfileLink } from "./ProfileShell";

function GigRow({ event }: { event: EventSummary }) {
  const zone = eventSummaryTimeZone(event);
  const parts = eventDateParts(event.event_date, zone);
  return (
    <ProfileNight
      to={entityHref({ kind: "event", slug: event.slug })}
      day={parts?.day}
      month={parts?.month}
      title={event.title}
      meta={`${parts ? `${parts.weekday} · ${parts.time}` : formatEventDate(event.event_date, zone)}${event.location ? ` · ${event.location}` : ""}`}
    />
  );
}

function PlaceRow({ place }: { place: PublicEntityRef }) {
  const where = place.kind === "venue" ? entityLocation(place) : place.city?.replace(/-/g, " ");
  return (
    <Link className="profile__place" to={entityHref(place)}>
      <span className="profile__place-copy">
        <strong>{place.name}</strong>
        {where && <span>{where}</span>}
      </span>
      <span className="profile__place-kind">{place.kind === "series" ? "Residency" : "Venue"}</span>
    </Link>
  );
}

export function DjProfile({ detail }: { detail: EntityDetail }) {
  const { entity, upcoming, past, related } = detail;
  const { website, instagram } = entityExternalLinks(entity);
  const location = entityLocation(entity);
  const styles = related.filter((item) => item.kind === "style");
  // Residencies (series) lead; venues follow. Both come from approved gigs, so no schedule is claimed.
  const places = [...related.filter((item) => item.kind === "series"), ...related.filter((item) => item.kind === "venue")];

  useDocumentMeta({
    title: entity.name,
    description: entity.description ?? `Upcoming gigs, residencies, and venues for ${entity.name} on Salsa Segura.`,
    canonical: canonicalUrl(entityHref(entity)),
    robots: "index, follow",
    image: entity.image_url,
  });
  const nextParts = upcoming[0] ? eventDateParts(upcoming[0].event_date, eventSummaryTimeZone(upcoming[0])) : undefined;
  const links: ProfileLink[] = [
    ...(instagram ? [{ label: "Instagram", href: instagram }] : []),
    ...(website ? [{ label: "Website", href: website }] : []),
  ];

  return (
    <ProfileShell
      variant="dj"
      titleId="dj-profile-title"
      crumb={{ label: "DJs", to: "/djs" }}
      name={entity.name}
      where={location}
      tagline={entity.description}
      imageUrl={entity.image_url}
      media={profileMedia(detail)}
      chips={
        styles.length > 0 && (
          <ul className="profile__styles" aria-label="Dance styles">
            {styles.map((style) => (
              <li key={style.id}>
                <Link className="style-chip" to={entityHref(style)}>{style.name}</Link>
              </li>
            ))}
          </ul>
        )
      }
      door={
        <>
          {upcoming[0] && (
            <ProfileNext
              to={entityHref({ kind: "event", slug: upcoming[0].slug })}
              day={nextParts?.day}
              month={nextParts?.month}
              label={`Next up${nextParts ? ` · ${nextParts.weekday} ${nextParts.day} ${nextParts.month}, ${nextParts.time}` : ""}`}
              title={upcoming[0].title}
              location={upcoming[0].location}
            />
          )}
          <ProfileLinks name={entity.name} links={links} />
        </>
      }
      main={
        <>
          <section aria-labelledby="dj-upcoming">
            <h2 id="dj-upcoming">Upcoming gigs</h2>
            {upcoming.length === 0 ? (
              <p className="profile__empty">No upcoming gigs listed yet.</p>
            ) : (
              <ul className="profile__nights">{upcoming.map((event) => <li key={event.id}><GigRow event={event} /></li>)}</ul>
            )}
          </section>
          {past.length > 0 && (
            <section className="profile__past" aria-labelledby="dj-past">
              <h2 id="dj-past">Past gigs</h2>
              <ul className="profile__nights">{past.map((event) => <li key={event.id}><GigRow event={event} /></li>)}</ul>
            </section>
          )}
        </>
      }
      side={
        places.length > 0 ? (
          <section aria-labelledby="dj-places">
            <h2 id="dj-places">Venues and residencies</h2>
            <ul className="profile__places">{places.map((place) => <li key={`${place.kind}:${place.id}`}><PlaceRow place={place} /></li>)}</ul>
          </section>
        ) : undefined
      }
      footer={<EntityClaimControl kind="dj" entity={entity} />}
    />
  );
}
