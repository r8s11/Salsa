import "temporal-polyfill/global";
import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin } from "lucide-react";
import { entityExternalLinks } from "../externalLinks";
import { entityHref, type EntityDetail, type EventSummary, type PublicEntityRef } from "../model";
import "./SchoolProfile.css";

// Every event time on the site is shown in New York time (see
// events/model/convert.ts); the school page follows the same rule.
const ZONE = "America/New_York";
const PAST_LIMIT = 6;

interface NightDate {
  day: string;
  month: string;
  /** "Tonight", "Today", "Tomorrow", "Thursday", or "Thu, Oct 22". */
  when: string;
  time: string;
}

function nightDate(value: string, today: Temporal.PlainDate): NightDate | null {
  try {
    const zoned = Temporal.Instant.from(value).toZonedDateTimeISO(ZONE);
    const daysAway = today.until(zoned.toPlainDate(), { largestUnit: "days" }).days;
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

function DateTile({ date }: { date: NightDate | null }) {
  return (
    <span className="school-profile__date" aria-hidden="true">
      {date && (
        <>
          <span className="school-profile__date-day">{date.day}</span>
          <span className="school-profile__date-month">{date.month}</span>
        </>
      )}
    </span>
  );
}

function NightRow({ event, today }: { event: EventSummary; today: Temporal.PlainDate }) {
  const date = nightDate(event.event_date, today);
  return (
    <Link className="school-profile__night" to={entityHref({ kind: "event", slug: event.slug })}>
      <DateTile date={date} />
      <span className="school-profile__night-copy">
        <strong>{event.title}</strong>
        <span>
          {date ? `${date.when} · ${date.time}` : event.event_date}
          {event.location ? ` · ${event.location}` : ""}
        </span>
      </span>
    </Link>
  );
}

function RefList({ title, id, refs }: { title: string; id: string; refs: PublicEntityRef[] }) {
  if (refs.length === 0) return null;
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <ul className="school-profile__refs">
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
  const today = Temporal.Now.plainDateISO(ZONE);
  const { website, instagram } = entityExternalLinks(school);

  const town = [school.city, school.state_region].filter(Boolean).join(", ");
  const addressQuery = [school.address, town].filter(Boolean).join(", ");
  const directions = addressQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${school.name}, ${addressQuery}`)}`
    : null;

  const next = upcoming[0] ?? null;
  const nextDate = next ? nightDate(next.event_date, today) : null;
  const byKind = (kind: PublicEntityRef["kind"]) => related.filter((ref) => ref.kind === kind);
  const instructors = byKind("instructor");
  const styles = byKind("style").filter((ref) => ref.category === "dance_style");
  const venues = byKind("venue");
  const listedWith = related.filter(
    (ref) => ref.kind === "organizer" || ref.kind === "series" || ref.kind === "school"
  );
  const metro = byKind("city")[0] ?? null;

  return (
    <article className="school-profile" aria-labelledby="school-profile-title">
      <header className="school-profile__hero">
        <div className="school-profile__intro">
          <h1 id="school-profile-title">{school.name}</h1>
          <p className="school-profile__where">{town ? `Dance school in ${town}` : "Dance school"}</p>
          {school.description && <p className="school-profile__about">{school.description}</p>}
          {styles.length > 0 && (
            <ul className="school-profile__styles" aria-label="Dance styles taught">
              {styles.map((style) => (
                <li key={style.id}>
                  <Link className="style-chip" to={entityHref(style)}>
                    {style.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="school-profile__door" aria-label={`Visiting ${school.name}`}>
          {school.image_url && (
            <img className="school-profile__photo" src={school.image_url} alt="" />
          )}
          <div className="school-profile__door-body">
            {next ? (
              <Link
                className="school-profile__next"
                to={entityHref({ kind: "event", slug: next.slug })}
              >
                <DateTile date={nextDate} />
                <span className="school-profile__next-copy">
                  <span className="school-profile__next-label">
                    Next up{nextDate ? ` · ${nextDate.when}, ${nextDate.time}` : ""}
                  </span>
                  <strong>{next.title}</strong>
                  {next.location && <span>{next.location}</span>}
                </span>
                <ArrowUpRight className="school-profile__next-arrow" size={20} aria-hidden="true" />
              </Link>
            ) : (
              <p className="school-profile__no-next">No classes on the calendar right now.</p>
            )}

            {(school.address || town) && (
              <div className="school-profile__address">
                <MapPin size={18} aria-hidden="true" />
                <address>
                  {school.address && <span>{school.address}</span>}
                  {town && <span>{town}</span>}
                </address>
              </div>
            )}

            {(directions || instagram || website) && (
              <nav className="school-profile__links" aria-label={`${school.name} links`}>
                {directions && (
                  <a href={directions} target="_blank" rel="noopener noreferrer">
                    Directions <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                )}
                {instagram && (
                  <a href={instagram} target="_blank" rel="noopener noreferrer">
                    Instagram <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                )}
                {website && (
                  <a href={website} target="_blank" rel="noopener noreferrer">
                    Website <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                )}
              </nav>
            )}
          </div>
        </aside>
      </header>

      <div className="school-profile__body">
        <div className="school-profile__schedule">
          <section aria-labelledby="school-upcoming">
            <h2 id="school-upcoming">On the calendar</h2>
            {upcoming.length === 0 ? (
              <p className="school-profile__empty">
                Nothing listed yet.
                {(instagram || website) && " The school's own pages may have their current schedule."}
              </p>
            ) : (
              <ul className="school-profile__nights">
                {upcoming.map((event) => (
                  <li key={event.id}>
                    <NightRow event={event} today={today} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {past.length > 0 && (
            <section className="school-profile__past" aria-labelledby="school-past">
              <h2 id="school-past">Past nights</h2>
              <ul className="school-profile__nights">
                {past.slice(0, PAST_LIMIT).map((event) => (
                  <li key={event.id}>
                    <NightRow event={event} today={today} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {(instructors.length > 0 || venues.length > 0 || listedWith.length > 0) && (
          <aside className="school-profile__side" aria-label={`More about ${school.name}`}>
            {instructors.length > 0 && (
              <section aria-labelledby="school-instructors">
                <h2 id="school-instructors">Teaches here</h2>
                <ul className="school-profile__people">
                  {instructors.map((person) => (
                    <li key={person.id}>
                      <Link to={entityHref(person)}>
                        {person.image_url ? (
                          <img src={person.image_url} alt="" loading="lazy" />
                        ) : (
                          <span className="school-profile__initials" aria-hidden="true">
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
            <RefList title="Where classes meet" id="school-venues" refs={venues} />
            <RefList title="Listed with" id="school-listed-with" refs={listedWith} />
          </aside>
        )}
      </div>

      <nav className="school-profile__more" aria-label="More schools">
        <Link to="/schools">All schools</Link>
        {metro && <Link to={entityHref(metro)}>More dancing in {metro.name}</Link>}
      </nav>
    </article>
  );
}
