import "temporal-polyfill/global";
import type { City, DatabaseEvent } from "../../events/model/types";
import { fromEventDateInstant } from "../../events/model/eventDateTime";
import { qualityIssues } from "./overviewMetrics";

export type EventView = "all" | "upcoming" | "drafts" | "pending" | "published" | "cancelled" | "archived";
export type SortKey = "event_date" | "created_at" | "updated_at" | "title";
export type SortDir = "asc" | "desc";

export interface EventFilters {
  q: string;
  from: string | null; // yyyy-mm-dd inclusive
  to: string | null; // yyyy-mm-dd inclusive
  status: DatabaseEvent["status"][];
  organizer: string | null;
  venue: string | null;
  city: City | null;
  style: string | null;
  source: DatabaseEvent["source_type"] | null;
  incompleteOnly: boolean;
  submitter: string | null;
}

// Order and labels are fixed by the spec.
export const EVENT_VIEWS: { view: EventView; label: string }[] = [
  { view: "all", label: "All Events" },
  { view: "upcoming", label: "Upcoming" },
  { view: "drafts", label: "Drafts" },
  { view: "pending", label: "Pending Review" },
  { view: "published", label: "Published" },
  { view: "cancelled", label: "Cancelled" },
  { view: "archived", label: "Archived" },
];

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export const CITY_LABEL: Record<City, string> = {
  boston: "Boston",
  "new-york-city": "New York City",
};

// The seven fixed dance-style filter values, in the order the migration's
// backfill regex table lists them.
export const DANCE_STYLES = [
  { value: "salsa", label: "Salsa" },
  { value: "bachata", label: "Bachata" },
  { value: "kizomba", label: "Kizomba" },
  { value: "merengue", label: "Merengue" },
  { value: "cha-cha", label: "Cha-Cha" },
  { value: "zouk", label: "Zouk" },
  { value: "afro-cuban", label: "Afro-Cuban" },
] as const;

export const SOURCE_TYPE_LABEL: Record<DatabaseEvent["source_type"], string> = {
  admin: "Admin",
  user_submission: "User Submission",
  organizer: "Organizer",
  moderator: "Moderator",
  imported: "Imported",
};

// Names the write sites stamp instead of a real submitter — resolve to the
// Source label rather than exposing an internal system label as a person.
const INTERNAL_SUBMITTER_MARKERS = new Set([
  "Salsa Segura",
  "Seed Data",
  "ICS import (golatindance.com)",
]);

// Returns a safe display name for an event's submitter, hiding private emails
// and magic-link-only submitters behind a neutral label.
export function submitterDisplay(event: DatabaseEvent): string {
  if (event.submitter_id === null) return "Guest Submitter";
  if (event.submitter_name && INTERNAL_SUBMITTER_MARKERS.has(event.submitter_name)) {
    return SOURCE_TYPE_LABEL[event.source_type];
  }
  return event.submitter_name || "Guest Submitter";
}

// New York calendar midnight for "today", derived from `now` so callers stay
// pure and testable with a frozen clock.
function startOfTodayMs(now: Date): number {
  return Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .toZonedDateTimeISO("America/New_York")
    .startOfDay()
    .toInstant()
    .epochMilliseconds;
}

const VIEW_PREDICATES: Record<EventView, (event: DatabaseEvent, startOfToday: number) => boolean> = {
  all: (event) => event.status !== "archived",
  upcoming: (event, startOfToday) =>
    Date.parse(event.event_date) >= startOfToday &&
    (event.status === "draft" ||
      event.status === "pending" ||
      event.status === "approved" ||
      event.status === "cancelled"),
  drafts: (event) => event.status === "draft",
  pending: (event) => event.status === "pending",
  published: (event) => event.status === "approved",
  cancelled: (event) => event.status === "cancelled",
  archived: (event) => event.status === "archived",
};

export function applyView(events: DatabaseEvent[], view: EventView, now: Date): DatabaseEvent[] {
  const startOfToday = startOfTodayMs(now);
  const predicate = VIEW_PREDICATES[view];
  return events.filter((event) => predicate(event, startOfToday));
}

export function applyFilters(events: DatabaseEvent[], filters: EventFilters, _now: Date): DatabaseEvent[] {
  const q = filters.q.trim().toLowerCase();

  return events.filter((event) => {
    if (q) {
      const cityLabel = CITY_LABEL[event.city];
      const haystack = [
        event.title,
        event.location,
        event.host,
        event.submitter_name,
        event.submitter_email,
        cityLabel,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (filters.from || filters.to) {
      const eventDate = fromEventDateInstant(event.event_date).date;
      if (filters.from && eventDate < filters.from) return false;
      if (filters.to && eventDate > filters.to) return false;
    }

    if (filters.status.length > 0 && !filters.status.includes(event.status)) return false;

    if (filters.organizer && event.host !== filters.organizer) return false;

    if (filters.venue && event.location !== filters.venue) return false;

    if (filters.city && event.city !== filters.city) return false;

    if (filters.style && !event.dance_styles?.includes(filters.style)) return false;

    if (filters.source && event.source_type !== filters.source) return false;

    if (filters.submitter) {
      const needle = filters.submitter.toLowerCase();
      const matches =
        event.submitter_id === filters.submitter ||
        event.submitter_email?.toLowerCase() === needle;
      if (!matches) return false;
    }

    if (filters.incompleteOnly && qualityIssues(event).length === 0) return false;

    return true;
  });
}

export function applySort(events: DatabaseEvent[], key: SortKey, dir: SortDir): DatabaseEvent[] {
  const indexed = events.map((event, index) => ({ event, index }));

  indexed.sort((a, b) => {
    const cmp =
      key === "title"
        ? a.event.title.localeCompare(b.event.title, undefined, { sensitivity: "base" })
        : Date.parse(a.event[key]) - Date.parse(b.event[key]);

    if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    return a.index - b.index;
  });

  return indexed.map(({ event }) => event);
}

export function defaultSortFor(view: EventView): { key: SortKey; dir: SortDir } {
  return view === "upcoming" ? { key: "event_date", dir: "asc" } : { key: "event_date", dir: "desc" };
}

export function viewCounts(events: DatabaseEvent[], now: Date): Record<EventView, number> {
  const startOfToday = startOfTodayMs(now);
  const counts = {} as Record<EventView, number>;
  (Object.keys(VIEW_PREDICATES) as EventView[]).forEach((view) => {
    const predicate = VIEW_PREDICATES[view];
    counts[view] = events.filter((event) => predicate(event, startOfToday)).length;
  });
  return counts;
}
