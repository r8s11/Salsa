// Purpose: Display the home page event feed — a featured event plus a
// filterable grid of the rest of this week's floor.
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../ui/Button";
import ButtonLink from "../ui/ButtonLink";
import { useEvents } from "../../features/events/hooks/useEvent";
import { useNewYorkToday } from "../../features/events/hooks/useNewYorkToday";
import { nightOf } from "../../features/events/model/night";
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
  const { events: allEvents, loading, fetching, error, loadFailed, refetch } = useEvents();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedEvent, setSelectedEvent] = useState<ScheduleXEvent | null>(null);
  const cityLabel = CITY_LABELS[city] ?? city;
  const today = useNewYorkToday();

  // The raw driver message is for us, not for dancers: log it, never render it.
  useEffect(() => {
    if (error) console.warn(`Events feed failed to load (${city}):`, error);
  }, [error, city]);

  // Retry disables its button while the request runs, which drops keyboard
  // focus to <body>. When the retry settles and the error is still showing,
  // hand focus back so a keyboard user can try again from where they were.
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const retryPending = useRef(false);
  useEffect(() => {
    if (fetching || !retryPending.current) return;
    retryPending.current = false;
    retryButtonRef.current?.focus();
  }, [fetching]);
  const retry = () => {
    retryPending.current = true;
    void refetch();
  };

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
  const featuredNight = featuredEvent ? nightOf(featuredEvent.start, today) : null;
  const feedSource = featuredEvent ? upcomingEvents.slice(1) : upcomingEvents;
  const feedEvents = useMemo(
    () => filterEventsByType(feedSource, typeFilter).slice(0, 6),
    [feedSource, typeFilter]
  );
  const activeFilterLabel =
    FILTER_OPTIONS.find((o) => o.value === typeFilter)?.label.toLowerCase() ?? "";

  if (loading && !loadFailed) {
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

  if (loadFailed) {
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
                ref={retryButtonRef}
                variant="primary"
                loading={fetching}
                loadingLabel="Trying again…"
                onClick={retry}
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
          {featuredEvent && featuredNight && (
            <div className="events-featured-wrap">
              {featuredNight.kind === "later" ? (
                <>
                  <h2 className="events-featured-quiet">Nothing on the floor tonight in {cityLabel}.</h2>
                  <p className="events-eyebrow">
                    Next up · <time dateTime={featuredNight.date}>{featuredNight.label}</time>
                  </p>
                </>
              ) : (
                <h2 className="events-eyebrow">
                  {featuredNight.kind === "tonight" ? "Featured Tonight" : "Featured Today"}
                </h2>
              )}
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
                <h3>Nothing on the floor in {cityLabel} yet.</h3>
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
            </div>
          )}
        </div>
      </section>
      <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </>
  );
}

export default Events;
