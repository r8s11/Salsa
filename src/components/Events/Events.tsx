// Purpose: Display the home page event feed — a featured event plus a
// filterable grid of the rest of this week's floor.
import { useEffect, useMemo, useState } from "react";
import Button from "../ui/Button";
import ButtonLink from "../ui/ButtonLink";
import { useEvents } from "../../features/events/hooks/useEvent";
import { useCity } from "../../contexts/useCity";
import EventCard from "./EventCard";
import FeaturedEventCard from "./FeaturedEventCard";
import EventModal from "../EventModal/EventModal";
import { filterEventsByType, TypeFilter } from "../../utils/filterEvents";
import type { ScheduleXEvent } from "../../types/events";
import "./Events.css";

const FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "social", label: "Social" },
  { value: "class", label: "Class" },
  { value: "workshop", label: "Workshop" },
];

const CITY_LABELS: Record<string, string> = {
  boston: "Greater Boston",
  "new-york-city": "NYC",
};

function Events() {
  const { city } = useCity();
  const { events: allEvents, loading, fetching, error, refetch } = useEvents();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedEvent, setSelectedEvent] = useState<ScheduleXEvent | null>(null);
  const cityLabel = CITY_LABELS[city] ?? city;

  // The raw driver message is for us, not for dancers: log it, never render it.
  useEffect(() => {
    if (error) console.warn(`Events feed failed to load (${city}):`, error);
  }, [error, city]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return allEvents
      .filter((event) => new Date(event.start.replace(" ", "T")) >= now)
      .sort(
        (a, b) =>
          new Date(a.start.replace(" ", "T")).getTime() -
          new Date(b.start.replace(" ", "T")).getTime()
      );
  }, [allEvents]);

  const featuredEvent = upcomingEvents[0] ?? null;
  const feedSource = featuredEvent ? upcomingEvents.slice(1) : upcomingEvents;
  const feedEvents = useMemo(
    () => filterEventsByType(feedSource, typeFilter).slice(0, 6),
    [feedSource, typeFilter]
  );
  const activeFilterLabel =
    FILTER_OPTIONS.find((o) => o.value === typeFilter)?.label.toLowerCase() ?? "";

  if (loading) {
    return (
      <section id="events" className="events">
        <div className="container">
          <div className="events-feed-header">
            <h2 className="events-feed-title">This Week&apos;s Floor</h2>
          </div>
          <div className="events-grid events-skeleton" aria-live="polite" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="event-card skeleton" aria-hidden />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="events" className="events">
        <div className="container">
          <div className="events-feed-header">
            <h2 className="events-feed-title">This Week&apos;s Floor</h2>
          </div>
          <div className="no-events no-events--all" role="alert">
            <div>
              <h3>We couldn&apos;t load {cityLabel}&apos;s listings.</h3>
              <p>The events didn&apos;t come through this time. Try again, or open the full calendar.</p>
            </div>
            <div className="no-events__actions">
              <Button
                variant="primary"
                loading={fetching}
                loadingLabel="Trying again…"
                onClick={() => void refetch()}
              >
                Try again
              </Button>
              <ButtonLink to="/calendar" variant="secondary">
                View Full Calendar
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section id="events" className="events">
        <div className="container">
          {featuredEvent && (
            <div className="events-featured-wrap">
              <h2 className="events-eyebrow">◆ Featured Tonight</h2>
              <FeaturedEventCard event={featuredEvent} onSelect={setSelectedEvent} />
            </div>
          )}

          <div className="events-feed-header">
            <h2 className="events-feed-title">This Week&apos;s Floor</h2>
            <div className="feed-filters" role="group" aria-label="Filter by event type">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`feed-filter ${typeFilter === opt.value ? "feed-filter-active" : ""}`}
                  aria-pressed={typeFilter === opt.value}
                  onClick={() => setTypeFilter(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="no-events no-events--all" role="status">
              <div>
                <h3>Nothing on floor in {cityLabel} yet.</h3>
                <p>Check the full calendar or help set the next date.</p>
              </div>
              <div className="no-events__actions">
                <ButtonLink to="/calendar" variant="secondary">
                  View Full Calendar
                </ButtonLink>
                <ButtonLink to="/submit" variant="primary">
                  Submit an Event
                </ButtonLink>
              </div>
            </div>
          ) : feedEvents.length > 0 ? (
            <div className={`events-grid${feedEvents.length < 3 ? " events-grid--thin" : ""}`}>
              {feedEvents.map((event) => (
                <EventCard key={event.id} event={event} onSelect={setSelectedEvent} />
              ))}
            </div>
          ) : (
            <div className="no-events">
              <p>No additional {activeFilterLabel} events this week. Try another filter.</p>
            </div>
          )}

          {upcomingEvents.length > 0 && (
            <div className="events-footer">
              <ButtonLink to="/calendar" variant="secondary">
                View Full Calendar
              </ButtonLink>
              <div className="events-cta">
                <p>Want to host a pop-up class or private event?</p>
                <ButtonLink to="/submit" variant="primary">
                  Submit an Event
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </section>
      <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </>
  );
}

export default Events;
