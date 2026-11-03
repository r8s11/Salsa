// Groups an itinerary's events into dance nights, flags publish problems and
// totals featured admission. Pure and DOM-free.
import "temporal-polyfill/global";
import type { DatabaseEvent } from "../../../types/events";
import type { IsoWeekday, ItineraryDraft, ItineraryItem } from "./types";
import { danceNightOf, startTimeLabel, weekNights } from "./week";

export interface ScheduledEntry {
  item: ItineraryItem;
  event: DatabaseEvent;
  night: string;
  startLabel: string;
}

export interface ScheduleNight {
  date: string;
  weekday: IsoWeekday;
  entries: ScheduledEntry[];
  featured: ScheduledEntry | null;
  alternatives: ScheduledEntry[];
  unfeatured: boolean;
}

export interface Schedule {
  nights: ScheduleNight[];
  outside: ScheduledEntry[];
  missing: ItineraryItem[];
}

export type ItineraryWarningCode =
  | "not_public"
  | "outside_week"
  | "wrong_city"
  | "two_featured"
  | "no_featured"
  | "missing_flyer"
  | "missing_venue"
  | "missing_price";

export interface ItineraryWarning {
  code: ItineraryWarningCode;
  eventId: string | null;
  night: string | null;
  blocking: boolean;
  message: string;
}

const MESSAGES: Record<ItineraryWarningCode, string> = {
  not_public: "No longer public (cancelled, unpublished or removed)",
  outside_week: "Now outside this week",
  wrong_city: "Now listed in another city",
  two_featured: "Two featured events on one night",
  no_featured: "No featured pick",
  missing_flyer: "No flyer",
  missing_venue: "No venue",
  missing_price: "No price",
};

const BLOCKING = new Set<ItineraryWarningCode>(["not_public", "outside_week", "wrong_city", "two_featured"]);

const SPOTLIGHT_PRIORITY: IsoWeekday[] = [5, 6, 4, 7, 3, 2, 1];

const byPosition = (a: ScheduledEntry, b: ScheduledEntry) => a.item.position - b.item.position;

export function buildSchedule(
  draft: Pick<ItineraryDraft, "weekStart" | "timeZone" | "items" | "unfeaturedDays">,
  events: ReadonlyMap<string, DatabaseEvent>,
): Schedule {
  const nights: ScheduleNight[] = weekNights(draft.weekStart).map((date) => {
    const weekday = Temporal.PlainDate.from(date).dayOfWeek as IsoWeekday;
    return {
      date,
      weekday,
      entries: [],
      featured: null,
      alternatives: [],
      unfeatured: draft.unfeaturedDays.includes(weekday),
    };
  });
  const outside: ScheduledEntry[] = [];
  const missing: ItineraryItem[] = [];

  for (const item of draft.items) {
    const event = events.get(item.eventId);
    if (!event) {
      missing.push(item);
      continue;
    }
    const night = danceNightOf(event.event_date, draft.timeZone).toString();
    const entry = { item, event, night, startLabel: startTimeLabel(event.event_date, draft.timeZone) };
    const target = nights.find((n) => n.date === night);
    if (target) target.entries.push(entry);
    else outside.push(entry);
  }

  for (const night of nights) {
    night.entries.sort((a, b) =>
      Temporal.Instant.compare(Temporal.Instant.from(a.event.event_date), Temporal.Instant.from(b.event.event_date)),
    );
    night.featured = night.entries.filter((e) => e.item.role === "featured").sort(byPosition)[0] ?? null;
    night.alternatives = night.entries.filter((e) => e.item.role === "alternative").sort(byPosition);
  }

  return { nights, outside, missing };
}

export function itineraryWarnings(
  draft: ItineraryDraft,
  events: ReadonlyMap<string, DatabaseEvent>,
): ItineraryWarning[] {
  const schedule = buildSchedule(draft, events);
  const warnings: ItineraryWarning[] = [];
  const warn = (code: ItineraryWarningCode, eventId: string | null, night: string | null) =>
    warnings.push({ code, eventId, night, blocking: BLOCKING.has(code), message: MESSAGES[code] });

  for (const item of schedule.missing) warn("not_public", item.eventId, null);
  for (const entry of schedule.outside) warn("outside_week", entry.event.id, entry.night);

  for (const night of schedule.nights) {
    if (night.entries.filter((e) => e.item.role === "featured").length > 1) warn("two_featured", null, night.date);
    if (night.entries.length > 0 && !night.featured && !night.unfeatured) warn("no_featured", null, night.date);
  }

  const present = [...schedule.nights.flatMap((n) => n.entries), ...schedule.outside];
  for (const { event, night } of present) {
    if (event.city !== draft.city) warn("wrong_city", event.id, night);
    if (!event.image_url && !event.image_urls?.length) warn("missing_flyer", event.id, night);
    if (!event.location?.trim()) warn("missing_venue", event.id, night);
    if (!(event.price_type === "free" || (event.price_type === "paid" && event.price_amount != null)))
      warn("missing_price", event.id, night);
  }

  return warnings;
}

export function spotlightNights(nights: ScheduleNight[], limit: number): ScheduleNight[] {
  const picked = SPOTLIGHT_PRIORITY.map((day) => nights.find((n) => n.weekday === day && n.featured))
    .filter((n): n is ScheduleNight => n != null)
    .slice(0, limit);
  return nights.filter((n) => picked.includes(n));
}

export function estimatedAdmission(nights: ScheduleNight[]): number | null {
  const featured = nights.flatMap((n) => (n.featured ? [n.featured.event] : []));
  if (featured.length === 0) return null;
  let sum = 0;
  for (const event of featured) {
    if (event.price_type === "free") continue;
    if (event.price_type !== "paid" || event.price_amount == null) return null;
    sum += event.price_amount;
  }
  return Math.round(sum);
}
