import "temporal-polyfill/global";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import EventCard from "../../events/components/EventCard";
import EventShareControls from "../../events/components/EventShareControls";
import FeaturedEventCard from "../../events/components/FeaturedEventCard";
import { posterPriceLabel } from "../../events/components/event-modal/posterFormat";
import { neighborhoodLabel } from "../../metros/model/neighborhood";
import { databaseEventToScheduleX } from "../../events/model/convert";
import type { ScheduleXEvent } from "../../../types/events";
import { buildPublicItineraryUrl } from "../model/itinerarySharing";
import { estimatedAdmission, type Schedule, type ScheduledEntry } from "../model/schedule";
import type { Itinerary } from "../model/types";
import { formatWeekRange } from "../model/week";
import "./ItineraryView.css";

interface ItineraryViewProps {
  itinerary: Pick<Itinerary, "city" | "weekStart" | "timeZone" | "title" | "description" | "recommendations">;
  schedule: Schedule;
  cityName: string;
  neighbours?: { previous: string | null; next: string | null };
  /** Admin preview: draft banner, all seven nights, no public sharing. */
  draft?: boolean;
}

function styleBadges(schedule: Schedule): string[] {
  // Styles don't depend on zone, so the default conversion is fine here.
  const seen = new Map<string, string>();
  for (const { event } of schedule.nights.flatMap((night) => night.entries)) {
    for (const style of databaseEventToScheduleX(event).danceStyles ?? []) {
      const key = style.toLowerCase();
      if (!seen.has(key)) seen.set(key, style);
    }
  }
  return [...seen.values()];
}

/** Local guide facts supplement the shared cards without changing their UI. */
function ItineraryPick({
  entry,
  timeZone,
  onSelect,
}: {
  entry: ScheduledEntry;
  timeZone: string;
  onSelect: (event: ScheduleXEvent) => void;
}) {
  const event = databaseEventToScheduleX(entry.event, { timeZone });
  const price = posterPriceLabel(event);
  const neighborhood = neighborhoodLabel(event.neighborhood) ?? event.neighborhood;
  const facts = [price, neighborhood, ...(event.danceStyles ?? [])].filter((fact): fact is string => Boolean(fact));

  return (
    <div className="itinerary-pick">
      {entry.item.role === "featured" ? (
        <FeaturedEventCard event={event} onSelect={onSelect} />
      ) : (
        <EventCard event={event} onSelect={onSelect} />
      )}
      <div className="itinerary-pick__facts" role="group" aria-label={`Details for ${event.title}`}>
        {facts.length > 0 && (
          <ul aria-label={`Facts for ${event.title}`}>
            {facts.map((fact, index) => <li key={`${fact}-${index}`}>{fact}</li>)}
          </ul>
        )}
        <Link
          to={`/events/${event.slug ?? event.id}`}
          className="itinerary-event-link"
          aria-label={`Event details: ${event.title}`}
        >
          Event details
        </Link>
      </div>
      {entry.item.note && <blockquote className="itinerary-note">{entry.item.note}</blockquote>}
    </div>
  );
}

export default function ItineraryView({ itinerary, schedule, cityName, neighbours, draft = false }: ItineraryViewProps) {
  const navigate = useNavigate();
  const weekLabel = formatWeekRange(itinerary.weekStart);
  const hasEvents = schedule.nights.some((night) => night.entries.length > 0);
  const nights = draft ? schedule.nights : schedule.nights.filter((night) => night.entries.length > 0);
  const admission = estimatedAdmission(schedule.nights);
  const badges = styleBadges(schedule);
  const openEvent = (event: ScheduleXEvent) => navigate(`/events/${event.slug ?? event.id}`);

  return (
    <article className="itinerary">
      {draft && (
        <p className="itinerary-draft" role="status">
          Draft — not public
        </p>
      )}

      <header className="itinerary-header">
        <h1>{itinerary.title}</h1>
        <p className="itinerary-dateline">
          {cityName} · {weekLabel}
        </p>
        {badges.length > 0 && (
          <ul className="itinerary-styles" aria-label="Dance styles">
            {badges.map((style) => (
              <li key={style}>{style}</li>
            ))}
          </ul>
        )}
        {itinerary.description && <p className="itinerary-intro">{itinerary.description}</p>}
      </header>

      {draft && !hasEvents && (
        <p className="itinerary-empty">No events picked yet. Add approved events to build this week.</p>
      )}

      {nights.length > 0 ? (
        <nav className="itinerary-strip" aria-label="Nights this week">
          <ol>
            {schedule.nights.map((night) => {
              // Featured pick, else the earliest alternative (entries are chronological).
              const lead = night.featured ?? night.entries.find((entry) => entry.item.role === "alternative");
              const day = (
                <span className="itinerary-strip__day">
                  {Temporal.PlainDate.from(night.date).toLocaleString("en-US", { weekday: "short" })}
                </span>
              );
              return (
                <li key={night.date}>
                  {lead ? (
                    <a href={`#night-${night.date}`}>
                      {day}
                      <span className="itinerary-strip__title">{lead.event.title}</span>
                      <span className="itinerary-strip__time">{lead.startLabel}</span>
                    </a>
                  ) : (
                    <div className="itinerary-strip__empty">
                      {day}
                      <span>No events</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : (
        // Publishing needs an item, so this only happens once every listed event has gone.
        <p className="itinerary-empty">
          Every event on this week&apos;s list has been cancelled or removed.{" "}
          <Link to="/calendar">Check the calendar</Link> for what&apos;s on.
        </p>
      )}

      {nights.map((night) => {
        // `entries` is chronological; `alternatives` is editorial rank. Display by start.
        const alternatives = night.entries.filter((entry) => entry.item.role === "alternative");
        return (
        <section key={night.date} id={`night-${night.date}`} className="itinerary-night">
          <h2>
            {Temporal.PlainDate.from(night.date).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h2>
          {draft && night.entries.length === 0 && <p className="itinerary-empty">No events picked.</p>}
          {night.featured && (
            <ItineraryPick entry={night.featured} timeZone={itinerary.timeZone} onSelect={openEvent} />
          )}
          {alternatives.length > 0 && (
            <div className="itinerary-alternatives">
              {alternatives.map((entry) => (
                <ItineraryPick key={entry.event.id} entry={entry} timeZone={itinerary.timeZone} onSelect={openEvent} />
              ))}
            </div>
          )}
        </section>
        );
      })}

      {itinerary.recommendations && (
        <section className="itinerary-recommendations">
          <h2>Recommendations</h2>
          <p>{itinerary.recommendations}</p>
        </section>
      )}

      {admission !== null && (
        <p className="itinerary-admission">Estimated admission for the featured nights: ${admission}</p>
      )}

      {!draft && (
        <EventShareControls
          url={buildPublicItineraryUrl(itinerary.city, itinerary.weekStart)}
          title={itinerary.title}
          dateLabel={weekLabel}
          location={cityName}
          subject="week"
        />
      )}

      {(neighbours?.previous || neighbours?.next) && (
        <nav className="itinerary-weeks" aria-label="Other weeks">
          {neighbours.previous && (
            <Link to={`/itineraries/${itinerary.city}/${neighbours.previous}`} className="itinerary-weeks__previous">
              <ArrowLeft size={16} aria-hidden="true" />
              Previous week <span>{formatWeekRange(neighbours.previous)}</span>
            </Link>
          )}
          {neighbours.next && (
            <Link to={`/itineraries/${itinerary.city}/${neighbours.next}`} className="itinerary-weeks__next">
              Next week <span>{formatWeekRange(neighbours.next)}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
