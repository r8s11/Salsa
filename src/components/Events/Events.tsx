// Purpose: Display the home page event feed — a featured event plus a
// filterable grid of the rest of this week's floor.
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../ui/Button";
import ButtonLink from "../ui/ButtonLink";
import { useEvents } from "../../features/events/hooks/useEvent";
import { useNewYorkToday } from "../../features/events/hooks/useNewYorkToday";
import { nightOf } from "../../features/events/model/night";
import { useCity } from "../../contexts/useCity";
import { useMetroName } from "../../features/metros/hooks/useMetros";
import MetroExplorer from "../../features/metros/components/MetroExplorer";
import MetroSuggestions from "../../features/metros/components/MetroSuggestions";
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

function Events() {
  const { city, source, activeMetros } = useCity();
  const { events: allEvents, loading, fetching, error, loadFailed, refetch } = useEvents();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedEvent, setSelectedEvent] = useState<ScheduleXEvent | null>(null);
  const metroName = useMetroName();
  const cityLabel = city ? metroName(city) : "";
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

  // No metro to show: the visitor's area has no active metro nearby, or no
  // metro has upcoming events at all. Never an empty homepage — say so and
  // hand them the closest cities that do have a floor.
  if (!city) {
    const noneAnywhere = activeMetros.length === 0;
    return (
      <section id="events" className="events">
        <div className="container">
          <div className="no-events no-events--all no-events--area" role="status">
            <div>
              <h2 id="events-area-heading" className="no-events__title">
                {noneAnywhere
                  ? "No upcoming SalsaSegura events yet."
                  : source === "none-nearby"
                    ? "No SalsaSegura events near you yet."
                    : "Choose a city to see its events."}
              </h2>
              <p>
                We&apos;re growing city by city.{" "}
                {noneAnywhere
                  ? "Submit an event happening near you."
                  : "Explore events in other cities or submit an event happening near you."}
              </p>
            </div>
            {!noneAnywhere && <MetroSuggestions labelledBy="events-area-heading" />}
            <div className="no-events__actions">
              {!noneAnywhere && <MetroExplorer label="Explore other cities" />}
              <ButtonLink to="/submit" variant="primary">
                Submit an event
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
            <div className="no-events no-events--all no-events--area" role="status">
              <div>
                <h3 id="events-empty-heading">Nothing on the floor in {cityLabel} yet.</h3>
                <p>
                  We&apos;re growing city by city. Explore events in other cities or submit an
                  event happening in {cityLabel}.
                </p>
              </div>
              <MetroSuggestions labelledBy="events-empty-heading" />
              <div className="no-events__actions">
                <MetroExplorer label="Explore other cities" />
                <ButtonLink to="/submit" variant="primary">
                  Submit an event
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
