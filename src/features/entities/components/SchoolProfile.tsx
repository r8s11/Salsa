import "temporal-polyfill/global";
import { Link } from "react-router-dom";
import { entityExternalLinks } from "../externalLinks";
import { eventSummaryTimeZone } from "../format";
import { entityHref, profileMedia, type EntityDetail, type EventSummary, type PublicEntityRef } from "../model";
import { EntityClaimControl } from "../../workspaces/components/public/EntityClaimControl";
import { SchoolOfferingsSection } from "../../workspaces/components/public/SchoolOfferingsSection";
import { EntityEditButton } from "./EntityEditButton";
import VenueMapCard from "../../events/components/VenueMapCard";
import { ProfileLinks, ProfileNight, ProfileShell } from "./ProfileShell";

const PAST_LIMIT = 6;
const SIDE_LIMIT = 3;

interface NightDate {
  day: string;
  month: string;
  /** "Tonight", "Today", "Tomorrow", "Thursday", or "Thu, Oct 22". */
  when: string;
  time: string;
}

/**
 * Date tile and label for a row, in the event's own zone (venue, then metro).
 * "Tonight/Today/Tomorrow" count from today's date in that same zone, never the viewer's.
 */
function nightDate(event: EventSummary): NightDate | null {
  try {
    const zone = eventSummaryTimeZone(event);
    const zoned = Temporal.Instant.from(event.event_date).toZonedDateTimeISO(zone);
    const daysAway = Temporal.Now.plainDateISO(zone).until(zoned.toPlainDate(), { largestUnit: "days" }).days;
    const when =
      daysAway === 0
        ? zoned.hour >= 17
          ? "Tonight"
          : "Today"
        : daysAway === 1
          ? "Tomorrow"
          : daysAway > 1 && daysAway < 7
            ? zoned.toLocaleString("en-US", { weekday: "long" })
            : zoned.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric" });
    return {
      day: String(zoned.day),
      month: zoned.toLocaleString("en-US", { month: "short" }),
      when,
      time: zoned.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" }),
    };
  } catch {
    return null;
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function NightRow({ event }: { event: EventSummary }) {
  const date = nightDate(event);
  return (
    <ProfileNight
      to={entityHref({ kind: "event", slug: event.slug })}
      day={date?.day}
      month={date?.month}
      title={event.title}
      meta={`${date ? `${date.when} · ${date.time}` : event.event_date}${event.location ? ` · ${event.location}` : ""}`}
    />
  );
}

function RefList({ title, id, refs }: { title: string; id: string; refs: PublicEntityRef[] }) {
  if (refs.length === 0) return null;
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <ul className="profile__refs">
        {refs.map((ref) => (
          <li key={`${ref.kind}:${ref.id}`}>
            <Link to={entityHref(ref)}>{ref.name}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SchoolProfile({ detail }: { detail: EntityDetail }) {
  const { entity: school, upcoming, past, related } = detail;
  const { website, instagram } = entityExternalLinks(school);

  const town = [school.city, school.state_region].filter(Boolean).join(", ");
  const addressQuery = [school.address, town].filter(Boolean).join(", ");
  const directions = addressQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${school.name}, ${addressQuery}`)}`
    : null;

  const byKind = (kind: PublicEntityRef["kind"]) => related.filter((ref) => ref.kind === kind);
  const instructors = byKind("instructor");
  const styles = byKind("style").filter((ref) => ref.category === "dance_style");
  const venues = byKind("venue");
  const listedWith = related.filter(
    (ref) => ref.kind === "organizer" || ref.kind === "series" || ref.kind === "school"
  );
  const metro = byKind("city")[0] ?? null;

  return (
    <ProfileShell
      variant="school"
      titleId="school-profile-title"
      crumb={{ label: "Schools", to: "/schools" }}
      name={school.name}
      where={town ? `Dance school in ${town}` : "Dance school"}
      imageUrl={school.image_url}
      media={profileMedia(detail)}
      adminSlot={<EntityEditButton kind="school" id={school.id} />}
      main={
        <>
          {school.description && (
            <section className="profile__about" aria-labelledby="school-about">
              <h2 id="school-about">About the school</h2>
              <p>{school.description}</p>
            </section>
          )}
          {styles.length > 0 && (
            <section aria-labelledby="school-styles">
              <h2 id="school-styles">Styles &amp; levels</h2>
              <ul className="profile__styles" aria-label="Dance styles taught">
                {styles.map((style) => (
                  <li key={style.id}>
                    <Link className="style-chip" to={entityHref(style)}>
                      {style.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <SchoolOfferingsSection slug={school.slug} />
          {instructors.length > 0 && (
            <section aria-labelledby="school-instructors">
              <h2 id="school-instructors">Instructors at this school</h2>
              <ul className="profile__people">
                {instructors.map((person) => (
                  <li key={person.id}>
                    <Link className="profile__person" to={entityHref(person)}>
                      {person.image_url ? (
                        <img src={person.image_url} alt="" loading="lazy" />
                      ) : (
                        <span className="profile__person-initials" aria-hidden="true">
                          {initials(person.name)}
                        </span>
                      )}
                      <span>{person.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {past.length > 0 && (
            <section className="profile__past" aria-labelledby="school-past">
              <h2 id="school-past">Past nights</h2>
              <ul className="profile__nights">
                {past.slice(0, PAST_LIMIT).map((event) => (
                  <li key={event.id}>
                    <NightRow event={event} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      }
      side={
        <>
          <section className="profile__card" aria-labelledby="school-upcoming">
            <h2 id="school-upcoming">Upcoming classes</h2>
            {upcoming.length === 0 ? (
              <p className="profile__empty">No classes on the calendar right now.</p>
            ) : (
              <ul className="profile__nights">
                {upcoming.slice(0, SIDE_LIMIT).map((event) => (
                  <li key={event.id}>
                    <NightRow event={event} />
                  </li>
                ))}
              </ul>
            )}
            {upcoming.length > SIDE_LIMIT && (
              <Link className="profile__card-link" to="/calendar">Full calendar →</Link>
            )}
          </section>
          {addressQuery && (
            <VenueMapCard
              venueName={school.name}
              streetAddress={school.address ?? null}
              cityLabel={town || null}
              directionsHref={directions}
            />
          )}
          {(instagram || website) && (
            <section className="profile__card" aria-labelledby="school-contact">
              <h2 id="school-contact">Contact &amp; socials</h2>
              <ProfileLinks
                name={school.name}
                links={[
                  ...(instagram ? [{ label: "Instagram", href: instagram }] : []),
                  ...(website ? [{ label: "Website", href: website }] : []),
                ]}
              />
            </section>
          )}
          {(venues.length > 0 || listedWith.length > 0) && (
            <aside className="profile__card" aria-label={`More about ${school.name}`}>
              <RefList title="Where classes meet" id="school-venues" refs={venues} />
              <RefList title="Listed with" id="school-listed-with" refs={listedWith} />
            </aside>
          )}
        </>
      }
      footer={
        <>
          <EntityClaimControl kind="school" entity={school} />
          {metro && (
            <nav className="profile__more" aria-label="More dancing nearby">
              <Link to={entityHref(metro)}>More dancing in {metro.name}</Link>
            </nav>
          )}
        </>
      }
    />
  );
}
