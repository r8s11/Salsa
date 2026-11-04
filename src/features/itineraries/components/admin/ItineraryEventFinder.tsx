import "temporal-polyfill/global";
import { useId, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { EVENT_TYPE_LABELS, getEventTypes } from "../../../events/model/types";
import { neighborhoodLabel } from "../../../metros/model/neighborhood";
import type { DatabaseEvent } from "../../../../types/events";
import type { ScheduleNight } from "../../model/schedule";
import type { ItineraryItem, ItineraryItemRole } from "../../model/types";
import { nightWeekday, startTimeLabel } from "../../model/week";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type StartBand = "early" | "evening" | "late";
const START_BANDS: { value: StartBand; label: string }[] = [
  { value: "early", label: "Before 6 PM" },
  { value: "evening", label: "6–9 PM" },
  { value: "late", label: "After 9 PM" },
];

/** By local start hour; after-midnight starts belong to the night before, so they count as late. */
function startBand(instantISO: string, timeZone: string): StartBand {
  const { hour } = Temporal.Instant.from(instantISO).toZonedDateTimeISO(timeZone);
  if (hour < 5 || hour >= 21) return "late";
  return hour < 18 ? "early" : "evening";
}

interface Filters {
  query: string;
  style: string;
  venue: string;
  organizer: string;
  neighborhood: string;
  type: string;
  weekday: string;
  band: string;
}

const NO_FILTERS: Filters = {
  query: "",
  style: "",
  venue: "",
  organizer: "",
  neighborhood: "",
  type: "",
  weekday: "",
  band: "",
};

type Option = { value: string; label: string };

function distinct(entries: Option[]): Option[] {
  const seen = new Map(entries.map((entry) => [entry.value, entry]));
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function styleTerms(event: DatabaseEvent) {
  const terms = event.taxonomy_terms.filter((term) => term.category === "dance_style");
  return terms.length ? terms : (event.dance_styles ?? []).map((name) => ({ name, slug: name.trim().toLowerCase() }));
}

function venueName(event: DatabaseEvent): string {
  return event.public_entities?.venue?.name.trim() || event.location?.trim() || "";
}

function organizerName(event: DatabaseEvent): string {
  return event.public_entities?.organizer?.name.trim() || event.host?.trim() || "";
}

interface ItineraryEventFinderProps {
  events: DatabaseEvent[];
  loading: boolean;
  error: string | null;
  timeZone: string;
  nights: ScheduleNight[];
  items: ItineraryItem[];
  onAdd: (eventId: string, role: ItineraryItemRole) => void;
}

/** Approved events in the city and week, filtered on the client. */
export default function ItineraryEventFinder({
  events,
  loading,
  error,
  timeZone,
  nights,
  items,
  onAdd,
}: ItineraryEventFinderProps) {
  const headingId = useId();
  const idPrefix = useId();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const set = (key: keyof Filters) => (value: string) => setFilters((current) => ({ ...current, [key]: value }));

  const options = useMemo(
    () => ({
      style: distinct(events.flatMap((e) => styleTerms(e).map((term) => ({ value: term.slug, label: term.name })))),
      venue: distinct(events.flatMap((e) => venueName(e) ? [{ value: venueName(e), label: venueName(e) }] : [])),
      organizer: distinct(events.flatMap((e) => organizerName(e) ? [{ value: organizerName(e), label: organizerName(e) }] : [])),
      neighborhood: distinct(
        events.flatMap((e) => (e.neighborhood ? [{ value: e.neighborhood, label: neighborhoodLabel(e.neighborhood) ?? e.neighborhood }] : []))
      ),
      type: distinct(events.flatMap((e) => getEventTypes(e).map((type) => ({ value: type, label: EVENT_TYPE_LABELS[type] })))),
    }),
    [events]
  );

  const results = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return events.filter((event) => {
      if (query && ![event.title, venueName(event), organizerName(event)].some((field) => field?.toLowerCase().includes(query))) return false;
      if (filters.style && !styleTerms(event).some((term) => term.slug === filters.style)) return false;
      if (filters.venue && venueName(event) !== filters.venue) return false;
      if (filters.organizer && organizerName(event) !== filters.organizer) return false;
      if (filters.neighborhood && event.neighborhood !== filters.neighborhood) return false;
      if (filters.type && !getEventTypes(event).some((type) => type === filters.type)) return false;
      if (filters.weekday && String(nightWeekday(event.event_date, timeZone)) !== filters.weekday) return false;
      if (filters.band && startBand(event.event_date, timeZone) !== filters.band) return false;
      return true;
    });
  }, [events, filters, timeZone]);

  const picked = new Map(items.map((item) => [item.eventId, item]));
  const filtering = Object.values(filters).some(Boolean);

  const select = (key: Exclude<keyof Filters, "query">, label: string, all: string, choices: Option[]) => (
    <div className="admin-field">
      <label htmlFor={`${idPrefix}-${key}`}>{label}</label>
      <div className="admin-select-wrap">
        <select
          id={`${idPrefix}-${key}`}
          className="admin-select"
          value={filters[key]}
          onChange={(event) => set(key)(event.target.value)}
        >
          <option value="">{all}</option>
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
    </div>
  );

  return (
    <section className="admin-card itinerary-editor__section" aria-labelledby={headingId}>
      <h2 id={headingId}>Find events</h2>

      <div className="itinerary-finder__filters">
        <div className="admin-field itinerary-finder__search">
          <label htmlFor={`${idPrefix}-query`}>Search</label>
          <div className="itinerary-finder__search-input">
            <Search size={16} aria-hidden="true" />
            <input
              id={`${idPrefix}-query`}
              type="search"
              className="admin-input"
              placeholder="Title, venue or organizer"
              value={filters.query}
              onChange={(event) => set("query")(event.target.value)}
            />
          </div>
        </div>
        {select("style", "Style", "All styles", options.style)}
        {select("venue", "Venue", "All venues", options.venue)}
        {select("organizer", "Organizer", "All organizers", options.organizer)}
        {select("neighborhood", "Neighborhood", "All neighborhoods", options.neighborhood)}
        {select("type", "Event type", "All types", options.type)}
        {select(
          "weekday",
          "Night",
          "Every night",
          WEEKDAYS.map((label, index) => ({ value: String(index + 1), label }))
        )}
        {select("band", "Starts", "Any time", START_BANDS)}
      </div>

      {loading ? (
        <p className="itinerary-editor__empty" role="status">
          Loading this week&apos;s events…
        </p>
      ) : error ? (
        <p className="admin-banner admin-banner--error" role="alert">
          {error}
        </p>
      ) : results.length === 0 ? (
        <div className="itinerary-editor__empty" role="status">
          <p>{filtering ? "No events match these filters." : "No approved events in this city this week."}</p>
          {filtering && (
            <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => setFilters(NO_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <ul className="itinerary-finder__results">
          {results.map((event) => {
            const titleId = `${idPrefix}-result-${event.id}`;
            const weekday = nightWeekday(event.event_date, timeZone);
            const featured = nights.find((night) => night.weekday === weekday)?.featured ?? null;
            const item = picked.get(event.id);
            const place = [venueName(event), neighborhoodLabel(event.neighborhood)].filter(Boolean).join(" · ");
            return (
              <li key={event.id} className="itinerary-finder__result" aria-labelledby={titleId}>
                <div className="itinerary-finder__when">
                  <span>{WEEKDAYS[weekday - 1].slice(0, 3)}</span>
                  <span>{startTimeLabel(event.event_date, timeZone)}</span>
                </div>
                <div className="itinerary-finder__what">
                  <span id={titleId} className="itinerary-finder__title">
                    {event.title}
                  </span>
                  {place && <span className="itinerary-editor__muted">{place}</span>}
                  {featured && featured.event.id !== event.id && (
                    <span className="itinerary-editor__muted">Featured: {featured.event.title}</span>
                  )}
                </div>
                <div className="itinerary-finder__actions">
                  {item ? (
                    <span className="itinerary-editor__muted">
                      {item.role === "featured" ? "Featured pick" : "Alternative"} on the schedule
                    </span>
                  ) : (
                    <>
                      <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={() => onAdd(event.id, "featured")}>
                        Feature
                      </button>
                      <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" onClick={() => onAdd(event.id, "alternative")}>
                        Add as alternative
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
