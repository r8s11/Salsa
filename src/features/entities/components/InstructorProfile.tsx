import { Link } from "react-router-dom";
import { useDocumentMeta } from "../../../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../../../utils/seo";
import { entityExternalLinks } from "../externalLinks";
import { entityLocation, eventDateParts, eventSummaryTimeZone, formatEventDate } from "../format";
import { ENTITY_LABELS, entityHref, profileMedia, type EntityDetail, type EventSummary } from "../model";
import { EntityClaimControl } from "../../workspaces/components/public/EntityClaimControl";
import { EntityEditButton } from "./EntityEditButton";
import { ProfileLinks, ProfileNext, ProfileNight, ProfileShell, type ProfileLink } from "./ProfileShell";

function NightRow({ event }: { event: EventSummary }) {
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
  const nextParts = upcoming[0] ? eventDateParts(upcoming[0].event_date, eventSummaryTimeZone(upcoming[0])) : undefined;
  const links: ProfileLink[] = [
    ...(instagram ? [{ label: "Instagram", href: instagram }] : []),
    ...(website ? [{ label: "Website", href: website }] : []),
  ];

  return (
    <ProfileShell
      variant="instructor"
      titleId="instructor-profile-title"
      crumb={{ label: "Instructors", to: "/instructors" }}
      name={entity.name}
      where={location}
      tagline={entity.description}
      imageUrl={entity.image_url}
      media={profileMedia(detail)}
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
      adminSlot={<EntityEditButton kind="instructor" id={entity.id} />}
      note={entity.origin === "flyer" ? "Added from an event flyer after review. Details have not been independently verified." : null}
      main={
        <>
          <section aria-labelledby="instructor-upcoming">
            <h2 id="instructor-upcoming">Teaching next</h2>
            {upcoming.length === 0 ? (
              <p className="profile__empty">No upcoming classes or events listed yet.</p>
            ) : (
              <ul className="profile__nights">{upcoming.map((event) => <li key={event.id}><NightRow event={event} /></li>)}</ul>
            )}
          </section>
          {past.length > 0 && (
            <section className="profile__past" aria-labelledby="instructor-past">
              <h2 id="instructor-past">Past nights</h2>
              <ul className="profile__nights">{past.map((event) => <li key={event.id}><NightRow event={event} /></li>)}</ul>
            </section>
          )}
        </>
      }
      side={
        related.length > 0 ? (
          <aside className="profile__card" aria-labelledby="instructor-related">
            <h2 id="instructor-related">Listed alongside</h2>
            <ul className="profile__places">
              {related.map((item) => (
                <li key={`${item.kind}:${item.id}`}>
                  <Link className="profile__place" to={entityHref(item)}>
                    <span className="profile__place-copy"><strong>{item.name}</strong></span>
                    <span className="profile__place-kind">{ENTITY_LABELS[item.kind]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : undefined
      }
      footer={<EntityClaimControl kind="instructor" entity={entity} />}
    />
  );
}
