// What the itinerary posters print, derived once from the schedule: the week
// pressed as a compilation LP, one track per dance night.
import "temporal-polyfill/global";
import { databaseEventToScheduleX } from "../../events/model/convert";
import { resolveEventFlyer } from "../../events/components/event-modal/eventModalImage";
import { POSTER_CITY_CODES, POSTER_SIZE } from "../../events/components/event-modal/posterFormat";
import { spotlightNights, type ScheduledEntry, type ScheduleNight } from "./schedule";
import type { Itinerary } from "./types";
import { formatWeekRange, startTimeLabel } from "./week";
import { buildPublicItineraryUrl, itineraryUrlLabel } from "./itinerarySharing";

export type ItineraryPosterFormat = "story" | "feed" | "card";

/** Story and feed match the event cuts; the card is the 1200×630 link preview. */
export const ITINERARY_POSTER_SIZE: Record<ItineraryPosterFormat, { width: number; height: number }> = {
  story: POSTER_SIZE.story,
  feed: POSTER_SIZE.feed,
  card: { width: 1200, height: 630 },
};

export interface PosterTile {
  imageUrl: string;
  artKind: "flyer" | "fallback";
  /** The event's type, which picks the tile's pressing colour. */
  pressing: string;
}

export interface PosterTrack {
  code: string;
  day: string;
  title: string;
  time: string;
  venue: string | null;
  pressing: string;
}

export interface ItineraryPosterModel {
  format: ItineraryPosterFormat;
  title: string;
  catalogue: string;
  cityName: string;
  weekLabel: string;
  tiles: PosterTile[];
  tracks: PosterTrack[];
  url: string;
  urlLabel: string;
}

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const SPOTLIGHT_LIMIT = 4;

/**
 * The week label set on short lines for the sticker and the card: a week
 * inside one month stays whole ("Nov 9–15"), one that crosses months breaks
 * at the dash ("Nov 30–" / "Dec 6") instead of shrinking to fit one line.
 */
export function weekLabelLines(weekLabel: string): string[] {
  const [start, end] = weekLabel.split(" – ");
  return end ? [`${start}–`, end] : [weekLabel];
}

/** Mon–Thu print as side A and Fri–Sun as side B, each numbered from 1. */
function pressTracks(picks: { night: ScheduleNight; entry: ScheduledEntry }[], timeZone: string): PosterTrack[] {
  const counts = { A: 0, B: 0 };
  return picks.map(({ night, entry }) => {
    const side = night.weekday <= 4 ? "A" : "B";
    counts[side] += 1;
    return {
      code: `${side}${counts[side]}`,
      day: `${WEEKDAYS[night.weekday - 1]} ${Temporal.PlainDate.from(night.date).day}`,
      title: entry.event.title,
      time: startTimeLabel(entry.event.event_date, timeZone).toUpperCase().replace(/[()]/g, ""),
      venue: entry.event.location?.trim() || null,
      pressing: databaseEventToScheduleX(entry.event).calendarId,
    };
  });
}

export function buildItineraryPosterModel(input: {
  itinerary: Pick<Itinerary, "city" | "weekStart" | "timeZone" | "title">;
  cityName: string;
  nights: ScheduleNight[];
  flyers: ReadonlyMap<string, string | null>;
  format: ItineraryPosterFormat;
}): ItineraryPosterModel {
  const { itinerary, cityName, nights, flyers, format } = input;
  const spotlight = spotlightNights(nights, SPOTLIGHT_LIMIT).flatMap((night) =>
    night.featured ? [{ night, entry: night.featured }] : [],
  );

  const tiles = spotlight.map(({ entry }): PosterTile => {
    const event = databaseEventToScheduleX(entry.event);
    const flyer = flyers.get(entry.event.id);
    return flyer
      ? { imageUrl: flyer, artKind: "flyer", pressing: event.calendarId }
      : { imageUrl: resolveEventFlyer({ ...event, imageUrl: undefined }), artKind: "fallback", pressing: event.calendarId };
  });

  // The card lists only the spotlight; the story and feed press every night
  // that has a pick (featured, else the top-ranked alternative).
  const picks =
    format === "card"
      ? spotlight
      : nights.flatMap((night) => {
          const entry = night.featured ?? night.alternatives[0];
          return entry ? [{ night, entry }] : [];
        });

  const isoWeek = Temporal.PlainDate.from(itinerary.weekStart).weekOfYear;
  const url = buildPublicItineraryUrl(itinerary.city, itinerary.weekStart);

  return {
    format,
    title: itinerary.title,
    catalogue: `SS-W${isoWeek} · ${POSTER_CITY_CODES[itinerary.city] ?? itinerary.city.toUpperCase()}`,
    cityName,
    weekLabel: formatWeekRange(itinerary.weekStart),
    tiles,
    tracks: pressTracks(picks, itinerary.timeZone),
    url,
    urlLabel: itineraryUrlLabel(url),
  };
}

/**
 * Canonical cover registration contract, mirrored by itinerary_cover_sources.
 * Build from the SAME inputs as the capture, never a freshly fetched revision:
 * an already-stale in-memory event must not acquire a current server revision.
 * Include every selected item, not only the four spotlight events.
 */
export function buildItineraryCoverSnapshot(input: {
  itinerary: Pick<Itinerary, "city" | "weekStart" | "timeZone" | "title">;
  cityName: string;
  nights: ScheduleNight[];
}): ItineraryCoverSnapshot {
  return {
    city: input.itinerary.city,
    city_name: input.cityName,
    week_start: input.itinerary.weekStart,
    time_zone: input.itinerary.timeZone,
    title: input.itinerary.title,
    items: input.nights.flatMap((night) => night.entries)
      .sort((a, b) => a.item.eventId < b.item.eventId ? -1 : a.item.eventId > b.item.eventId ? 1 : 0)
      .map(({ item, event }) => ({
        event_id: item.eventId,
        role: item.role,
        position: item.position,
        note: item.note,
        event: {
          id: event.id,
          city: event.city,
          status: event.status,
          title: event.title,
          event_date_ms: Temporal.Instant.from(event.event_date).epochMilliseconds,
          event_type: event.event_type,
          location: event.location ?? null,
          // Normalizing the same original flyer may warm poster_image_url.
          // That derived cache write does not change the artwork's identity.
          artwork_source: event.image_url ?? event.image_urls?.[0] ?? event.poster_image_url ?? null,
          dance_styles: event.taxonomy_terms.length > 0
            ? event.taxonomy_terms.filter((term) => term.category === "dance_style").map((term) => term.name)
            : (event.dance_styles ?? []),
        },
      })),
  };
}

/** Public render facts accepted by set_itinerary_cover(p_id, p_url, p_snapshot). */
export interface ItineraryCoverSnapshot {
  city: string;
  city_name: string;
  week_start: string;
  time_zone: string;
  title: string;
  items: {
    event_id: string;
    role: "featured" | "alternative";
    position: number;
    note: string | null;
    event: {
      id: string;
      city: string;
      status: string;
      title: string;
      event_date_ms: number;
      event_type: string;
      location: string | null;
      artwork_source: string | null;
      dance_styles: string[];
    };
  }[];
}
