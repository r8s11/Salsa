import "temporal-polyfill/global";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import EventCard from "../../events/components/EventCard";
import EventShareControls from "../../events/components/EventShareControls";
import FeaturedEventCard from "../../events/components/FeaturedEventCard";
import { databaseEventToScheduleX } from "../../events/model/convert";
import type { ScheduleXEvent } from "../../../types/events";
import { buildPublicItineraryUrl } from "../model/itinerarySharing";
import { estimatedAdmission, type Schedule, type ScheduledEntry } from "../model/schedule";
import type { Itinerary } from "../model/types";
import { formatWeekRange } from "../model/week";
import "./ItineraryView.css";

interface ItineraryViewProps {
  itinerary: Itinerary;
  schedule: Schedule;
  cityName: string;
  neighbours?: { previous: string | null; next: string | null };
  /** Admin preview: shows the draft banner and hides sharing. */
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

function CuratorNote({ entry }: { entry: ScheduledEntry }) {
  return entry.item.note ? <blockquote className="itinerary-note">{entry.item.note}</blockquote> : null;
}

export default function ItineraryView({ itinerary, schedule, cityName, neighbours, draft = false }: ItineraryViewProps) {
  const navigate = useNavigate();
  const weekLabel = formatWeekRange(itinerary.weekStart);
  const nights = schedule.nights.filter((night) => night.entries.length > 0);
  const admission = estimatedAdmission(schedule.nights);
  const badges = styleBadges(schedule);
  // Cards show times in the itinerary's zone so each sits under the night it belongs to.
  const cardZone = { timeZone: itinerary.timeZone };
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

      {nights.length > 0 && (
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
      )}

      {nights.map((night) => {
        // `entries` is chronological; `alternatives` is editorial rank. Display by start.
        const alternatives = night.entries.filter((entry) => entry.item.role === "alternative");
        return (
        <section key={night.date} id={`night-${night.date}`} className="itinerary-night">
          <h2>
            {Temporal.PlainDate.from(night.date).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h2>
          {night.featured && (
            <div className="itinerary-pick">
              <FeaturedEventCard event={databaseEventToScheduleX(night.featured.event, cardZone)} onSelect={openEvent} />
              <CuratorNote entry={night.featured} />
            </div>
          )}
          {alternatives.length > 0 && (
            <div className="itinerary-alternatives">
              {alternatives.map((entry) => (
                <div key={entry.event.id} className="itinerary-pick">
                  <EventCard event={databaseEventToScheduleX(entry.event, cardZone)} onSelect={openEvent} />
                  <CuratorNote entry={entry} />
                </div>
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
